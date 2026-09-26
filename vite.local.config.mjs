/**
 * ARKEMX standalone localhost preview.
 * Intentionally independent of .openai/hosting.json and build/sites-vite-plugin,
 * which are private hosting/build-system files absent from GitHub ZIP downloads.
 * Never use this config for public/production deployment.
 */
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      inspectorPort: false,
      config: {
        main: "./worker/index.ts",
        compatibility_flags: ["nodejs_compat"],
        d1_databases: [{
          binding: "DB",
          database_name: "arkemx-local-demo",
          database_id: "00000000-0000-4000-8000-000000000000",
        }],
        r2_buckets: [],
      },
    }),
  ],
});
