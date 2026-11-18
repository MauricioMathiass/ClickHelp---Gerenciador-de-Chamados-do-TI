import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import { after, before, describe, test } from "node:test";

// Ambiente isolado: banco embutido só na memória (nunca toca no Neon nem nos
// dados reais) e admin de teste. Variáveis já definidas não são trocadas pelo .env.
// Para testar contra um PostgreSQL de verdade, use TEST_DATABASE_URL com um banco VAZIO.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "memory://";
process.env.ADMIN_USERNAME = "admin.teste";
process.env.ADMIN_PASSWORD = "senha-admin-teste";
process.env.JWT_SECRET = "segredo-de-teste-com-mais-de-32-caracteres!!";
// Nunca envia e-mail de verdade, mesmo que o backend/.env tenha o EmailJS configurado.
const EMAIL_VARS = [
  "EMAILJS_SERVICE_ID",
  "EMAILJS_TEMPLATE_ID",
  "EMAILJS_PUBLIC_KEY",
  "EMAILJS_PRIVATE_KEY",
  "NOTIFICATION_EMAIL_TO",
  "EMAILJS_API_URL",
];
EMAIL_VARS.forEach((name) => {
  process.env[name] = "";
});

const { default: app } = await import("../src/app.js");
const { closeDatabase, query } = await import("../src/shared/db/database.js");
const { config } = await import("../src/config/env.js");
const { buildSlaLimitFromDate, createCalendar } = await import("../src/modules/tickets/sla.js");

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
  categoria: "Hardware",
  prioridade: "alta",
  problema: "Nao imprime",
});

// Configuração usada nos testes (locais, categorias e SLA).
const testSettings = () => ({
  branding: {
    appName: "ClickHELP",
    companyName: "Empresa Teste",
    primaryColor: "#1ed4df",
    secondaryColor: "#1388d1",
  },
  catalog: { locations: ["ORV", "AWA"], categories: ["Hardware", "Outros"], departments: ["TI"] },
  sla: {
    workStartHour: 8,
    workEndHour: 18,
    workDays: [1, 2, 3, 4, 5],
    hoursByPriority: { alta: 48, media: 48, baixa: 48 },
  },
  holidays: { national: true, movable: [], extra: [] },
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

  const settings = await api("PUT", "/settings", { token: adminToken, body: testSettings() });
  assert.equal(settings.status, 200, JSON.stringify(settings.data));

  for (const [name, surname, role] of [
    ["Ana", "Lista", "Analista de TI"],
    ["Maria", "Silva", "Usuario"],
    ["João", "Souza", "Usuario"],
  ]) {
    const { status } = await api("POST", "/users", {
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
  await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
});

describe("autenticacao", () => {
  test("rejeita senha errada", async () => {
    const { status } = await api("POST", "/auth/login", {
      body: { username: "maria.silva", password: "errada" },
    });
    assert.equal(status, 401);
  });

  test("senhas ficam gravadas como hash", async () => {
    const rows = await query("SELECT password_hash FROM users");
    assert.ok(rows.length > 0);
    rows.forEach(({ password_hash: hash }) => {
      assert.ok(!hash.includes("senha123"));
      assert.match(hash, /^scrypt\$/);
    });
  });

  test("cadastro exige administrador", async () => {
    const semLogin = await api("POST", "/users", {
      body: { name: "X", surname: "Y", password: "senha123" },
    });
    assert.equal(semLogin.status, 401);

    const usuarioComum = await api("POST", "/users", {
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

  test("cada chamado recebe um protocolo sequencial", async () => {
    const primeiro = (await api("POST", "/chamados", { token: mariaToken, body: novoChamado("Protocolo A") }))
      .data.chamado;
    const segundo = (await api("POST", "/chamados", { token: mariaToken, body: novoChamado("Protocolo B") }))
      .data.chamado;

    assert.ok(Number.isInteger(primeiro.numero) && primeiro.numero > 0);
    assert.equal(segundo.numero, primeiro.numero + 1);
  });

  test("lista traz o nome de quem abriu o chamado", async () => {
    await api("POST", "/chamados", { token: mariaToken, body: novoChamado("Com nome") });
    const { data } = await api("GET", "/chamados", { token: adminToken });
    const chamado = data.chamados.find((item) => item.assunto === "Com nome");

    assert.equal(chamado.solicitante, "maria.silva");
    assert.equal(chamado.solicitanteNome, "Maria Silva");
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

describe("gestao de usuarios", () => {
  const findUser = async (username) =>
    (await api("GET", "/users", { token: adminToken })).data.users.find((user) => user.username === username);

  test("lista usuarios apenas para administrador", async () => {
    assert.equal((await api("GET", "/users", { token: analistaToken })).status, 403);

    const { status, data } = await api("GET", "/users", { token: adminToken });
    assert.equal(status, 200);
    assert.ok(data.users.some((user) => user.fromEnv && user.username === "admin.teste"));
    assert.ok(data.users.every((user) => !("passwordHash" in user)));
  });

  test("redefine senha e desativa usuario, que perde acesso na hora", async () => {
    await api("POST", "/users", {
      token: adminToken,
      body: { name: "Carlos", surname: "Temp", password: "senha123" },
    });
    const carlos = await findUser("carlos.temp");
    const carlosToken = await login("carlos.temp", "senha123");

    const reset = await api("PATCH", `/users/${carlos.id}`, {
      token: adminToken,
      body: { password: "nova-senha-1" },
    });
    assert.equal(reset.status, 200);
    assert.equal(await login("carlos.temp", "senha123"), undefined);
    assert.ok(await login("carlos.temp", "nova-senha-1"));

    await api("PATCH", `/users/${carlos.id}`, { token: adminToken, body: { active: false } });
    assert.equal((await api("GET", "/chamados", { token: carlosToken })).status, 401);
    assert.equal(await login("carlos.temp", "nova-senha-1"), undefined);
  });

  test("mudanca de perfil vale sem novo login", async () => {
    await api("POST", "/users", {
      token: adminToken,
      body: { name: "Bia", surname: "Promovida", password: "senha123" },
    });
    const bia = await findUser("bia.promovida");
    const biaToken = await login("bia.promovida", "senha123");
    const { data } = await api("POST", "/chamados", { token: mariaToken, body: novoChamado() });

    const antes = await api("PATCH", `/chamados/${data.chamado.id}`, {
      token: biaToken,
      body: { status: "Em andamento" },
    });
    assert.equal(antes.status, 403);

    await api("PATCH", `/users/${bia.id}`, { token: adminToken, body: { role: "Analista de TI" } });
    const depois = await api("PATCH", `/chamados/${data.chamado.id}`, {
      token: biaToken,
      body: { status: "Em andamento" },
    });
    assert.equal(depois.status, 200);
  });

  test("admin do .env nao pode ser alterado e perfil invalido e recusado", async () => {
    assert.equal(
      (await api("PATCH", "/users/1", { token: adminToken, body: { active: false } })).status,
      400
    );

    const maria = await findUser("maria.silva");
    const invalido = await api("PATCH", `/users/${maria.id}`, {
      token: adminToken,
      body: { role: "Chefe" },
    });
    assert.equal(invalido.status, 400);
  });
});

describe("notificacoes (ajustes)", () => {
  test("quem e da TI e abre um chamado nao recebe o aviso de novo chamado", async () => {
    const { data } = await api("POST", "/chamados", {
      token: analistaToken,
      body: novoChamado("Do analista"),
    });
    const analista = (await api("GET", "/notifications", { token: analistaToken })).data;
    const admin = (await api("GET", "/notifications", { token: adminToken })).data;

    const doChamado = (list) => list.filter((item) => item.context.chamadoId === data.chamado.id);
    assert.deepEqual(
      doChamado(analista.notifications).map((item) => item.type),
      ["solicitacao-enviada"]
    );
    assert.ok(doChamado(admin.notifications).some((item) => item.type === "novo-chamado-ti"));
  });

  test("marcar todas como lidas zera o contador mesmo acima do limite exibido", async () => {
    for (let index = 0; index < 35; index += 1) {
      await api("POST", "/chamados", { token: joaoToken, body: novoChamado(`Lote ${index}`) });
    }

    const before = (await api("GET", "/notifications", { token: adminToken })).data;
    assert.ok(before.unreadCount > before.notifications.length);

    const after = (await api("POST", "/notifications/read", { token: adminToken, body: { all: true } })).data;
    assert.equal(after.unreadCount, 0);
  });
});

describe("correcoes da terceira analise", () => {
  test("redefinir a senha derruba as sessoes abertas", async () => {
    await api("POST", "/users", {
      token: adminToken,
      body: { name: "Sessao", surname: "Antiga", password: "senha123" },
    });
    const tokenAntigo = await login("sessao.antiga", "senha123");
    assert.equal((await api("GET", "/chamados", { token: tokenAntigo })).status, 200);

    const users = (await api("GET", "/users", { token: adminToken })).data.users;
    const alvo = users.find((user) => user.username === "sessao.antiga");
    await api("PATCH", `/users/${alvo.id}`, { token: adminToken, body: { password: "outra-senha" } });

    assert.equal((await api("GET", "/chamados", { token: tokenAntigo })).status, 401);
    const tokenNovo = await login("sessao.antiga", "outra-senha");
    assert.equal((await api("GET", "/chamados", { token: tokenNovo })).status, 200);
  });

  test("chamado fechado nao pode ficar sem resposta", async () => {
    const { data } = await api("POST", "/chamados", { token: mariaToken, body: novoChamado() });
    const url = `/chamados/${data.chamado.id}`;
    await api("PATCH", url, { token: analistaToken, body: { status: "Fechado", resposta: "Resolvido" } });

    const apagar = await api("PATCH", url, { token: analistaToken, body: { resposta: "   " } });
    assert.equal(apagar.status, 400);

    const atual = (await api("GET", "/chamados", { token: adminToken })).data.chamados.find(
      (item) => item.id === data.chamado.id
    );
    assert.equal(atual.resposta, "Resolvido");
  });

  test("mensagens de erro com acentuacao correta", async () => {
    const { data } = await api("POST", "/auth/login", { body: { username: "x", password: "y" } });
    assert.equal(data.message, "Usuário ou senha inválidos.");
  });
});

describe("configuracoes da empresa", () => {
  test("dados publicos (marca) disponiveis sem login; completos so com login", async () => {
    const publico = await api("GET", "/settings/public");
    assert.equal(publico.status, 200);
    assert.equal(publico.data.branding.companyName, "Empresa Teste");
    assert.equal(publico.data.catalog, undefined);

    assert.equal((await api("GET", "/settings")).status, 401);
    const completo = await api("GET", "/settings", { token: mariaToken });
    assert.deepEqual(completo.data.settings.catalog.locations, ["ORV", "AWA"]);
  });

  test("so administrador altera as configuracoes", async () => {
    assert.equal((await api("PUT", "/settings", { token: analistaToken, body: testSettings() })).status, 403);
  });

  test("valida cores, expediente e feriados", async () => {
    const corInvalida = testSettings();
    corInvalida.branding.primaryColor = "azul";
    assert.equal((await api("PUT", "/settings", { token: adminToken, body: corInvalida })).status, 400);

    const expediente = testSettings();
    expediente.sla.workEndHour = 7;
    assert.equal((await api("PUT", "/settings", { token: adminToken, body: expediente })).status, 400);

    const feriado = testSettings();
    feriado.holidays.extra = ["31/12"];
    assert.equal((await api("PUT", "/settings", { token: adminToken, body: feriado })).status, 400);
  });

  test("chamado so aceita local e categoria cadastrados", async () => {
    const localInvalido = await api("POST", "/chamados", {
      token: mariaToken,
      body: { ...novoChamado(), local: "Filial X" },
    });
    assert.equal(localInvalido.status, 400);

    const semCategoria = await api("POST", "/chamados", {
      token: mariaToken,
      body: { ...novoChamado(), categoria: "" },
    });
    assert.equal(semCategoria.status, 400);

    const ok = await api("POST", "/chamados", {
      token: mariaToken,
      body: { ...novoChamado(), local: "awa" },
    });
    assert.equal(ok.data.chamado.local, "AWA");
    assert.equal(ok.data.chamado.categoria, "Hardware");
  });

  test("prazo do SLA usa as horas configuradas para a prioridade", async () => {
    const curto = testSettings();
    curto.sla.hoursByPriority.alta = 2;
    await api("PUT", "/settings", { token: adminToken, body: curto });

    const { data } = await api("POST", "/chamados", { token: mariaToken, body: novoChamado("SLA curto") });
    await api("PUT", "/settings", { token: adminToken, body: testSettings() });

    // Compara com o cálculo esperado a partir da própria data de abertura: o
    // resultado não depende da hora nem do dia em que o teste roda.
    const calendario = createCalendar({ ...curto.sla, holidays: curto.holidays });
    const esperado = buildSlaLimitFromDate(data.chamado.dataCriacao, 2, calendario);
    const com48h = buildSlaLimitFromDate(data.chamado.dataCriacao, 48, calendario);
    assert.equal(data.chamado.dataLimite, esperado);
    assert.notEqual(data.chamado.dataLimite, com48h);
  });
});

describe("correcoes da quarta analise", () => {
  test("login trava apos 5 erros seguidos, mesmo com a senha certa, sem afetar outros usuarios", async () => {
    await api("POST", "/users", {
      token: adminToken,
      body: { name: "Trava", surname: "Login", password: "senha123" },
    });

    for (let tentativa = 1; tentativa <= 5; tentativa += 1) {
      const errada = await api("POST", "/auth/login", {
        body: { username: "trava.login", password: "errada" },
      });
      assert.equal(errada.status, 401);
    }

    const bloqueada = await api("POST", "/auth/login", {
      body: { username: "TRAVA.LOGIN", password: "senha123" },
    });
    assert.equal(bloqueada.status, 429);
    assert.match(bloqueada.data.message, /Muitas tentativas/);

    assert.ok(await login("maria.silva", "senha123"));
  });

  test("trocar a senha do admin do .env derruba as sessoes abertas dele", async () => {
    const senhaOriginal = config.admin.password;
    const tokenAntigo = await login("admin.teste", senhaOriginal);
    assert.equal((await api("GET", "/auth/me", { token: tokenAntigo })).status, 200);

    try {
      config.admin.password = "senha-admin-trocada";
      assert.equal((await api("GET", "/auth/me", { token: tokenAntigo })).status, 401);

      const tokenNovo = await login("admin.teste", "senha-admin-trocada");
      assert.equal((await api("GET", "/auth/me", { token: tokenNovo })).status, 200);
    } finally {
      config.admin.password = senhaOriginal;
    }

    assert.equal((await api("GET", "/auth/me", { token: tokenAntigo })).status, 200);
  });

  test("fechar depois do prazo marca o SLA como violado", async () => {
    const { data } = await api("POST", "/chamados", { token: mariaToken, body: novoChamado("Atrasado") });
    await query("UPDATE chamados SET data_limite = NOW() - INTERVAL '1 hour' WHERE id = $1", [
      data.chamado.id,
    ]);

    const fechado = await api("PATCH", `/chamados/${data.chamado.id}`, {
      token: analistaToken,
      body: { status: "Fechado", resposta: "Resolvido com atraso" },
    });
    assert.equal(fechado.status, 200);
    assert.equal(fechado.data.chamado.slaViolado, true);
  });

  test("reabrir limpa data de fechamento, responsavel e SLA", async () => {
    const { data } = await api("POST", "/chamados", { token: mariaToken, body: novoChamado("Reabrir") });
    const url = `/chamados/${data.chamado.id}`;
    await api("PATCH", url, { token: analistaToken, body: { status: "Fechado", resposta: "Feito" } });

    const reaberto = await api("PATCH", url, { token: adminToken, body: { status: "Em andamento" } });
    assert.equal(reaberto.status, 200);
    assert.equal(reaberto.data.chamado.status, "Em andamento");
    assert.equal(reaberto.data.chamado.dataFechamento, undefined);
    assert.equal(reaberto.data.chamado.closedByUsername, undefined);
    assert.equal(reaberto.data.chamado.slaViolado, undefined);
  });

  test("chamado restrito (admin-only) so aparece e so muda para o administrador", async () => {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO chamados (id, assunto, solicitante, prioridade, problema, status, visibility,
                             data_criacao, data_atualizacao)
       VALUES ($1, 'Restrito', 'maria.silva', 'baixa', 'x', 'Aberto', 'admin-only', NOW(), NOW())`,
      [id]
    );
    const ids = async (token) =>
      (await api("GET", "/chamados", { token })).data.chamados.map((item) => item.id);

    assert.ok((await ids(adminToken)).includes(id));
    assert.ok(!(await ids(analistaToken)).includes(id));
    assert.ok(!(await ids(mariaToken)).includes(id));

    const patch = await api("PATCH", `/chamados/${id}`, {
      token: analistaToken,
      body: { status: "Em andamento" },
    });
    assert.equal(patch.status, 404);
  });

  test("feriados extras tem limite de itens", async () => {
    const muitos = testSettings();
    muitos.holidays.extra = Array.from({ length: 101 }, (_, index) => {
      const dia = new Date(2025, 0, 1 + index);
      return `${String(dia.getMonth() + 1).padStart(2, "0")}-${String(dia.getDate()).padStart(2, "0")}`;
    });
    const { status } = await api("PUT", "/settings", { token: adminToken, body: muitos });
    assert.equal(status, 400);
  });

  test("novo chamado envia o e-mail pelo backend, com as chaves que ficam so no servidor", async () => {
    let receive;
    const recebido = new Promise((resolve) => {
      receive = resolve;
    });
    const emailServer = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        res.end("OK");
        receive(JSON.parse(body));
      });
    });
    await new Promise((resolve) => emailServer.listen(0, resolve));

    Object.assign(process.env, {
      EMAILJS_SERVICE_ID: "service_teste",
      EMAILJS_TEMPLATE_ID: "template_teste",
      EMAILJS_PUBLIC_KEY: "publica",
      EMAILJS_PRIVATE_KEY: "privada",
      NOTIFICATION_EMAIL_TO: "ti@exemplo.com",
      EMAILJS_API_URL: `http://127.0.0.1:${emailServer.address().port}/send`,
    });

    try {
      const { data } = await api("POST", "/chamados", { token: mariaToken, body: novoChamado("Com e-mail") });
      const enviado = await Promise.race([
        recebido,
        new Promise((_, reject) => setTimeout(() => reject(new Error("e-mail não enviado")), 5000)),
      ]);

      assert.equal(enviado.service_id, "service_teste");
      assert.equal(enviado.accessToken, "privada");
      assert.equal(enviado.template_params.to_email, "ti@exemplo.com");
      assert.equal(enviado.template_params.chamado_id, data.chamado.id);
      assert.equal(enviado.template_params.solicitante, "maria.silva");
    } finally {
      EMAIL_VARS.forEach((name) => {
        process.env[name] = "";
      });
      await new Promise((resolve) => emailServer.close(resolve));
    }
  });
});

describe("modo demonstracao", () => {
  const entrarDemo = (perfil) => api("POST", "/auth/demo", { body: { perfil } });

  test("desligado: sem rota de demonstracao e sem botoes na tela de login", async () => {
    process.env.DEMO_MODE = "";
    assert.equal((await entrarDemo("usuario")).status, 404);
    assert.equal((await api("GET", "/settings/public")).data.demoMode, false);
  });

  test("ligado: entra sem senha em cada perfil e ve os dados de exemplo", async () => {
    process.env.DEMO_MODE = "true";

    try {
      assert.equal((await api("GET", "/settings/public")).data.demoMode, true);
      assert.equal((await entrarDemo("inexistente")).status, 400);
      assert.equal((await entrarDemo("__proto__")).status, 400);

      const usuario = await entrarDemo("usuario");
      const analista = await entrarDemo("analista");
      const admin = await entrarDemo("administrador");
      assert.equal(usuario.status, 200);
      assert.equal(usuario.data.user.role, "Usuario");
      assert.equal(usuario.data.user.demo, true);
      assert.equal(analista.data.user.role, "Analista de TI");
      assert.equal(admin.data.user.role, "Administrador");

      // O usuário de demonstração vê só os próprios chamados de exemplo.
      const meus = (await api("GET", "/chamados", { token: usuario.data.token })).data.chamados;
      assert.ok(meus.length >= 3);
      assert.ok(meus.every((item) => item.solicitante === "demo.usuario"));

      // A equipe vê todos, com SLA atendido e violado para o relatório não ficar vazio.
      const todos = (await api("GET", "/chamados", { token: analista.data.token })).data.chamados;
      const exemplos = todos.filter((item) => item.solicitante.startsWith("demo."));
      assert.equal(exemplos.length, 9);
      assert.ok(exemplos.some((item) => item.status === "Fechado" && item.slaViolado === true));
      assert.ok(exemplos.some((item) => item.status === "Fechado" && item.slaViolado === false));
      assert.ok(
        exemplos.every((item) => !item.dataFechamento || new Date(item.dataFechamento) <= new Date())
      );

      const avisos = (await api("GET", "/notifications", { token: usuario.data.token })).data;
      assert.ok(avisos.notifications.length > 0);

      // Abrir e fechar chamado funciona normalmente na demonstração.
      const novo = await api("POST", "/chamados", {
        token: usuario.data.token,
        body: novoChamado("Teste visitante"),
      });
      assert.equal(novo.status, 201);
      const fechado = await api("PATCH", `/chamados/${novo.data.chamado.id}`, {
        token: analista.data.token,
        body: { status: "Fechado", resposta: "Resolvido na demonstração" },
      });
      assert.equal(fechado.status, 200);
    } finally {
      process.env.DEMO_MODE = "";
    }
  });

  test("administrador de demonstracao ve usuarios e configuracoes, mas nao altera", async () => {
    process.env.DEMO_MODE = "true";

    try {
      const { token } = (await entrarDemo("administrador")).data;
      assert.equal((await api("GET", "/users", { token })).status, 200);
      assert.equal((await api("GET", "/settings", { token })).status, 200);

      const salvar = await api("PUT", "/settings", { token, body: testSettings() });
      assert.equal(salvar.status, 403);
      assert.match(salvar.data.message, /demonstração/);

      const criar = await api("POST", "/users", {
        token,
        body: { name: "Invasor", surname: "Teste", password: "senha123" },
      });
      assert.equal(criar.status, 403);

      const users = (await api("GET", "/users", { token: adminToken })).data.users;
      const maria = users.find((user) => user.username === "maria.silva");
      const desativar = await api("PATCH", `/users/${maria.id}`, { token, body: { active: false } });
      assert.equal(desativar.status, 403);
      assert.equal((await api("GET", "/chamados", { token: mariaToken })).status, 200);
    } finally {
      process.env.DEMO_MODE = "";
    }
  });

  test("demonstracao so enxerga contas, chamados e avisos de exemplo", async () => {
    process.env.DEMO_MODE = "true";

    try {
      const admin = (await entrarDemo("administrador")).data.token;
      const analista = (await entrarDemo("analista")).data.token;

      // Um chamado de uma conta de verdade, que a demonstração não pode ver nem mexer.
      const real = (await api("POST", "/chamados", { token: mariaToken, body: novoChamado("So da Maria") }))
        .data.chamado;

      const usuarios = (await api("GET", "/users", { token: admin })).data.users;
      assert.ok(usuarios.length > 0);
      assert.ok(usuarios.every((user) => user.username.startsWith("demo.")));

      const chamados = (await api("GET", "/chamados", { token: analista })).data.chamados;
      assert.ok(chamados.every((item) => item.solicitante.startsWith("demo.")));

      const alterar = await api("PATCH", `/chamados/${real.id}`, {
        token: analista,
        body: { status: "Em andamento" },
      });
      assert.notEqual(alterar.status, 200);

      const avisos = (await api("GET", "/notifications", { token: analista })).data.notifications;
      assert.ok(avisos.every((aviso) => !aviso.message.includes("So da Maria")));

      // Quem tem conta de verdade continua vendo tudo.
      const todos = (await api("GET", "/users", { token: adminToken })).data.users;
      assert.ok(todos.some((user) => !user.username.startsWith("demo.")));
    } finally {
      process.env.DEMO_MODE = "";
    }
  });

  test("contas de demonstracao nao entram por senha e o login fica reservado", async () => {
    const { status } = await api("POST", "/auth/login", {
      body: { username: "demo.admin", password: "demo$sem-senha" },
    });
    assert.equal(status, 401);

    const criado = await api("POST", "/users", {
      token: adminToken,
      body: { name: "Demo", surname: "Usuario", password: "senha123" },
    });
    assert.equal(criado.status, 201);
    assert.notEqual(criado.data.user.username, "demo.usuario");
  });

  test("restaura os dados de exemplo depois do intervalo, sem apagar chamados reais", async () => {
    process.env.DEMO_MODE = "true";

    try {
      const visitante = (await entrarDemo("usuario")).data.token;
      await api("POST", "/chamados", { token: visitante, body: novoChamado("Bagunca do visitante") });
      const real = await api("POST", "/chamados", { token: mariaToken, body: novoChamado("Chamado real") });

      // Ainda dentro do intervalo: nada é apagado.
      await entrarDemo("usuario");
      let assuntos = (await api("GET", "/chamados", { token: adminToken })).data.chamados.map(
        (item) => item.assunto
      );
      assert.ok(assuntos.includes("Bagunca do visitante"));

      await query("UPDATE demo_state SET reset_at = NOW() - INTERVAL '7 hours'");
      await entrarDemo("usuario");

      const chamados = (await api("GET", "/chamados", { token: adminToken })).data.chamados;
      assuntos = chamados.map((item) => item.assunto);
      assert.ok(!assuntos.includes("Bagunca do visitante"));
      assert.ok(chamados.some((item) => item.id === real.data.chamado.id));
      assert.equal(chamados.filter((item) => item.solicitante.startsWith("demo.")).length, 9);
    } finally {
      process.env.DEMO_MODE = "";
    }
  });
});
