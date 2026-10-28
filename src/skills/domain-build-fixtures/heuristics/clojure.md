# Fixtures heuristic — Clojure

## Destination and export

```
synthy export <out> --to edn --dest test/resources/synthy
```

The CSV tables and `load.sql` (for the certificate), plus Clojure data: `edn/<Entity>.edn` (a vector
of maps, one row per line) and `edn/questions.edn`.

In the EDN, keys are the column names as keywords (`:totalAmount_amount`, `:customer_id`); decimals
are BigDecimals (`371.94M`), ids `#uuid`, dates and datetimes `#inst` in UTC, nulls `nil`.
`clojure.edn/read-string` reads all of it with no extra readers.

## Dependencies (test alias)

```clojure
{:aliases
 {:test {:extra-paths ["test" "test/resources"]
         :extra-deps {org.duckdb/duckdb_jdbc {:mvn/version "1.5.6.0"}
                      io.github.cognitect-labs/test-runner {:git/tag "v0.5.1" :git/sha "dfb30dd"}}
         :jvm-opts ["--enable-native-access=ALL-UNNAMED"]
         :main-opts ["-m" "cognitect.test-runner"]}}}
```

Leiningen: `:profiles {:test {:dependencies [[org.duckdb/duckdb_jdbc "1.5.6.0"]] :jvm-opts ["--enable-native-access=ALL-UNNAMED"]}}`.

## Certificate harness

Verified on the orders example: 111 certificate assertions passing, Clojure 1.12, duckdb_jdbc
1.5.6.0. No JSON library needed.

```clojure
(ns <project>.synthy.certificate-test
  "The synthy certificate as tests: every hard question of edn/questions.edn,
  re-asked of the fixture CSVs with DuckDB. Re-export the fixtures
  (synthy export --to edn) rather than editing them."
  (:require [clojure.edn :as edn]
            [clojure.java.io :as io]
            [clojure.string :as str]
            [clojure.test :refer [deftest is testing]])
  (:import (java.sql DriverManager)))

(def fixtures (io/file "test/resources/synthy"))

(defn- same?
  "synthy's comparison: numbers within 1e-9, booleans and text by value."
  [expected observed]
  (cond
    (nil? observed) false
    (and (number? expected) (number? observed)) (< (Math/abs (- (double observed) (double expected))) 1e-9)
    :else (= (str expected) (str observed))))

(deftest certificate
  (with-open [db (DriverManager/getConnection "jdbc:duckdb:")]
    (with-open [st (.createStatement db)]
      (.execute st (str "SET file_search_path = '" (str/replace (.getAbsolutePath fixtures) "'" "''") "'"))
      ;; load.sql: one statement per line, comments start with --
      (doseq [line (str/split-lines (slurp (io/file fixtures "load.sql")))
              :when (not (or (str/blank? line) (str/starts-with? line "--")))]
        (.execute st line)))
    (doseq [{:keys [id tier sql expected description]} (edn/read-string (slurp (io/file fixtures "edn/questions.edn")))
            :when (= tier :hard)]
      (with-open [st (.createStatement db)
                  rs (.executeQuery st sql)]
        (let [observed (when (.next rs) (.getObject rs 1))]
          (testing (str id " " description)
            (is (same? expected observed) sql)))))))
```

## Loaders

```clojure
(defn rows [table]
  (edn/read-string (slurp (io/file fixtures "edn" (str table ".edn")))))

(defn ->order
  "A fixture row as the domain's order: through its constructor, so its specs run."
  [{:keys [id status totalAmount_amount totalAmount_currency customer_id placedAt]}]
  (order/rehydrate {:order/id id                                   ; whatever domain-build-code generated
                    :order/status (keyword status)
                    :order/total-amount {:money/amount totalAmount_amount :money/currency totalAmount_currency}
                    :order/customer-id customer_id
                    :order/placed-at placedAt}))

(deftest every-order-is-valid
  (doseq [row (rows "Order")]
    (is (s/valid? ::order/order (->order row)) (pr-str row))))     ; or malli's m/validate
```

`manifest.json` gives each column's `path` (value-type members), `role` and `target` (references).

## Refused commands

```clojure
(defn state-at
  "The state a row stood in at an instant: its last transition at or before it."
  [transitions entity id at]
  (->> transitions
       (filter #(and (= entity (:entity %)) (= (str id) (:entity_id %)) (not (pos? (compare (:at %) at)))))
       (sort-by :at)
       last
       :to_state))

(deftest refused-commands-are-refused
  (let [transitions (rows "synthy_transitions")]
    (doseq [{:keys [command about about_id state at reason]} (rows "synthy_rejections")
            :when (= about "Order")]
      (testing (str command " on " about_id " in " state)
        (is (thrown-with-msg? clojure.lang.ExceptionInfo (re-pattern (java.util.regex.Pattern/quote reason))
              (order/confirm (order-in about_id state) (payment-as-of transitions about_id at))))))))
```

A sketch: names depend on the generated code. `#inst` values compare with `compare`.

## Regeneration

`bb.edn`:

```clojure
{:tasks {fixtures:regen (do (shell "synthy generate test/synthy/scenario.synth --out target/synthy-out")
                            (shell "synthy export target/synthy-out --to edn --dest test/resources/synthy"))}}
```
