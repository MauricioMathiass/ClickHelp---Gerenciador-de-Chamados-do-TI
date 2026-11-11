const DATE_TIME_OPTIONS = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/** Data e hora no padrão brasileiro (ou "Não informado"). */
export const formatDateTime = (value) => {
  if (!value) {
    return "Não informado";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Não informado" : date.toLocaleString("pt-BR", DATE_TIME_OPTIONS);
};

const PRIORIDADE_LABELS = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

/** "media" -> "Média", "alta" -> "Alta"... */
export const formatPrioridade = (value) =>
  PRIORIDADE_LABELS[String(value ?? "").toLowerCase()] ?? value ?? "";

/** Primeira letra maiúscula, o resto como veio ("novembro de 2026" -> "Novembro de 2026"). */
export const capitalizeFirst = (value) => {
  const text = String(value ?? "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
};

/** Classe CSS do status ("Em andamento" -> "status-em-andamento"). */
export const statusClassName = (status) =>
  `status-${String(status ?? "")
    .toLowerCase()
    .replace(/\s+/g, "-")}`;

/** Data no formato do campo de data (AAAA-MM-DD), no fuso do navegador. */
export const toDateInputValue = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
