import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";

// Ambiente isolado: dados em pasta temporária e admin de teste.
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "clickhelp-test-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dataDir;
process.env.ADMIN_USERNAME = "admin.teste";
process.env.ADMIN_PASSWORD = "senha-admin-teste";
process.env.JWT_SECRET = "segredo-de-teste-com-mais-de-32-caracteres!!";

const { default: app } = await import("../src/app.js");

let server;
let baseUrl;

const api = async (method, url, { token, body, rawBody } = {}) => {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

  return { status: response.status, data: await response.json() };
};

const login = async (username, password) =>
  (await api("POST", "/auth/login", { body: { username, password } })).data.token;

const novoChamado = (assunto = "Impressora parada") => ({
  assunto,
  local: "ORV",
  prioridade: "alta",
  problema: "Nao imprime",
});

let adminToken;
let analistaToken;
let mariaToken;
let joaoToken;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  adminToken = await login("admin.teste", "senha-admin-teste");

  for (const [name, surname, role] of [
    ["Ana", "Lista", "Analista de TI"],
    ["Maria", "Silva", "Usuario"],
    ["João", "Souza", "Usuario"],
  ]) {
    const { status } = await api("POST", "/auth/register", {
      token: adminToken,
      body: { name, surname, password: "senha123", role },
    });
    assert.equal(status, 201);
  }

  analistaToken = await login("ana.lista", "senha123");
  mariaToken = await login("maria.silva", "senha123");
  joaoToken = await login("joao.souza", "senha123");
});

after(async () => {
  server.close();
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe("autenticacao", () => {
  test("rejeita senha errada", async () => {
    const { status } = await api("POST", "/auth/login", {
      body: { username: "maria.silva", password: "errada" },
    });
    assert.equal(status, 401);
  });

  test("senhas ficam gravadas como hash", async () => {
    const raw = await fs.readFile(path.join(dataDir, "usersStore.json"), "utf8");
    assert.ok(!raw.includes("senha123"));
    assert.match(raw, /scrypt\$/);
  });

  test("cadastro exige administrador", async () => {
    const semLogin = await api("POST", "/auth/register", {
      body: { name: "X", surname: "Y", password: "senha123" },
    });
    assert.equal(semLogin.status, 401);

    const usuarioComum = await api("POST", "/auth/register", {
      token: mariaToken,
      body: { name: "X", surname: "Y", password: "senha123" },
    });
    assert.equal(usuarioComum.status, 403);
  });

  test("token adulterado e rejeitado", async () => {
    const [header, , signature] = mariaToken.split(".");
    const fakeBody = Buffer.from(
      JSON.stringify({ sub: 99, username: "maria.silva", role: "Administrador", exp: 9999999999 })
    ).toString("base64url");
    const { status } = await api("GET", "/chamados", { token: `${header}.${fakeBody}.${signature}` });
    assert.equal(status, 401);
  });

  test("chamados exigem login", async () => {
    assert.equal((await api("GET", "/chamados")).status, 401);
  });
});

describe("chamados", () => {
  test("usuario comum ve apenas os proprios chamados", async () => {
    await api("POST", "/chamados", { token: mariaToken, body: novoChamado("Da Maria") });
    await api("POST", "/chamados", { token: joaoToken, body: novoChamado("Do Joao") });

    const { data } = await api("GET", "/chamados?role=Administrador", { token: joaoToken });
    assert.ok(data.chamados.length > 0);
    assert.ok(data.chamados.every((item) => item.solicitante === "joao.souza"));
  });

  test("solicitante vem do token, nao do corpo", async () => {
    const { data } = await api("POST", "/chamados", {
      token: mariaToken,
      body: { ...novoChamado(), solicitante: "outra.pessoa" },
    });
    assert.equal(data.chamado.solicitante, "maria.silva");
  });

  test("valida prioridade e campos obrigatorios", async () => {
    const semCampos = await api("POST", "/chamados", { token: mariaToken, body: {} });
    assert.equal(semCampos.status, 400);

    const prioridadeInvalida = await api("POST", "/chamados", {
      token: mariaToken,
      body: { ...novoChamado(), prioridade: "urgentissima" },
    });
    assert.equal(prioridadeInvalida.status, 400);
  });

  test("usuario comum nao pode alterar chamados", async () => {
    const { data } = await api("POST", "/chamados", { token: mariaToken, body: novoChamado() });
    const { status } = await api("PATCH", `/chamados/${data.chamado.id}`, {
      token: mariaToken,
      body: { status: "Fechado", resposta: "ok" },
    });
    assert.equal(status, 403);
  });

  test("PATCH ignora campos fora de status/resposta", async () => {
    const { data } = await api("POST", "/chamados", { token: mariaToken, body: novoChamado() });
    const { data: updated } = await api("PATCH", `/chamados/${data.chamado.id}`, {
      token: analistaToken,
      body: { status: "Em andamento", id: "novo-id", solicitante: "outro", slaViolado: true },
    });
    assert.equal(updated.chamado.id, data.chamado.id);
    assert.equal(updated.chamado.solicitante, "maria.silva");
    assert.equal(updated.chamado.status, "Em andamento");
  });

  test("fechar exige resposta e registra quem fechou", async () => {
    const { data } = await api("POST", "/chamados", { token: mariaToken, body: novoChamado() });
    const url = `/chamados/${data.chamado.id}`;

    const semResposta = await api("PATCH", url, { token: analistaToken, body: { status: "Fechado" } });
    assert.equal(semResposta.status, 400);

    const fechado = await api("PATCH", url, {
      token: analistaToken,
      body: { status: "Fechado", resposta: "Resolvido" },
    });
    assert.equal(fechado.status, 200);
    assert.equal(fechado.data.chamado.closedByUsername, "ana.lista");
    assert.equal(fechado.data.chamado.slaViolado, false);
    assert.ok(fechado.data.chamado.dataFechamento);
  });

  test("status invalido e corpo malformado retornam 400", async () => {
    const { data } = await api("POST", "/chamados", { token: mariaToken, body: novoChamado() });
    const url = `/chamados/${data.chamado.id}`;

    assert.equal((await api("PATCH", url, { token: adminToken, body: { status: "Xyz" } })).status, 400);
    assert.equal((await api("PATCH", url, { token: adminToken, rawBody: "null" })).status, 400);
    assert.equal((await api("POST", "/chamados", { token: mariaToken, rawBody: "{oops" })).status, 400);
  });

  test("nao perde dados com muitas requisicoes simultaneas", async () => {
    const antes = (await api("GET", "/chamados", { token: adminToken })).data.chamados.length;
    const jobs = [];

    for (let index = 0; index < 100; index += 1) {
      jobs.push(api("POST", "/chamados", { token: mariaToken, body: novoChamado(`Carga ${index}`) }));
      jobs.push(api("GET", "/chamados", { token: adminToken }));
    }

    const results = await Promise.all(jobs);
    assert.ok(results.every((result) => result.status < 300));

    const depois = (await api("GET", "/chamados", { token: adminToken })).data.chamados.length;
    assert.equal(depois, antes + 100);
  });
});

describe("notificacoes", () => {
  test("TI recebe aviso de novo chamado e usuario recebe aviso de status", async () => {
    const { data } = await api("POST", "/chamados", { token: joaoToken, body: novoChamado("Aviso") });

    const ti = (await api("GET", "/notifications", { token: analistaToken })).data;
    assert.ok(ti.notifications.some((item) => item.context.chamadoId === data.chamado.id));

    await api("PATCH", `/chamados/${data.chamado.id}`, {
      token: analistaToken,
      body: { status: "Em andamento" },
    });

    const joao = (await api("GET", "/notifications", { token: joaoToken })).data;
    assert.ok(
      joao.notifications.some(
        (item) => item.type === "status-chamado-atualizado" && item.context.chamadoId === data.chamado.id
      )
    );
  });

  test("limpar notificacoes afeta so o proprio usuario", async () => {
    await api("POST", "/notifications/clear", { token: analistaToken });
    const analista = (await api("GET", "/notifications", { token: analistaToken })).data;
    const admin = (await api("GET", "/notifications", { token: adminToken })).data;

    assert.equal(analista.notifications.length, 0);
    assert.ok(analista.archived.length > 0);
    assert.ok(admin.notifications.length > 0);
  });

  test("marcar como lida zera o contador", async () => {
    const before = (await api("GET", "/notifications", { token: joaoToken })).data;
    assert.ok(before.unreadCount > 0);

    const after = (
      await api("POST", "/notifications/read", {
        token: joaoToken,
        body: { ids: before.notifications.map((item) => item.id) },
      })
    ).data;
    assert.equal(after.unreadCount, 0);
  });
});
