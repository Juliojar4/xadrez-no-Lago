import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Os testes de integração usam o Supabase local (chaves do .env.local); sem ele, são pulados.
try {
  process.loadEnvFile(".env.local");
} catch {}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // fora do Next, o `server-only` lança erro; nos testes ele vira um módulo vazio
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: { fileParallelism: false },
});
