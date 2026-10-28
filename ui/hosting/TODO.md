# Navigator hébergé — ce qu'il reste à faire

État au 2026-10-26. Les étapes 1, 3 et 4 du plan (`proposals/navigator-hosting.md`, §12.10)
sont codées, testées en local et commitées (`c067c78`, `917ad3c`). Rien de tout cela ne
tourne encore sur `app.specy.ai` : le seul déploiement est celui de l'étape 1, sous l'ancien
nom `specy-navigator`.

## Côté Jérémie — compte Cloudflare et mise en ligne

Dans l'ordre ; les points 1 à 5 sont les prérequis du premier `npm run deploy`.

- [ ] **1. Namespace KV.** Depuis `ui/hosting/` : `npx wrangler kv namespace create APP_AUTH`,
      puis coller l'id dans `kv_namespaces` de `wrangler.jsonc` (le placeholder bloque le déploiement).
      Aucun namespace n'existait dans les deux comptes au 2026-10-23 ; si vous en avez créé un
      sous un autre nom, son id suffit.
- [ ] **2. Zero Trust (étape 2 du plan).**
  - team domain `<team>.cloudflareaccess.com`, page de login nommée et brandée ;
  - fournisseurs : One-time PIN, Google, Microsoft Entra ID
    (redirect URI `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback`) ;
  - My Team › Lists : une liste **`app-readers`** de type *Email*, vide ;
  - Workers & Pages › **`specy-app`** › Access : protéger le Worker (production et previews),
    session 24 h, une politique *Allow* dont l'Include est cette liste.
    Le Worker n'existe qu'après le premier déploiement sous ce nom : faire le point 6 avant
    si le tableau de bord ne le liste pas, puis revenir ici ;
  - relever l'**AUD** dans l'Overview de l'application.
- [ ] **3. `wrangler.jsonc`** : `ACCESS_TEAM_DOMAIN` = `https://<team>.cloudflareaccess.com`,
      `ACCESS_AUD` = le tag AUD. Tant qu'ils sont vides, personne ne peut se connecter.
- [ ] **4. Bucket R2** : `npx wrangler r2 bucket create specy-models` (le déploiement échoue
      tant qu'il n'existe pas).
- [ ] **5. Jeton d'API** pour les scripts : My Profile › API Tokens › Create Token, custom,
      permissions de compte **Zero Trust: Edit** et **Access: Organizations, Identity Providers,
      and Groups: Revoke** ; exporté en `CLOUDFLARE_API_TOKEN` dans le shell qui lance les scripts.
      Jamais dans `wrangler.jsonc`, `.dev.vars` ni git.
- [ ] **6. Déployer** : `npm run deploy` (build, `check-deploy.sh`, `wrangler deploy`).
      Le nom du Worker ayant changé, cela crée `specy-app` sur `app.specy.ai` (le domaine
      personnalisé crée l'enregistrement DNS ; le nom doit être libre).
- [ ] **7. Supprimer l'ancien Worker** `specy-navigator` et son domaine `navigator.specy.ai`
      une fois `app.specy.ai` vérifié.
- [ ] **8. Premier client (étape 6).** Choisir l'identifiant du tenant et le slug de chaque
      organisation (`^[a-z0-9][a-z0-9-]{0,63}$`, par convention le nom `organization` du fichier),
      puis en remote :
      `create-tenant.sh --remote`, `invite.sh --remote` par lecteur (`--org` pour restreindre),
      `publish-models.sh --remote` pour les fichiers `.domain` / `.arch` / `.sysreq`.
- [ ] **9. Vérifier en vrai** après le déploiement : login Access → Navigator avec le menu
      utilisateur et les organisations publiées ; une adresse acceptée par Access mais sans
      enregistrement → page « no access » ; `revoke.sh --remote` → accès coupé en moins d'une minute.
- [ ] **Hors hébergement, dans l'arbre de travail** : les modifications non commitées de l'onglet
      Synthetic data (`ui/app.js`, `ui/index.html`, `ui/README.md`, `ui/hosting/README.md`,
      `ui/hosting/build.sh`) et les quatre `.dylib` tree-sitter ; cinq fichiers de conflit OneDrive
      à la racine de `ui/` à supprimer.

## Côté Claude — code

- [ ] **Étape 5 — CSP et en-têtes** dans `src/http.js`, en autorisant ce que l'onglet
      Synthetic data demande (`script-src 'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval'`,
      `worker-src 'self' blob:`, `connect-src 'self' https://cdn.jsdelivr.net`), sur toutes les
      réponses y compris la page 403 ; vérifier dans Chromium headless que le Navigator et
      l'onglet Synthetic data démarrent sans violation.
- [ ] **Étape 5 — tests** : compléter `test/worker.test.js` sur la liste de contrôle du §12.10
      (sans JWT → 403 assets compris ; lecteur `disabled` → 403 sans contenu de modèle ;
      grant par organisation sur listing et lecture ; en-têtes et CSP présents).
- [ ] **Étape 5 — journaux** : relire `src/` pour qu'aucun log ne porte d'e-mail ni de JWT.
- [ ] **Étape 5 — README** : passer l'étape 5 à « done » dans le tableau d'état, cocher la
      liste du §12.10 dans le doc de design.
- [ ] **Étape 6** : adapter si les fichiers du client révèlent un cas non prévu (nom
      d'organisation, taille des fichiers, extension) ; rien à coder a priori.

## À deux — première exécution réelle

- [ ] Le premier `invite.sh --remote` (point 8) est aussi le premier appel réel à l'API Zero
      Trust : `zero-trust.sh` n'a été testé que contre une API simulée. Le lancer avec le jeton
      du point 5 et, si quelque chose casse, me passer la sortie pour corriger le script.
- [ ] La vérification du point 9 : vous dans le navigateur, moi sur les tests et les logs
      Worker si un comportement diffère du local.
