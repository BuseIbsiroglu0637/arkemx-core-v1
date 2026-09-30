/**
 * Start ARKEMX on this computer, without a GitHub Codespace or public server.
 * A one-time npm ci must have been completed while connected to the internet.
 * Some optional maps, remote media and third-party integrations still need a network.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteCli = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const minimum = [22, 13, 0];
const actual = process.versions.node.split(".").map(Number);
const supported = actual[0] > minimum[0] || (
  actual[0] === minimum[0] && actual[1] >= minimum[1]
);
if (!supported) {
  console.error("ARKEMX: Node.js 22.13.0 veya daha yeni bir sürüm kurun.");
  process.exit(1);
}
if (!existsSync(viteCli)) {
  console.error("ARKEMX: Bagimliliklar eksik. Ilk kez internet baglantisiyla 'npm ci' calistirin.");
  process.exit(1);
}
const localUrl = "http://127.0.0.1:5173/dijital-proje-merkezi";
const openBrowser = !process.argv.includes("--no-browser");
const logFolder = path.join(projectRoot, ".wrangler", "logs");
mkdirSync(logFolder, { recursive: true });

console.log("\nARKEMX YEREL DEMO");
console.log("Tarayici adresi: " + localUrl);
console.log("GitHub Codespaces veya yayinlanmis site gerekmiyor.");
console.log("Kapatmak icin bu pencerede Ctrl+C kullanin.\n");

const localConfig = path.join(projectRoot, "vite.local.config.mjs");
if (!existsSync(localConfig)) {
  console.error("ARKEMX: vite.local.config.mjs bulunamadi. Guncel yerel demo dosyalarini indirin.");
  process.exit(1);
}
const args = [viteCli, "--config", localConfig, "--host", "127.0.0.1", "--port", "5173", "--strictPort"];
if (openBrowser) args.push("--open", "/dijital-proje-merkezi");
const child = spawn(process.execPath, args, {
  cwd: projectRoot,
  env: {
    ...process.env,
    ARKEMX_LOCAL_DEMO: "1",
    ARKEMX_PROTOTYPE_DEMO_AUTH: "1",
    WRANGLER_WRITE_LOGS: "false",
    WRANGLER_LOG_PATH: logFolder,
    MINIFLARE_REGISTRY_PATH: path.join(projectRoot, ".wrangler", "registry"),
  },
  stdio: "inherit",
});
child.on("error", error => {
  console.error("Yerel demo baslatilamadi:", error.message);
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}
child.on("exit", (code, signal) => {
  if (code !== 0 && code !== null) process.exitCode = code;
  if (signal && signal !== "SIGINT" && signal !== "SIGTERM") {
    console.error("Yerel sunucu durdu:", signal);
    process.exitCode = 1;
  }
});
