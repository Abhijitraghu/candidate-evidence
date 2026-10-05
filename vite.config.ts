import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Only the public deployment address is made available to the browser.
  const env = loadEnv(mode, process.cwd(), "CONVEX_URL");
  return {
    define: { "import.meta.env.VITE_CONVEX_URL": JSON.stringify(process.env.VITE_CONVEX_URL ?? env.CONVEX_URL ?? "") },
    server: { host: "127.0.0.1", port: 5173, strictPort: true, fs: { deny: [".env", ".env.*", "**/test-cvs/**", "**/.git/**", "**/.local-checks/**", "**/test-results/**", "**/.impeccable/review/**"] } },
  };
});
