import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";
// Dentro do Codespaces o navegador acessa por HTTPS atras do proxy do GitHub.
const codespaceOrigin =
  process.env.CODESPACE_NAME && !process.env.APP_ORIGIN
    ? `https://${process.env.CODESPACE_NAME}-${port}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev"}`
    : undefined;
const appOrigin = process.env.APP_ORIGIN || codespaceOrigin;
const secureCookies =
  process.env.COOKIE_SECURE === "true" || Boolean(codespaceOrigin);
const databasePath = resolve(root, process.env.DB_PATH || "data/linha.sqlite");
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT invalida.");
if (
  !["127.0.0.1", "localhost", "::1"].includes(host) &&
  (!process.env.APP_ORIGIN ||
    !secureCookies ||
    !process.env.APP_ORIGIN.startsWith("https://"))
)
  throw new Error(
    "Acesso fora do computador exige APP_ORIGIN HTTPS e COOKIE_SECURE=true.",
  );
const options = {
  databasePath,
  secureCookies,
  serveFrontend: process.argv.includes("--serve"),
  trustProxy: Boolean(codespaceOrigin),
};
if (appOrigin) options.origins = [appOrigin];
const { app, close } = createApp(options);
const server = app.listen(port, host, () => {
  console.log(`Linha SQLite: http://${host}:${port}`);
  console.log(`Banco local: ${databasePath}`);
});
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Porta ${port} em uso. Encerre a outra API ou configure PORT.`
      : "Nao foi possivel iniciar a API.",
  );
  close();
  process.exitCode = 1;
});
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    close();
    process.exitCode = 0;
  });
  server.closeIdleConnections();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
