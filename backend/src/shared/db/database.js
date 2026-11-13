import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA } from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.resolve(__dirname, "../../data");

/** Pasta dos dados locais (banco embutido e arquivos JSON antigos). */
export const getDataDir = () => path.resolve(process.env.DATA_DIR || DEFAULT_DATA_DIR);

/**
 * De onde vêm os dados, conforme DATABASE_URL:
 * - postgresql://...  → PostgreSQL de verdade (Neon, Render, Docker...);
 * - memory://         → banco embutido só na memória (usado nos testes);
 * - vazio             → banco embutido gravado em DATA_DIR/pgdata, para
 *                       rodar o projeto sem configurar nada.
 */
const resolveTarget = () => {
  const url = process.env.DATABASE_URL?.trim() ?? "";

  if (/^postgres(ql)?:\/\//i.test(url)) {
    return { kind: "postgres", url };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Defina DATABASE_URL com o endereço do PostgreSQL para rodar em produção.");
  }

  if (url === "memory://") {
    return { kind: "embedded", dataDir: undefined };
  }

  return { kind: "embedded", dataDir: path.join(getDataDir(), "pgdata") };
};

const connectPostgres = async (url) => {
  const { default: pg } = await import("pg");

  const pool = new pg.Pool({
    connectionString: url,
    enableChannelBinding: /channel_binding=require/i.test(url),
    max: Number(process.env.DATABASE_POOL_SIZE) || 5,
  });

  // Uma conexão ociosa derrubada pelo servidor não pode derrubar a aplicação.
  pool.on("error", (error) => console.error("[ClickHELP] Conexão com o banco perdida:", error.message));

  return {
    query: async (text, params) => (await pool.query(text, params)).rows,
    transaction: async (work) => {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        const result = await work(async (text, params) => (await client.query(text, params)).rows);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    exec: async (text) => {
      await pool.query(text);
    },
    close: () => pool.end(),
  };
};

const connectEmbedded = async (dataDir) => {
  const { PGlite } = await import("@electric-sql/pglite");

  if (dataDir) {
    await fs.mkdir(dataDir, { recursive: true });
  }

  const db = new PGlite(dataDir);
  await db.waitReady;

  return {
    query: async (text, params) => (await db.query(text, params)).rows,
    transaction: (work) =>
      db.transaction((tx) => work(async (text, params) => (await tx.query(text, params)).rows)),
    exec: async (text) => {
      await db.exec(text);
    },
    close: () => db.close(),
  };
};

let connecting = null;

const getDb = () => {
  if (!connecting) {
    connecting = (async () => {
      const target = resolveTarget();
      const db =
        target.kind === "postgres"
          ? await connectPostgres(target.url)
          : await connectEmbedded(target.dataDir);

      await db.exec(SCHEMA);
      return db;
    })();

    // Se a conexão falhar, a próxima requisição tenta de novo.
    connecting.catch(() => {
      connecting = null;
    });
  }

  return connecting;
};

/** Executa uma consulta e devolve as linhas. */
export const query = async (text, params = []) => (await getDb()).query(text, params);

/**
 * Executa `work(query)` dentro de uma transação: ou tudo é gravado, ou nada.
 * Use `SELECT ... FOR UPDATE` dentro dela para travar a linha que vai mudar.
 */
export const transaction = async (work) => (await getDb()).transaction(work);

/** Conecta e cria as tabelas (o servidor chama antes de aceitar requisições). */
export const initDatabase = async () => {
  await getDb();
  return resolveTarget().kind;
};

export const closeDatabase = async () => {
  if (!connecting) {
    return;
  }

  const db = await connecting;
  connecting = null;
  await db.close();
};

/** Converte datas do banco para texto ISO (formato usado na API). */
export const toIso = (value) => (value instanceof Date ? value.toISOString() : (value ?? null));
