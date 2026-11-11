import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.resolve(__dirname, "../data");

export const getDataDir = () => path.resolve(process.env.DATA_DIR || DEFAULT_DATA_DIR);

/**
 * Armazena um array em um arquivo JSON com segurança:
 * - todas as operações passam por uma fila (uma de cada vez), evitando que
 *   duas requisições leiam e regravem o arquivo ao mesmo tempo;
 * - a gravação é atômica (arquivo temporário + rename), então uma leitura
 *   nunca enxerga o arquivo pela metade;
 * - um arquivo corrompido gera erro em vez de ser tratado como vazio, para
 *   nunca sobrescrever os dados existentes com uma lista vazia.
 */
export const createJsonStore = (fileName) => {
  let queue = Promise.resolve();

  const filePath = () => path.join(getDataDir(), fileName);

  const read = async () => {
    let rawValue;

    try {
      rawValue = await fs.readFile(filePath(), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }

      throw error;
    }

    if (!rawValue.trim()) {
      return [];
    }

    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      throw new Error(`Arquivo de dados invalido: ${fileName} nao contem uma lista.`);
    }

    return parsed;
  };

  const write = async (items) => {
    const target = filePath();
    const tempPath = `${target}.${process.pid}.${Date.now()}.tmp`;

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(tempPath, JSON.stringify(items, null, 2), "utf8");
    await fs.rename(tempPath, target);
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
