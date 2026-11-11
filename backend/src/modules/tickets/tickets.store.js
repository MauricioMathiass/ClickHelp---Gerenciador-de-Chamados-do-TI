import { createJsonStore } from "../../shared/storage/jsonStore.js";

// O nome do arquivo foi mantido para não perder os dados já existentes.
export const ticketsStore = createJsonStore("chamadosStore.json");

export const STATUS_ABERTO = "Aberto";
export const STATUS_EM_ANDAMENTO = "Em andamento";
export const STATUS_FECHADO = "Fechado";
export const VALID_STATUSES = [STATUS_ABERTO, STATUS_EM_ANDAMENTO, STATUS_FECHADO];

/** Chamados de rotina ficam visíveis só para administradores. */
export const ADMIN_ONLY_VISIBILITY = "admin-only";
