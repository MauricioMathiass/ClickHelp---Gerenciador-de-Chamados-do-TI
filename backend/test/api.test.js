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
  categoria: "Hardware",
  prioridade: "alta",
  problema: "Nao imprime",
});

// Configuração usada nos testes (locais, categorias, SLA e 4 rotinas diárias).
const TEST_ROUTINE_TITLES = ["Backup", "Biometria", "Unidades externas", "Impressoras"];
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
  routines: TEST_ROUTINE_TITLES.map((title, index) => ({
    id: `rotina-${index + 1}`,
    title,
    location: "ORV",
    priority: "media",
    time: "07:30",
    frequency: "daily",
    active: true,
  })),
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

describe("rotinas diarias", () => {
  test("cria as rotinas do dia e encerra as de dias anteriores", async () => {
    const { ensureRoutineTickets: ensureFixedDailyChamados } =
      await import("../src/modules/tickets/routines.service.js");

    // Quarta 11/11/2026 08:00 e depois quinta 12/11/2026 08:00 (horário local).
    await ensureFixedDailyChamados(new Date(2026, 10, 11, 8, 0));
    await ensureFixedDailyChamados(new Date(2026, 10, 12, 8, 0));

    const { data } = await api("GET", "/chamados", { token: adminToken });
    const rotinas = data.chamados.filter((item) => item.isFixedRoutine);
    const quarta = rotinas.filter((item) => item.fixedRoutineDateKey === "2026-11-11");
    const quinta = rotinas.filter((item) => item.fixedRoutineDateKey === "2026-11-12");

    assert.equal(quarta.length, 4);
    assert.ok(quarta.every((item) => item.status === "Fechado" && item.autoClosed));
    assert.equal(quinta.length, 4);
    assert.ok(quinta.every((item) => item.status === "Aberto"));
  });

  test("nao duplica rotinas com chamadas repetidas", async () => {
    const { ensureRoutineTickets: ensureFixedDailyChamados } =
      await import("../src/modules/tickets/routines.service.js");
    await Promise.all([1, 2, 3].map(() => ensureFixedDailyChamados(new Date(2026, 10, 12, 9, 0))));

    const { data } = await api("GET", "/chamados", { token: adminToken });
    assert.equal(data.chamados.filter((item) => item.fixedRoutineDateKey === "2026-11-12").length, 4);
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
    const horasUteis = (new Date(data.chamado.dataLimite) - new Date(data.chamado.dataCriacao)) / 3600000;
    // Dentro do expediente o prazo é exatamente 2h; fora dele, começa no próximo expediente.
    assert.ok(horasUteis <= 2 || new Date(data.chamado.dataLimite).getHours() <= 10);

    await api("PUT", "/settings", { token: adminToken, body: testSettings() });
  });

  test("rotina semanal e mensal so geram chamado no dia certo", async () => {
    const { ensureRoutineTickets } = await import("../src/modules/tickets/routines.service.js");
    const config = testSettings();
    config.routines = [
      {
        id: "semanal",
        title: "Semanal",
        location: "ORV",
        priority: "baixa",
        time: "09:00",
        frequency: "weekly",
        weekdays: [1],
      },
      {
        id: "mensal",
        title: "Mensal",
        location: "ORV",
        priority: "baixa",
        time: "09:00",
        frequency: "monthly",
        monthDay: 31,
      },
    ];
    await api("PUT", "/settings", { token: adminToken, body: config });

    await ensureRoutineTickets(new Date(2026, 10, 17, 10, 0)); // terça: nenhuma
    await ensureRoutineTickets(new Date(2026, 10, 16, 8, 0)); // segunda antes das 9h: nenhuma
    await ensureRoutineTickets(new Date(2026, 10, 16, 9, 30)); // segunda: semanal
    await ensureRoutineTickets(new Date(2026, 10, 30, 9, 30)); // 30/11 (último dia): mensal

    const { data } = await api("GET", "/chamados", { token: adminToken });
    const datas = (id) =>
      data.chamados
        .filter((item) => item.fixedRoutineCode === id)
        .map((item) => item.fixedRoutineDateKey)
        .sort();
    // 30/11/2026 também é segunda-feira, então a semanal roda de novo nesse dia.
    assert.deepEqual(datas("semanal"), ["2026-11-16", "2026-11-30"]);
    assert.deepEqual(datas("mensal"), ["2026-11-30"]);

    await api("PUT", "/settings", { token: adminToken, body: testSettings() });
  });
});
