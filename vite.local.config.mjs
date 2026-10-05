/**
 * ARKEMX standalone localhost preview.
 * Intentionally independent of .openai/hosting.json and build/sites-vite-plugin,
 * which are private hosting/build-system files absent from GitHub ZIP downloads.
 * Never use this config for public/production deployment.
 */
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import { landBrowserLocalPlugin } from "./scripts/lib/land-browser-local-plugin.mjs";

const remoteD1Id = process.env.ARKEMX_REMOTE_D1_DATABASE_ID?.trim();
const remoteD1Name = process.env.ARKEMX_REMOTE_D1_DATABASE_NAME?.trim() || "arkemx-shared-demo";

export default defineConfig({
  define: {
    "process.env.ARKEMX_PROTOTYPE_DEMO_AUTH": JSON.stringify("1"),
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  plugins: [
    ...(process.env.ARKEMX_LOCAL_LAND_BROWSER === "1" ? [landBrowserLocalPlugin()] : []),
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      inspectorPort: false,
      config: {
        main: "./worker/index.ts",
        compatibility_flags: ["nodejs_compat"],
        d1_databases: [{
          binding: "DB",
          database_name: remoteD1Id ? remoteD1Name : "arkemx-local-demo",
          database_id: remoteD1Id || "00000000-0000-4000-8000-000000000000",
          ...(remoteD1Id ? { remote: true } : {}),
        }],
        r2_buckets: [],
      },
    }),
  ],
});

