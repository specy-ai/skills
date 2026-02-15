# Plan Specy Skills

## Contexte

Specy est un outil de modélisation DDD (Domain-Driven Design) qui aide les architectes et les équipes métier à formaliser la logique métier d'une application.

### Le problème

Le code source d'une application contient sa logique métier, mais celle-ci est dispersée, mélangée aux préoccupations techniques, et impossible à questionner directement. Un PO ne peut pas demander "que se passe-t-il si un client suspendu passe commande ?" sans qu'un développeur fouille le code. Et quand on spécifie de nouvelles fonctionnalités, personne ne détecte les contradictions avec l'existant avant l'implémentation.

### L'approche

Specy extrait la logique métier du code sous forme de deux modèles complémentaires :

- **Modèle structurel** (`.struct`) — le vocabulaire du domaine : entités, value objects, commandes, événements, avec leurs champs, types et contraintes. C'est le "quoi".
- **Modèle d'interaction** (`.flow`) — les comportements : qui déclenche quoi, sous quelles conditions, avec quels effets et quels événements émis. C'est le "comment ça se comporte".

La séparation en deux fichiers est délibérée. Le `.flow` **référence** le `.struct` via une directive `uses`. Toute référence dans le `.flow` (type, champ, valeur d'enum) DOIT exister dans le `.struct`. Cette contrainte rend les contradictions et les trous **mécaniquement détectables** par simple résolution de noms — pas besoin de compilateur, un LLM ou un parseur trivial suffit.

### Pourquoi des skills

On distribue Specy sous forme de skills (Claude Code, Cursor, etc.) plutôt que comme un outil standalone. Ça permet d'être directement là où les développeurs travaillent, sans friction d'installation, et de bénéficier des capacités de navigation de code du LLM.

### Les trois skills

1. **`distill`** — Reverse-engineer le code en `.struct` + `.flow`. C'est le point d'entrée : on part de l'existant.
2. **`dialogue`** — Explorer et questionner le domaine en langage naturel, en s'appuyant sur les modèles extraits. Le métier peut enfin interroger la logique sans lire du code.
3. **`spec`** — Formaliser des spécifications métier en les confrontant aux modèles existants. Produit un fichier `.spec` structuré qui capture l'analyse (contradictions, trous, impacts) et les modifications projetées — sans jamais toucher aux `.struct` / `.flow` qui restent la source de vérité du code.

### Grammaires

Chaque skill s'appuie sur deux grammaires formelles en EBNF (`struct.ebnf` et `flow.ebnf`) qui définissent la syntaxe exacte des fichiers. Ces grammaires servent à la fois de spec pour le LLM (il sait quoi produire) et de contrat de validation (on peut vérifier la conformité structurellement).

## Structure cible

```
specy/
├── grammars/
│   ├── struct.ebnf          # Grammaire formelle du .struct
│   └── flow.ebnf            # Grammaire formelle du .flow
├── examples/
│   ├── orders.struct         # Exemple de référence
│   └── orders.flow           # Exemple de référence
├── specs/                    # Fichiers .spec produits par le skill spec
│   ├── 001_deliver-order.spec
│   └── done/                 # Specs réalisées (archivées après distill)
│       └── 000_initial-setup.spec
└── skills/
    ├── distill/
    │   └── SKILL.md          # Reverse engineering code → .struct + .flow
    ├── dialogue/
    │   └── SKILL.md          # Dialogue exploratoire avec le domaine
    └── spec/
        └── SKILL.md          # Formalisation de specs → .spec
```

## Étapes

### Étape 1 — Grammaires fondatrices ✅

Objectif : poser les deux EBNF qui servent de référence à toutes les skills.

1. ✅ Finaliser `struct.ebnf` — entities, values, commands, events, enums, contraintes
2. ✅ Finaliser `flow.ebnf` — interactions, reactions, policies, invariants
3. ✅ Écrire `examples/orders.struct` et `examples/orders.flow` comme cas de référence complet (un domaine e-commerce simple : Customer, Order, Payment)

Critère de done : les deux exemples sont cohérents entre eux (chaque ref du .flow existe dans le .struct). ✅

**Résultat de la validation croisée :**
- 0 références cassées — chaque type, valeur d'enum et dot-path du `.flow` résout dans le `.struct`
- 100% de couverture de la grammaire struct (7 primitives, `list<>`/`set<>`, 14 contraintes)
- ~90% de couverture de la grammaire flow (tous les blocs, opérateurs booléens, 6/6 opérateurs de comparaison, `in`/`not in`, `is defined`/`is not defined`, expressions parenthésées, arithmétique `*`, 6/7 fonctions built-in)
- Gaps mineurs restants : opérateurs arithmétiques `+`/`-`/`/` et fonction `size()` (couverte fonctionnellement par `count()`)

**Fichiers livrés :**
- `specy/grammars/struct.ebnf` — 5 types de définition, 7 primitives, 2 collections, 14 contraintes
- `specy/grammars/flow.ebnf` — 4 types de blocs, système d'expressions complet avec arithmétique
- `specy/examples/orders.struct` — 4 enums, 3 value objects, 5 entités, 6 commandes, 7 événements
- `specy/examples/orders.flow` — 6 interactions, 4 réactions, 5 policies, 5 invariants

### Étape 2 — Skill `distill`

Objectif : reverse-engineer du code en .struct et .flow.

Le SKILL.md doit contenir :

1. **Rôle** — "Tu es un expert DDD qui extrait la logique métier depuis du code existant"
2. **Workflow en 4 phases** :
    - Reconnaissance : explorer la structure du projet, identifier modèles/handlers/events
    - Extraction struct : produire le .struct (types, entités, enums, value objects)
    - Extraction flow : produire le .flow (interactions, réactions, policies)
    - Validation croisée : vérifier que tout ref du .flow existe dans le .struct
3. **Mode création** : génère les fichiers de zéro dans `specy/` à la racine du projet
4. **Mode mise à jour** : si des fichiers .struct/.flow existent déjà, les lire d'abord, montrer les diffs proposés, demander confirmation avant d'écrire
5. **Heuristiques d'extraction** par langage/framework :
    - Java/Spring : @Entity → entity, @Value → value, Command/Handler → command+interaction, @EventListener → reaction
    - TypeScript/NestJS : class + decorators
    - Clojure : defrecord, spec, multimethods
    - Générique : patterns nommés (Service, Repository, Handler, Saga)
6. **Référence** : inclure la grammaire EBNF en annexe du SKILL.md (ou la référencer)
7. **Règle clé** : ne jamais inventer de logique métier absente du code. Marquer les zones d'incertitude avec `// UNCLEAR: ...`

### Étape 3 — Skill `dialogue`

Objectif : explorer le domaine en conversation, en s'appuyant sur les .struct et .flow existants.

Le SKILL.md doit contenir :

1. **Rôle** — "Tu es un facilitateur DDD qui aide à comprendre et questionner un domaine existant"
2. **Pré-requis** : lire les fichiers .struct et .flow du projet avant de répondre
3. **Modes de dialogue** :
    - **Explorer** : "Explique-moi le domaine Order" → synthèse depuis .struct + .flow, en langage métier
    - **Questionner** : "Que se passe-t-il si un client suspendu passe commande ?" → le LLM trace le chemin dans le .flow et répond
    - **Confronter** : "Un client devrait pouvoir annuler après expédition" → le LLM détecte la contradiction avec les preconditions existantes
    - **Compléter** : "Il manque quoi ?" → lister les commands sans interaction, events sans réaction, entités sans interaction
4. **Format de réponse** : toujours ancrer les réponses dans les modèles avec des citations précises (`Order.status in {draft, confirmed}`)
5. **Règle clé** : ne jamais affirmer un comportement qui n'est pas dans les modèles. Distinguer explicitement "le modèle dit" vs "le modèle ne dit rien sur ce cas"

### Étape 4 — Skill `spec`

Objectif : formaliser des spécifications métier en les confrontant aux modèles existants, et produire un fichier `.spec` structuré.

**Principe fondamental :** `spec` ne modifie jamais les `.struct` / `.flow`. Ces fichiers sont la source de vérité du code, maintenue par `distill`. Le résultat de `spec` est un fichier `.spec` — un artefact de spécification qui capture l'analyse et les modifications projetées. La boucle est : `spec` produit le `.spec` → le dev implémente le code → `distill` met à jour les modèles.

Le SKILL.md doit contenir :

1. **Rôle** — "Tu es un analyste qui formalise des spécifications métier et les valide contre les modèles existants"
2. **Workflow en 5 phases** :
    - Étape 1 — Décomposition : identifier les concepts (entités, commandes, events) impliqués
    - Étape 2 — Ancrage : mapper chaque concept vers le modèle existant (`[existing]`, `[new]`, `[ambiguous]`)
    - Étape 3 — Confrontation : vérifier la cohérence (`compatible`, `contradiction`, `impact`, `gap`, `coverage`)
    - Étape 4 — Proposition : générer le fichier `.spec` avec les modifications projetées en syntaxe Specy native (`add`, `modify`, `remove`)
    - Étape 5 — Confirmation : attendre validation avant d'écrire le `.spec`
3. **Format `.spec` structuré** avec les blocs :
    - `spec` + `against` (nom, version du modèle via `gitSha` + `lastRun` de `.meta.json`)
    - `narrative` — l'exigence d'origine en prose
    - `concepts` — inventaire des concepts impliqués avec leur ancrage
    - `confrontation` — résultats de la vérification
    - `changes` — modifications projetées en syntaxe Specy native
    - `impact` — analyse d'impact sur les constructs existants
4. **Types de validation** :
    - Complétude : la spec couvre-t-elle tous les cas (happy path + erreurs) ?
    - Cohérence : la spec contredit-elle des règles existantes ?
    - Couverture : les events émis sont-ils consommés quelque part ?
    - Nommage : les termes utilisés sont-ils cohérents avec le vocabulaire existant ?
    - Typage : chaque typeName, dotPath et field résout dans le .struct ?
5. **Conventions de fichier** :
    - Dossier : `specy/specs/`
    - Nommage : `{NNN}_{kebab-case-name}.spec` (numéro auto-incrémenté sur 3 digits)
    - Cycle de vie : active → réalisée (ajout d'une ligne `realized version "..." at "..."` + déplacement dans `specy/specs/done/`)
6. **Règle clé** : ne jamais toucher aux `.struct` / `.flow` — toujours montrer l'impact sur les interactions existantes quand on modifie le .struct dans les `changes` projetés

### Étape 5 — Test end-to-end

1. Prendre un petit projet open-source (ex: un TODO app Spring Boot, ou un mini e-commerce)
2. Exécuter `distill` → vérifier que les .struct/.flow générés sont cohérents
3. Exécuter `dialogue` → poser 5 questions sur le domaine, vérifier que les réponses sont ancrées
4. Exécuter `spec` → soumettre une user story, vérifier que les contradictions sont détectées
5. Itérer sur les skills en fonction des résultats

## Ordre d'exécution recommandé

```
1. ✅ grammars/struct.ebnf + flow.ebnf
2. ✅ examples/orders.struct + orders.flow
3. skills/distill/SKILL.md
4. Test distill sur un vrai projet
5. skills/dialogue/SKILL.md
6. skills/spec/SKILL.md
7. Test end-to-end
```

Les étapes 1-2 sont le socle. Ne pas passer à 3 sans exemples validés.

## Prochaine étape

**Étape 2 — Skill `distill`** : créer `specy/skills/distill/SKILL.md` avec le workflow de reverse-engineering code vers `.struct` + `.flow`.