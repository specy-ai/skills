# Extraction Heuristics — Index

During Phase 1 (Reconnaissance), identify the project's language and framework, then load the relevant heuristic files.

## Always load

| File | Content |
|---|---|
| `heuristics/generic.md` | Language-agnostic naming patterns, type mapping, services, repositories |

## Load by detected stack

| Detection signal | File |
|---|---|
| `.java`, `pom.xml`, `build.gradle`, `@SpringBootApplication`, `@Entity` | `heuristics/java-spring.md` |
| `.ts`, `.tsx`, `package.json` + `@nestjs/*`, `tsconfig.json` | `heuristics/typescript-nestjs.md` |
| `.clj`, `.cljs`, `deps.edn`, `project.clj`, `lein` | `heuristics/clojure.md` |

If no specific stack is detected, rely on `generic.md` only.

If the project uses a stack not listed here, apply `generic.md` patterns and adapt based on the framework's conventions. Annotate non-obvious mappings with `// NOTE: inferred from {pattern}`.
