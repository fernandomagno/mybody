import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { parseCookie as parseCookies } from "cookie";
import { DatabaseSync } from "node:sqlite";
import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { validateExam } from "../src/domain.ts";

const deriveKey = promisify(scrypt);
const sessionLifetime = 8 * 60 * 60 * 1000;
const cookieName = "linha_session";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(12).max(128);
const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    consent: z.literal(true),
  })
  .strict();
const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(128) })
  .strict();
const recoverySchema = z
  .object({
    email: emailSchema,
    recoveryCode: z.string().min(40).max(100),
    password: passwordSchema,
  })
  .strict();

async function passwordHash(password, salt = randomBytes(16).toString("hex")) {
  const derived = await deriveKey(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const encoded = stored ?? `${"0".repeat(32)}:${"0".repeat(128)}`;
  const calculated = await passwordHash(password, encoded.split(":")[0]);
  return (
    timingSafeEqual(
      Buffer.from(calculated.split(":")[1], "hex"),
      Buffer.from(encoded.split(":")[1], "hex"),
    ) && Boolean(stored)
  );
}

export function createApp({
  databasePath = resolve(
    fileURLToPath(new URL("../data/linha.sqlite", import.meta.url)),
  ),
  origins = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:3001",
    "http://localhost:3001",
  ],
  secureCookies = false,
  serveFrontend = false,
  trustProxy = false,
} = {}) {
  if (databasePath !== ":memory:")
    mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec(
    "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA secure_delete = ON; PRAGMA busy_timeout = 5000;",
  );
  const version = database.prepare("PRAGMA user_version").get().user_version;
  if (version > 1) {
    database.close();
    throw new Error("Versao do banco nao suportada por este servidor.");
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      recovery_hash TEXT NOT NULL,
      consent_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT;
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      payload TEXT NOT NULL CHECK (json_valid(payload) AND length(payload) <= 524288),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT;
    CREATE INDEX IF NOT EXISTS exams_user_created ON exams(user_id, created_at);
    PRAGMA user_version = 1;
  `);
  const app = express();
  app.disable("x-powered-by");
  if (trustProxy) app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'"],
          workerSrc: ["'self'", "blob:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
      strictTransportSecurity: secureCookies ? undefined : false,
    }),
  );
  const allowedOrigins = new Set(
    origins.map((origin) => new URL(origin).origin),
  );
  app.use("/api", (request, response, next) => {
    response.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      if (!allowedOrigins.has(request.headers.origin))
        return response.status(403).json({ error: "Origem nao autorizada." });
      if (
        ["POST", "PUT", "PATCH"].includes(request.method) &&
        Number(request.headers["content-length"] ?? 0) > 0 &&
        !request.is("application/json")
      )
        return response.status(415).json({ error: "Envie dados em JSON." });
    }
    next();
  });
  app.use("/api", express.json({ limit: "512kb" }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 600,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Muitas requisicoes. Aguarde um minuto." },
    }),
  );
  const authLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.",
    },
  });

  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict",
    secure: secureCookies,
    path: "/",
    maxAge: sessionLifetime,
  };
  function tokenFromRequest(request) {
    const token = parseCookies(request.headers.cookie ?? "")[cookieName];
    return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token)
      ? token
      : null;
  }
  function createSession(request, response, user) {
    const previous = tokenFromRequest(request);
    if (previous)
      database
        .prepare("DELETE FROM sessions WHERE token_hash = ?")
        .run(hash(previous));
    database
      .prepare("DELETE FROM sessions WHERE expires_at <= ?")
      .run(Date.now());
    const token = randomBytes(32).toString("base64url");
    database
      .prepare(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
      )
      .run(hash(token), user.id, Date.now() + sessionLifetime);
    response.cookie(cookieName, token, cookieOptions);
  }
  function authenticated(request, response, next) {
    const token = tokenFromRequest(request);
    const user = token
      ? database
          .prepare(
            "SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?",
          )
          .get(hash(token), Date.now())
      : null;
    if (!user)
      return response
        .status(401)
        .json({ error: "Sua sessao expirou. Entre novamente." });
    request.user = user;
    next();
  }

  app.get("/api/health", (_request, response) => {
    database.prepare("SELECT 1").get();
    response.json({ ok: true, storage: "sqlite" });
  });
  app.get("/api/auth/me", authenticated, (request, response) =>
    response.json({ user: request.user }),
  );
  app.post("/api/auth/register", authLimit, async (request, response) => {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success)
      return response
        .status(400)
        .json({
          error:
            "Informe um e-mail valido, senha de 12 a 128 caracteres e aceite o armazenamento local.",
        });
    const { email, password } = parsed.data;
    const encoded = await passwordHash(password);
    if (database.prepare("SELECT id FROM users WHERE email = ?").get(email))
      return response
        .status(409)
        .json({
          error:
            "Nao foi possivel criar a conta com estes dados. Tente entrar ou recuperar o acesso.",
        });
    const user = { id: randomUUID(), email };
    const recoveryCode = randomBytes(32).toString("base64url");
    database
      .prepare(
        "INSERT INTO users (id, email, password_hash, recovery_hash, consent_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        user.id,
        email,
        encoded,
        hash(recoveryCode),
        new Date().toISOString(),
      );
    createSession(request, response, user);
    response.status(201).json({ user, recoveryCode });
  });
  app.post("/api/auth/login", authLimit, async (request, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success)
      return response
        .status(400)
        .json({ error: "Informe e-mail e senha validos." });
    const user = database
      .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
      .get(parsed.data.email);
    if (!(await verifyPassword(parsed.data.password, user?.password_hash)))
      return response
        .status(401)
        .json({ error: "E-mail ou senha incorretos." });
    const publicUser = { id: user.id, email: user.email };
    createSession(request, response, publicUser);
    response.json({ user: publicUser });
  });
  app.post("/api/auth/logout", (request, response) => {
    const token = tokenFromRequest(request);
    if (token)
      database
        .prepare("DELETE FROM sessions WHERE token_hash = ?")
        .run(hash(token));
    response.clearCookie(cookieName, {
      httpOnly: true,
      sameSite: "strict",
      secure: secureCookies,
      path: "/",
    });
    response.status(204).end();
  });
  app.post("/api/auth/recover", authLimit, async (request, response) => {
    const parsed = recoverySchema.safeParse(request.body);
    if (!parsed.success)
      return response
        .status(400)
        .json({
          error:
            "Informe o e-mail, codigo de recuperacao e uma nova senha de 12 a 128 caracteres.",
        });
    const user = database
      .prepare("SELECT id, email, recovery_hash FROM users WHERE email = ?")
      .get(parsed.data.email);
    const supplied = hash(parsed.data.recoveryCode.trim());
    const valid =
      timingSafeEqual(
        Buffer.from(supplied, "hex"),
        Buffer.from(user?.recovery_hash ?? "0".repeat(64), "hex"),
      ) && Boolean(user);
    const encoded = await passwordHash(parsed.data.password);
    if (!valid)
      return response
        .status(401)
        .json({ error: "E-mail ou codigo de recuperacao incorretos." });
    const recoveryCode = randomBytes(32).toString("base64url");
    database.exec("BEGIN IMMEDIATE");
    try {
      const result = database
        .prepare(
          "UPDATE users SET password_hash = ?, recovery_hash = ? WHERE id = ? AND recovery_hash = ?",
        )
        .run(encoded, hash(recoveryCode), user.id, supplied);
      if (!result.changes) {
        database.exec("ROLLBACK");
        return response
          .status(401)
          .json({ error: "Codigo de recuperacao ja utilizado." });
      }
      database.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    const publicUser = { id: user.id, email: user.email };
    createSession(request, response, publicUser);
    response.json({ user: publicUser, recoveryCode });
  });

  app.get("/api/exams", authenticated, (request, response) => {
    const exams = database
      .prepare(
        "SELECT payload FROM exams WHERE user_id = ? ORDER BY created_at, id",
      )
      .all(request.user.id)
      .map((row) => JSON.parse(row.payload));
    response.json({ exams });
  });
  app.post("/api/exams", authenticated, (request, response) => {
    let exam;
    try {
      exam = validateExam(request.body);
    } catch (error) {
      return response.status(400).json({ error: error.message });
    }
    if (!z.uuid().safeParse(exam.id).success)
      return response
        .status(400)
        .json({ error: "Identificador de exame invalido." });
    const payload = JSON.stringify(exam);
    if (Buffer.byteLength(payload) > 524288)
      return response
        .status(413)
        .json({ error: "Exame excede o tamanho permitido." });
    if (database.prepare("SELECT 1 FROM exams WHERE id = ?").get(exam.id))
      return response
        .status(409)
        .json({
          error: "Nao foi possivel salvar este registro. Tente novamente.",
        });
    database
      .prepare("INSERT INTO exams (id, user_id, payload) VALUES (?, ?, ?)")
      .run(exam.id, request.user.id, payload);
    response.status(201).json({ exam });
  });
  app.delete("/api/exams/:id", authenticated, (request, response) => {
    const result = database
      .prepare("DELETE FROM exams WHERE id = ? AND user_id = ?")
      .run(request.params.id, request.user.id);
    if (!result.changes)
      return response
        .status(404)
        .json({ error: "Exame nao encontrado na sua conta." });
    response.status(204).end();
  });
  app.use("/api", (_request, response) =>
    response.status(404).json({ error: "Endpoint nao encontrado." }),
  );
  if (serveFrontend)
    app.use(
      express.static(fileURLToPath(new URL("../dist", import.meta.url)), {
        index: "index.html",
        setHeaders: (response) => response.set("Cache-Control", "no-store"),
      }),
    );
  app.use((error, _request, response, _next) => {
    if (error.type === "entity.too.large")
      return response
        .status(413)
        .json({ error: "Dados excedem o tamanho permitido." });
    if (error.type === "entity.parse.failed")
      return response.status(400).json({ error: "JSON invalido." });
    response
      .status(500)
      .json({
        error: "Nao foi possivel concluir a operacao. Tente novamente.",
      });
  });
  return { app, close: () => database.close() };
}
