/// <reference types="vite/client" />

// Vite bundles MapLibre's v6 worker as a self-contained URL for browser use.
declare module "*?worker&url" {
  const workerUrl: string;
  export default workerUrl;
}
