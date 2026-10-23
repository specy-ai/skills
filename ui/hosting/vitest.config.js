import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          // the development identity (src/access.js); tests drop it to exercise the other paths
          DEV_IDENTITY_EMAIL: "dev@example.com",
          // a pretend Access team whose key set the tests serve themselves (fetchMock)
          ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
          ACCESS_AUD: "test-aud",
        },
      },
    }),
  ],
});
