import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.resolve(__dirname, "../../data");

export const getDataDir = () => path.resolve(process.env.DATA_DIR || DEFAULT_DATA_DIR);

// No Windows, substituir um arquivo que outro programa (antivírus, editor,
// indexador) está lendo pode falhar por alguns milissegundos.
const RETRYABLE_CODES = new Set(["EPERM", "EBUSY", "EACCES"]);
const RENAME_ATTEMPTS = 6;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const renameWithRetry = async (from, to) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await fs.rename(from, to);
      return;
    } catch (error) {
      if (!RETRYABLE_CODES.has(error.code) || attempt >= RENAME_ATTEMPTS) {
        throw error;
      }

      await sleep(25 * attempt);
    }
  }
};

/**
 * Armazena dados em um arquivo JSON com segurança:
 * - todas as operações passam por uma fila (uma de cada vez), evitando que
 *   duas requisições leiam e regravem o arquivo ao mesmo tempo;
 * - a gravação é atômica (arquivo temporário + rename), então uma leitura
 *   nunca enxerga o arquivo pela metade;
 * - um arquivo corrompido gera erro em vez de ser tratado como vazio, para
 *   nunca sobrescrever os dados existentes.
 *
 * Por padrão guarda uma lista; com `{ kind: "object" }` guarda um objeto
 * (usado pelas configurações da empresa).
 */
export const createJsonStore = (fileName, { kind = "list" } = {}) => {
  let queue = Promise.resolve();
  const isList = kind === "list";
  const emptyValue = () => (isList ? [] : null);

  const filePath = () => path.join(getDataDir(), fileName);

  const read = async () => {
    let rawValue;

    try {
      rawValue = await fs.readFile(filePath(), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        return emptyValue();
      }

      throw error;
    }

    if (!rawValue.trim()) {
      return emptyValue();
    }

    const parsed = JSON.parse(rawValue);
    const valid = isList
      ? Array.isArray(parsed)
      : parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);

    if (!valid) {
      throw new Error(`Arquivo de dados inválido: ${fileName} não tem o formato esperado.`);
    }

    return parsed;
  };

  const write = async (items) => {
    const target = filePath();
    const tempPath = `${target}.${process.pid}.${Date.now()}.tmp`;

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(tempPath, JSON.stringify(items, null, 2), "utf8");

    try {
      await renameWithRetry(tempPath, target);
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }
  };

  const enqueue = (task) => {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  };

  return {
    /** Lê a lista atual (respeitando a fila de escrita). */
    read: () => enqueue(read),

    /**
     * Executa `mutator(items)` com exclusividade. O mutator devolve
     * `{ items, result }`; se `items` vier definido, ele é gravado.
     */
    update: (mutator) =>
      enqueue(async () => {
        const items = await read();
        const { items: nextItems, result } = await mutator(items);

        if (nextItems) {
          await write(nextItems);
        }

        return result;
      }),
  };
};
