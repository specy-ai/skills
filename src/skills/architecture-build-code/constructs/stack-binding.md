### Stack-binding artifact (the C4 level-4 replacement)

The `.arch` model never names a language or framework beyond a container's coarse `technology` string. The
**stack-binding artifact** is the separate, swappable input that maps the logical model to one concrete
stack. It carries two mapping tables plus generation conventions. Represent it as a small YAML/EDN/JSON
file (`stack-binding.<ext>`) alongside the `.arch`; if the user has none, synthesize a default for the
chosen stack from the worked examples below and ask them to confirm it before generating.

**Required contents:**

1. **`stack`** — the target identifier (`java-spring` | `typescript-nestjs` | `clojure` | other).
2. **`type → language type`** — every Thrift primitive, container type, and structural kind mapped to a
   concrete language type / shape. Must cover all `.arch` primitives (`string`, `int`/`integer`, `long`,
   `double`, `decimal`, `boolean`, `date`, `datetime`, `time`, `instant`, `duration`, `uuid`, `binary`,
   `void`), the container types (`list<T>`, `set<T>`, `map<K,V>`), and the structural kinds (`struct`,
   `enum`, `union`, `typedef`, `exception`).
3. **`protocol → framework`** — every connector `over "<protocol>"` string mapped to the client +
   endpoint framework (and serializer) used to realize that transport; plus each broker `technology` (the
   container hosting a channel) mapped to its messaging framework.
4. **conventions** — root package/namespace, build tool, module/folder naming, deployment-manifest target
   (compose / k8s / Helm).

Any `.arch` type or protocol with no entry in these tables is **unmapped**: emit an `// UNCLEAR:` stub and
list it in `build-code.report` rather than guessing.

#### Worked default — `java-spring`

```yaml
stack: java-spring
conventions:
  rootPackage: com.example.shortlink
  build: gradle-multi-module      # one module per container
  deploy: kubernetes              # environment → k8s manifests
types:
  string:   java.lang.String
  int:      int            # integer → int
  integer:  int
  long:     long
  double:   double
  decimal:  java.math.BigDecimal
  boolean:  boolean
  date:     java.time.LocalDate
  datetime: java.time.LocalDateTime
  time:     java.time.LocalTime
  instant:  java.time.Instant
  duration: java.time.Duration
  uuid:     java.util.UUID
  binary:   byte[]
  void:     void
  list<T>:  java.util.List<T>
  set<T>:   java.util.Set<T>
  map<K,V>: java.util.Map<K,V>
  struct:   record                # immutable record, fields by ordinal order
  enum:     enum                  # constants carry their ordinal
  union:    sealed-interface      # one record per member (oneof)
  typedef:  record-newtype        # single-field wrapper record
  exception: RuntimeException-subclass
protocols:
  "REST/JSON":  { client: spring-webclient, endpoint: spring-webmvc-controller, codec: jackson }
  "gRPC":       { client: grpc-java-stub,    endpoint: grpc-java-service,        codec: protobuf }
  "Thrift":     { client: thrift-client,     endpoint: thrift-processor,         codec: thrift }
  "HTTPS":      { client: spring-webclient,  endpoint: spring-webmvc-controller, codec: jackson }
brokers:
  Kafka:   spring-kafka            # @KafkaListener consumers, KafkaTemplate producers
  RabbitMQ: spring-amqp
```

#### Worked default — `typescript-nestjs`

```yaml
stack: typescript-nestjs
conventions:
  rootNamespace: "@shortlink"
  build: nx-monorepo               # one app/lib per container
  deploy: docker-compose
types:
  string: string
  int: number            # integer → number
  integer: number
  long: bigint
  double: number
  decimal: string        # decimal.js / string to avoid float loss; NOTE the choice
  boolean: boolean
  date: string           # ISO date
  datetime: Date
  time: string
  instant: Date
  duration: string       # ISO-8601 duration
  uuid: string
  binary: Buffer
  void: void
  list<T>: "T[]"
  set<T>: "Set<T>"
  map<K,V>: "Map<K,V>"
  struct: interface       # or class with class-validator decorators on the DTO edge
  enum: enum
  union: discriminated-union
  typedef: branded-type   # `type Url = string & { __brand: 'Url' }`
  exception: Error-subclass   # maps to a Nest HttpException at the edge
protocols:
  "REST/JSON": { client: nest-httpservice-axios, endpoint: nest-controller, codec: json }
  "gRPC":      { client: nest-grpc-client,        endpoint: nest-grpc-controller, codec: protobuf }
  "HTTPS":     { client: nest-httpservice-axios,  endpoint: nest-controller,      codec: json }
brokers:
  Kafka:    nest-microservice-kafka
  RabbitMQ: nest-microservice-rmq
```

#### Worked default — `clojure`

```yaml
stack: clojure
conventions:
  rootNamespace: shortlink
  build: deps-edn-monorepo
  deploy: docker-compose
types:
  string: string
  int: long              # integer → long
  integer: long
  long: long
  double: double
  decimal: java.math.BigDecimal
  boolean: boolean
  date: java.time.LocalDate
  datetime: java.time.LocalDateTime
  time: java.time.LocalTime
  instant: java.time.Instant
  duration: java.time.Duration
  uuid: java.util.UUID
  binary: bytes
  void: nil
  list<T>: vector
  set<T>: set
  map<K,V>: map
  struct: malli-schema        # a map schema; field requiredness via :optional
  enum: keyword-enum          # [:enum :active :disabled :expired]
  union: malli-multi          # :multi / :or schema
  typedef: malli-alias
  exception: ex-info          # {:type ::slug-taken ...}
protocols:
  "REST/JSON": { client: hato, endpoint: reitit-ring, codec: jsonista }
  "gRPC":      { client: grpc-clj, endpoint: grpc-clj, codec: protobuf }
  "HTTPS":     { client: hato,   endpoint: reitit-ring, codec: jsonista }
brokers:
  Kafka:    jackdaw
  RabbitMQ: langohr
```
