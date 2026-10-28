---
name: project-client-confidentiality
description: Reference pictures/material the user shares for Specy design work may contain client company names, real people and emails; examples written into the repo must be fictional
metadata:
  type: project
---

Reference material the user shares to motivate Specy language features (landscape diagrams, system sheets) can come from real client engagements. It may name client companies, real people and their emails. None of that goes into the repo: examples are fictional companies, contacts are role placeholders ("ERP product owner (Finance)"), and well-known product names (Salesforce, NetSuite, Kyriba…) are fine.

**Why:** the specy-skill repo is public-facing (examples feed the specy.ai site and tree-sitter smoke tests); client names leaking there is a confidentiality breach. Stated explicitly by the user for the arch level-0 work (2026-10-06).

**How to apply:** before finishing any example or doc derived from user-provided pictures, grep the written files for the client/person names seen in the material. Also vary the product set a little so the fictional landscape is not a copy of the client's.
