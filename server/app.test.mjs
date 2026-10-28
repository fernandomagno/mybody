import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "./app.mjs";

test("SQLite: contas, isolamento, sessoes, recuperacao e persistencia", async () => {
  const directory = mkdtempSync(join(tmpdir(), "linha-test-"));
  const databasePath = join(directory, "test.sqlite");
  let instance;
  let server;
  let base;
  async function start() {
    instance = createApp({ databasePath });
    server = instance.app.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    await new Promise((resolve) => server.close(resolve));
    instance.close();
  }
  async function request(
    path,
    { method = "GET", body, cookie, origin = "http://127.0.0.1:5173" } = {},
  ) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return {
      status: response.status,
      data: text ? JSON.parse(text) : null,
      cookie: response.headers.get("set-cookie")?.split(";")[0],
      headers: response.headers,
    };
  }
  const emailA = "a@example.test";
  const emailB = "b@example.test";
  const password = "fictitious-test-password-2026";
  try {
    await start();
    assert.equal((await request("/health")).data.storage, "sqlite");
    assert.equal((await request("/exams")).status, 401);
    assert.equal(
      (
        await request("/auth/register", {
          method: "POST",
          origin: "https://evil.example",
          body: { email: emailA, password, consent: true },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request("/auth/register", {
          method: "POST",
          body: { email: emailA, password: "short", consent: true },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/auth/register", {
          method: "POST",
          body: { email: emailA, password, consent: false },
        })
      ).status,
      400,
    );
    const accountA = await request("/auth/register", {
      method: "POST",
      body: { email: emailA, password, consent: true },
    });
    const accountB = await request("/auth/register", {
      method: "POST",
      body: { email: emailB, password, consent: true },
    });
    assert.equal(accountA.status, 201);
    assert.equal(accountB.status, 201);
    assert.match(accountA.headers.get("set-cookie"), /HttpOnly/i);
    assert.match(accountA.headers.get("set-cookie"), /SameSite=Strict/i);
    assert.equal(
      (
        await request("/auth/login", {
          method: "POST",
          body: { email: emailA, password: "wrong-password" },
        })
      ).status,
      401,
    );
    const exam = {
      id: randomUUID(),
      date: "2026-10-28",
      laboratory: "Ficticio",
      filename: "",
      readings: [
        {
          id: randomUUID(),
          name: "Glicose",
          value: 91,
          unit: "mg/dL",
          reference: "Exemplo",
        },
        {
          id: randomUUID(),
          name: "FSH",
          value: "Inferior a 0,5",
          unit: "mUI/mL",
          reference: "Exemplo",
        },
        {
          id: randomUUID(),
          name: "FAN - Nucleo",
          value: "Nao Reagente",
          unit: "qualitativo",
          reference: "Nao Reagente",
        },
      ],
    };
    assert.equal(
      (
        await request("/exams", {
          method: "POST",
          body: exam,
          cookie: accountA.cookie,
        })
      ).status,
      201,
    );
    assert.equal(
      (await request("/exams", { cookie: accountA.cookie })).data.exams.length,
      1,
    );
    assert.equal(
      (await request("/exams", { cookie: accountA.cookie })).data.exams[0]
        .readings[1].value,
      "Inferior a 0,5",
    );
    assert.equal(
      (await request("/exams", { cookie: accountA.cookie })).data.exams[0]
        .readings[2].value,
      "Nao Reagente",
    );
    assert.equal(
      (await request("/exams", { cookie: accountB.cookie })).data.exams.length,
      0,
    );
    assert.equal(
      (
        await request(`/exams/${exam.id}`, {
          method: "DELETE",
          cookie: accountB.cookie,
        })
      ).status,
      404,
    );
    assert.equal(
      (await request("/exams", { cookie: accountA.cookie })).data.exams.length,
      1,
    );
    const forged = {
      ...exam,
      id: randomUUID(),
      user_id: accountA.data.user.id,
    };
    assert.equal(
      (
        await request("/exams", {
          method: "POST",
          body: forged,
          cookie: accountB.cookie,
        })
      ).status,
      201,
    );
    assert.equal(
      (await request("/exams", { cookie: accountB.cookie })).data.exams.length,
      1,
    );
    assert.equal(
      (await request("/exams", { cookie: accountA.cookie })).data.exams.length,
      1,
    );
    assert.equal(
      (
        await request("/exams", {
          method: "POST",
          body: { ...exam, date: "2026-02-31" },
          cookie: accountA.cookie,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/exams", {
          method: "POST",
          body: { ...exam, readings: [exam.readings[0], exam.readings[0]] },
          cookie: accountA.cookie,
        })
      ).status,
      400,
    );
    await stop();
    const inspector = new DatabaseSync(databasePath);
    const stored = inspector
      .prepare("SELECT password_hash, recovery_hash FROM users WHERE email = ?")
      .get(emailA);
    assert.notEqual(stored.password_hash, password);
    assert.notEqual(stored.recovery_hash, accountA.data.recoveryCode);
    assert.equal(
      inspector
        .prepare("SELECT token_hash FROM sessions")
        .get()
        .token_hash.includes(accountA.cookie.split("=")[1]),
      false,
    );
    inspector.close();
    await start();
    assert.equal(
      (await request("/exams", { cookie: accountA.cookie })).data.exams.length,
      1,
    );
    const recovered = await request("/auth/recover", {
      method: "POST",
      body: {
        email: emailA,
        password: `${password}-new`,
        recoveryCode: accountA.data.recoveryCode,
      },
    });
    assert.equal(recovered.status, 200);
    assert.notEqual(recovered.data.recoveryCode, accountA.data.recoveryCode);
    assert.equal(
      (await request("/auth/me", { cookie: accountA.cookie })).status,
      401,
    );
    assert.equal(
      (
        await request("/auth/recover", {
          method: "POST",
          body: {
            email: emailA,
            password,
            recoveryCode: accountA.data.recoveryCode,
          },
        })
      ).status,
      401,
    );
    assert.equal(
      (await request("/exams", { cookie: recovered.cookie })).data.exams.length,
      1,
    );
    assert.equal(
      (
        await request(`/exams/${exam.id}`, {
          method: "DELETE",
          cookie: recovered.cookie,
        })
      ).status,
      204,
    );
    assert.equal(
      (await request("/exams", { cookie: recovered.cookie })).data.exams.length,
      0,
    );
    assert.equal(
      (
        await request("/auth/logout", {
          method: "POST",
          cookie: recovered.cookie,
        })
      ).status,
      204,
    );
    assert.equal(
      (await request("/auth/me", { cookie: recovered.cookie })).status,
      401,
    );
    const loggedIn = await request("/auth/login", {
      method: "POST",
      body: { email: emailA, password: `${password}-new` },
    });
    assert.equal(loggedIn.status, 200);
    assert.equal(
      (await request("/auth/me", { cookie: loggedIn.cookie })).data.user.email,
      emailA,
    );
    const expiredDb = new DatabaseSync(databasePath);
    expiredDb.prepare("UPDATE sessions SET expires_at = 0").run();
    expiredDb.close();
    assert.equal(
      (await request("/exams", { cookie: loggedIn.cookie })).status,
      401,
    );
  } finally {
    if (server?.listening) await stop();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("limita tentativas de autenticacao", async () => {
  const { app, close } = createApp({ databasePath: ":memory:" });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    let response;
    for (let attempt = 0; attempt < 31; attempt++) {
      response = await fetch(
        `http://127.0.0.1:${server.address().port}/api/auth/login`,
        {
          method: "POST",
          headers: {
            Origin: "http://127.0.0.1:5173",
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );
      await response.text();
    }
    assert.equal(response.status, 429);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    close();
  }
});
