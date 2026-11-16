import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  // os testes de integração usam um arquivo SQLite temporário, nunca o Turso
  test: { env: { TURSO_DATABASE_URL: `file:${join(mkdtempSync(join(tmpdir(), "xadrez-")), "teste.db")}`, TURSO_AUTH_TOKEN: "" } },
});
