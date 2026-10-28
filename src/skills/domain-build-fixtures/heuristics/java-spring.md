# Fixtures heuristic — Java / Spring Boot

## Destination and export

```
synthy export <out> --to files --dest src/test/resources/synthy
```

CSV tables, `load.sql`, `questions.json`, `manifest.json`, `certificate.json`, `traceability.json`.

## Dependencies (test scope)

Spring Boot's `spring-boot-starter-test` already brings JUnit 5 and Jackson. Add DuckDB's JDBC driver:

```xml
<dependency>
  <groupId>org.duckdb</groupId>
  <artifactId>duckdb_jdbc</artifactId>
  <version>1.5.6.0</version>
  <scope>test</scope>
</dependency>
```

and let it load its native library without a warning (Java 22+):

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-surefire-plugin</artifactId>
  <configuration><argLine>--enable-native-access=ALL-UNNAMED</argLine></configuration>
</plugin>
```

Gradle: `testImplementation("org.duckdb:duckdb_jdbc:1.5.6.0")` and
`tasks.test { jvmArgs("--enable-native-access=ALL-UNNAMED") }`. Without Spring Boot, also add
`org.junit.jupiter:junit-jupiter` and `com.fasterxml.jackson.core:jackson-databind`.

## Certificate harness

One dynamic test per hard question. Verified on the orders example: 111 tests, all passing; JUnit
5.12, duckdb_jdbc 1.5.6.0, Java 21 and 25. Put it in the project's test root under its base package.

```java
package <base>.synthy;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

/**
 * The synthy certificate as tests: every hard question of questions.json, re-asked of the
 * fixture files with DuckDB. Re-export the fixtures (synthy export) rather than editing them.
 */
class SynthyCertificateTest {
    static final Path FIXTURES = Path.of("src/test/resources/synthy");
    static Connection db;

    @BeforeAll
    static void load() throws Exception {
        db = DriverManager.getConnection("jdbc:duckdb:");
        try (Statement st = db.createStatement()) {
            st.execute("SET file_search_path = '" + FIXTURES.toAbsolutePath().toString().replace("'", "''") + "'");
            // load.sql: one statement per line, comments start with --
            for (String line : Files.readAllLines(FIXTURES.resolve("load.sql"))) {
                if (!line.isBlank() && !line.startsWith("--")) st.execute(line);
            }
        }
    }

    @AfterAll
    static void close() throws Exception {
        db.close();
    }

    @TestFactory
    Stream<DynamicTest> certificate() throws Exception {
        List<Map<String, Object>> questions = new ObjectMapper().readValue(FIXTURES.resolve("questions.json").toFile(), new TypeReference<>() {});
        return questions.stream()
            .filter(q -> "hard".equals(q.get("tier")))
            .map(q -> DynamicTest.dynamicTest(q.get("id") + " " + q.get("description"), () -> {
                try (Statement st = db.createStatement(); ResultSet rs = st.executeQuery((String) q.get("sql"))) {
                    Object observed = rs.next() ? rs.getObject(1) : null;
                    assertTrue(same(observed, q.get("expected")), () -> "expected " + q.get("expected") + ", observed " + observed + "\n" + q.get("sql"));
                }
            }));
    }

    /** synthy's comparison: numbers within 1e-9, booleans and text by value. */
    static boolean same(Object observed, Object expected) {
        if (observed == null) return false;
        if (expected instanceof Number e) return observed instanceof Number o ? Math.abs(o.doubleValue() - e.doubleValue()) < 1e-9 : String.valueOf(observed).equals(String.valueOf(expected));
        return String.valueOf(observed).equals(String.valueOf(expected));
    }
}
```

The path is relative to the module root, which is Maven's and Gradle's working directory for tests.

## Loaders

Read the fixtures through the same DuckDB connection: it already has every table with its types.

```java
/** Rows of a fixture table as domain objects, through the domain's own factories. */
static List<Order> orders(Connection db) throws SQLException {
    var out = new ArrayList<Order>();
    try (var st = db.createStatement(); var rs = st.executeQuery("SELECT * FROM \"Order\"")) {
        while (rs.next()) {
            out.add(Order.rehydrate(                                   // whatever domain-build-code generated
                new OrderId(UUID.fromString(rs.getString("id"))),
                new Money(new BigDecimal(rs.getString("totalAmount_amount")), rs.getString("totalAmount_currency")),
                OrderStatus.valueOf(rs.getString("status")),
                new CustomerId(UUID.fromString(rs.getString("customer_id"))),
                rs.getObject("placedAt", LocalDateTime.class)));
        }
    }
    return out;
}
```

- Decimals are `DOUBLE` in `load.sql`; read them with `getString` and `new BigDecimal(...)` to keep
  the cents exact.
- Datetimes are UTC without a zone: `getObject(col, LocalDateTime.class)`, then `atOffset(UTC)` when
  the domain uses `Instant`.
- State columns hold the enum literal of the domain (`delivered`); map to the Java enum with the
  naming the generated code used.
- `manifest.json` tells which column is which: `path` for value-type members, `role: "fk"` with
  `target` for references, `role: "state"` for the state.

## Refused commands

A sketch: the operation, the rehydration functions and the rejection type are whatever the generated
code calls them; `query` returns rows as maps of strings.

```java
@TestFactory
Stream<DynamicTest> refusedCommandsAreRefused() throws Exception {
    var rows = query("SELECT * FROM \"synthy_rejections\" WHERE about = 'Order'");
    return rows.stream().map(r -> DynamicTest.dynamicTest(r.get("command") + " on " + r.get("about_id") + " in " + r.get("state"), () -> {
        Order order = orderAsOf(UUID.fromString(r.get("about_id")), r.get("state"));            // rehydrated in that state
        Payment payment = paymentAsOf(order.id(), Timestamp.valueOf(r.get("at")));              // every row the condition reads, as of `at`
        var ex = assertThrows(DomainRejection.class, () -> order.confirm(new ConfirmOrder(order.id()), payment));
        assertEquals(r.get("reason"), ex.getMessage());
    }));
}
```

The state of a related row at `at`:
`SELECT arg_max(to_state, at) FROM synthy_transitions WHERE entity = ? AND entity_id = ? AND at <= ?`.

## Spring integration tests

The certificate harness needs no Spring context. For repository or API tests, save loaded aggregates
through the repositories in a `@DataJpaTest` or `@SpringBootTest` setup; synthy's tables are not the
JPA schema, so do not `@Sql`-load them directly.

## Regeneration

`scripts/fixtures-regen.sh`:

```sh
#!/bin/sh -e
synthy generate src/test/synthy/scenario.synth --out target/synthy-out
synthy export target/synthy-out --to files --dest src/test/resources/synthy
```
