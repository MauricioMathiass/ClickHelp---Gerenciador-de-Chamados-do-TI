/**
 * Copia os dados das versões antigas (arquivos JSON) para o banco configurado
 * em DATABASE_URL. Pode rodar mais de uma vez: o que já existe no banco é
 * mantido, e só o que falta é inserido.
 *
 * Uso: npm run db:import            (lê backend/src/data)
 *      npm run db:import -- <pasta> (lê outra pasta)
 */
import fs from "node:fs/promises";
import path from "node:path";
import "../src/config/env.js";
import { closeDatabase, getDataDir, initDatabase, transaction } from "../src/shared/db/database.js";

const sourceDir = path.resolve(process.argv[2] || getDataDir());

const readJson = async (fileName) => {
  try {
    return JSON.parse(await fs.readFile(path.join(sourceDir, fileName), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw new Error(`Não foi possível ler ${fileName}: ${error.message}`);
  }
};

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const importUsers = async (tx, users) => {
  let count = 0;

  for (const user of users) {
    const rows = await tx(
      `INSERT INTO users
         (id, username, password_hash, name, role, department, active,
          password_version, password_updated_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, NOW()), $11)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        Number(user.id),
        normalize(user.username),
        user.passwordHash,
        user.name,
        user.role,
        user.department ?? "",
        user.active !== false,
        Number(user.passwordVersion ?? 0),
        user.passwordUpdatedAt ?? null,
        user.createdAt ?? null,
        user.updatedAt ?? null,
      ]
    );
    count += rows.length;
  }

  // Os próximos cadastros continuam a numeração depois do maior id importado.
  await tx(
    `SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT MAX(id) FROM users), 2),
                   (SELECT MAX(id) FROM users) IS NOT NULL)`
  );

  return count;
};

const importChamados = async (tx, chamados) => {
  let count = 0;

  for (const item of chamados) {
    const rows = await tx(
      `INSERT INTO chamados
         (id, assunto, solicitante, local, categoria, prioridade, problema, user_id, status,
          resposta, visibility, data_criacao, data_atualizacao, data_limite, data_fechamento,
          closed_by_username, closed_by_name, closed_by_role, sla_violado, auto_closed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        item.id,
        item.assunto ?? "",
        item.solicitante ?? "",
        item.local ?? "",
        item.categoria ?? "",
        item.prioridade ?? "media",
        item.problema ?? "",
        item.userId ?? null,
        item.status,
        item.resposta ?? "",
        item.visibility ?? null,
        item.dataCriacao,
        item.dataAtualizacao ?? item.dataCriacao,
        item.dataLimite ?? null,
        item.dataFechamento ?? null,
        item.closedByUsername ?? null,
        item.closedByName ?? null,
        item.closedByRole ?? null,
        item.slaViolado ?? null,
        item.autoClosed ?? null,
      ]
    );
    count += rows.length;
  }

  return count;
};

const importNotifications = async (tx, notifications) => {
  let count = 0;

  for (const item of notifications) {
    const rows = await tx(
      `INSERT INTO notifications
         (id, type, title, message, recipient_usernames, recipient_roles, exclude_usernames, context, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        item.id,
        item.type ?? "",
        item.title ?? "",
        item.message ?? "",
        (item.recipients?.usernames ?? []).map(normalize),
        item.recipients?.roles ?? [],
        (item.recipients?.excludeUsernames ?? []).map(normalize),
        JSON.stringify(item.context ?? {}),
        item.createdAt,
      ]
    );

    if (!rows.length) {
      continue;
    }

    count += 1;
    const archived = new Set((item.archivedBy ?? []).map(normalize));
    const usernames = new Set([...(item.readBy ?? []).map(normalize), ...archived]);

    for (const username of usernames) {
      await tx(
        `INSERT INTO notification_status (notification_id, username, read_at, archived_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [item.id, username, item.createdAt, archived.has(username) ? item.createdAt : null]
      );
    }
  }

  return count;
};

const importSettings = async (tx, settings) => {
  const rows = await tx(
    `INSERT INTO settings (id, data) VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [JSON.stringify(settings)]
  );
  return rows.length;
};

const run = async () => {
  console.log(`Lendo os arquivos de ${sourceDir}`);
  await initDatabase();

  const users = (await readJson("usersStore.json")) ?? [];
  const chamados = (await readJson("chamadosStore.json")) ?? [];
  const notifications = (await readJson("notificationsStore.json")) ?? [];
  const settings = await readJson("settings.json");

  const result = await transaction(async (tx) => ({
    usuarios: await importUsers(tx, users),
    chamados: await importChamados(tx, chamados),
    notificacoes: await importNotifications(tx, notifications),
    configuracoes: settings ? await importSettings(tx, settings) : 0,
  }));

  console.log("Importação concluída (novos registros):", result);
  console.log(
    `Encontrados nos arquivos: ${users.length} usuário(s), ${chamados.length} chamado(s), ` +
      `${notifications.length} notificação(ões), ${settings ? 1 : 0} configuração.`
  );
};

try {
  await run();
} catch (error) {
  console.error("Falha na importação:", error.message);
  process.exitCode = 1;
} finally {
  await closeDatabase().catch(() => {});
}
