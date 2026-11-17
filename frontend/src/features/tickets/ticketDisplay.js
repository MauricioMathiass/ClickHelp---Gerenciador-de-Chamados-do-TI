// Como cada chamado aparece nas listas: protocolo, prioridade e o relógio do SLA.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Abaixo disso o relógio mostra quanto falta ("vence em 3 h"); acima, o horário. */
const COUNTDOWN_LIMIT = 6 * HOUR;
/** "Falta pouco": menos de 2 h ou menos de 25% do prazo total, o que vier primeiro. */
const SOON_ABSOLUTE = 2 * HOUR;
const SOON_RATIO = 0.25;

export const PRIORITY_RANK = { alta: 0, media: 1, baixa: 2 };

/** 42 -> "#0042". Chamados sem número (dados antigos em cache) ficam sem protocolo. */
export const formatProtocolo = (numero) =>
  Number.isInteger(numero) ? `#${String(numero).padStart(4, "0")}` : "";

const toTime = (value) => {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

/** Duração curta em português: "40 min", "3 h", "2 dias". */
export const formatSpan = (ms) => {
  if (ms < HOUR) {
    return `${Math.max(1, Math.round(ms / MINUTE))} min`;
  }

  if (ms < 2 * DAY) {
    return `${Math.floor(ms / HOUR)} h`;
  }

  return `${Math.floor(ms / DAY)} dias`;
};

const startOfDay = (time) => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const formatClock = (time) =>
  new Date(time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** "hoje às 17:00", "amanhã às 09:00" ou "20/11 às 09:00". */
export const formatDueDay = (time, now = Date.now()) => {
  const dayDiff = Math.round((startOfDay(time) - startOfDay(now)) / DAY);
  const clock = formatClock(time);

  if (dayDiff === 0) {
    return `hoje às ${clock}`;
  }

  if (dayDiff === 1) {
    return `amanhã às ${clock}`;
  }

  const day = new Date(time).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${day} às ${clock}`;
};

export const isSameDay = (first, second) => startOfDay(first) === startOfDay(second);

/**
 * Relógio do SLA de um chamado aberto.
 * tone: "ok" | "soon" (falta pouco) | "late" (atrasado) | "none" (sem prazo).
 */
export const getSlaClock = (chamado, now = Date.now()) => {
  const deadline = toTime(chamado.dataLimite);

  if (deadline === null) {
    return { tone: "none", label: "Sem prazo", dueToday: false };
  }

  const remaining = deadline - now;

  if (remaining <= 0) {
    return { tone: "late", label: `Atrasado há ${formatSpan(-remaining)}`, dueToday: false };
  }

  const created = toTime(chamado.dataCriacao);
  const total = created === null ? 0 : deadline - created;
  const soon = remaining < SOON_ABSOLUTE || (total > 0 && remaining < total * SOON_RATIO);
  const label =
    remaining < COUNTDOWN_LIMIT
      ? `Vence em ${formatSpan(remaining)}`
      : `Vence ${formatDueDay(deadline, now)}`;

  return { tone: soon ? "soon" : "ok", label, dueToday: isSameDay(deadline, now) };
};

/** Fila: prazo mais próximo primeiro (atrasados no topo), sem prazo no fim; empate pela prioridade. */
export const compareByDeadline = (first, second) => {
  const a = toTime(first.dataLimite) ?? Number.POSITIVE_INFINITY;
  const b = toTime(second.dataLimite) ?? Number.POSITIVE_INFINITY;

  if (a !== b) {
    return a - b;
  }

  return (PRIORITY_RANK[first.prioridade] ?? 9) - (PRIORITY_RANK[second.prioridade] ?? 9);
};

/** Selo do chamado fechado, como um carimbo no canhoto. */
export const getClosedSeal = (chamado) => {
  if (chamado.autoClosed) {
    return { tone: "none", label: "Encerrado automaticamente" };
  }

  if (chamado.slaViolado) {
    return { tone: "late", label: "Com atraso" };
  }

  return chamado.slaViolado === false
    ? { tone: "ok", label: "No prazo" }
    : { tone: "none", label: "Fechado" };
};

/** Nome de quem abriu o chamado; o login só quando o nome não veio (dados antigos). */
export const requesterLabel = (chamado) => chamado.solicitanteNome || chamado.solicitante || "";

/** Junta só as partes preenchidas: "Matriz · Impressoras · aberto há 2 h". */
export const joinMeta = (...parts) => parts.filter(Boolean).join(" · ");
