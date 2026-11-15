import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // fora do Next, o `server-only` lança erro; nos testes ele vira um módulo vazio
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  // os testes de integração usam um SQLite em memória
  test: { env: { DATABASE_PATH: ":memory:" } },
});
