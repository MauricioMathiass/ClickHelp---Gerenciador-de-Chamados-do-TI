// Regras de exibição do SLA usadas pelo relatório, pelo gráfico e pelo Excel.

export const SLA_ATENDIDO = "Atendido";
export const SLA_NO_PRAZO = "Dentro do prazo";
export const SLA_VIOLADO = "Violado";
export const SLA_SEM_PRAZO = "Sem prazo";

export const SLA_FILTER_OPTIONS = [
  { value: "", label: "Todos os resultados" },
  { value: SLA_ATENDIDO, label: SLA_ATENDIDO },
  { value: SLA_NO_PRAZO, label: SLA_NO_PRAZO },
  { value: SLA_VIOLADO, label: SLA_VIOLADO },
  { value: SLA_SEM_PRAZO, label: SLA_SEM_PRAZO },
];

/**
 * - "Atendido": fechado dentro do prazo;
 * - "Dentro do prazo": ainda aberto e no prazo;
 * - "Violado": prazo estourado (aberto ou fechado);
 * - "Sem prazo": chamado aberto sem data limite.
 */
export const getSlaLabel = (chamado, now = new Date()) => {
  if (chamado.status === "Fechado") {
    return chamado.slaViolado ? SLA_VIOLADO : SLA_ATENDIDO;
  }

  const deadline = new Date(chamado.dataLimite);

  if (!chamado.dataLimite || Number.isNaN(deadline.getTime())) {
    return SLA_SEM_PRAZO;
  }

  return deadline < now ? SLA_VIOLADO : SLA_NO_PRAZO;
};

export const slaClassName = (label) => {
  if (label === SLA_VIOLADO) {
    return "sla-bad";
  }

  return label === SLA_SEM_PRAZO ? "" : "sla-good";
};

const percent = (value, total) => (total ? Math.round((value / total) * 100) : 0);

/**
 * Converte quantidades em percentuais inteiros que somam exatamente 100
 * (método do maior resto), evitando valores como -1% ou 101%.
 */
export const distributePercent = (values) => {
  const total = values.reduce((sum, value) => sum + value, 0);

  if (!total) {
    return values.map(() => 0);
  }

  const raw = values.map((value) => (value * 100) / total);
  const result = raw.map(Math.floor);
  let remaining = 100 - result.reduce((sum, value) => sum + value, 0);

  raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((first, second) => second.fraction - first.fraction)
    .forEach(({ index }) => {
      if (remaining > 0) {
        result[index] += 1;
        remaining -= 1;
      }
    });

  return result;
};

/** Totais e percentuais do relatório. A eficiência considera só os chamados já decididos. */
export const buildSlaStats = (chamados) => {
  const count = (label) => chamados.filter((item) => item.slaLabel === label).length;
  const total = chamados.length;
  const atendidos = count(SLA_ATENDIDO);
  const emAberto = count(SLA_NO_PRAZO);
  const violados = count(SLA_VIOLADO);
  const semPrazo = total - atendidos - emAberto - violados;
  const [atendidosPct, emAbertoPct, violadosPct, semPrazoPct] = distributePercent([
    atendidos,
    emAberto,
    violados,
    semPrazo,
  ]);

  return {
    total,
    atendidos,
    emAberto,
    violados,
    semPrazo,
    atendidosPct,
    emAbertoPct,
    violadosPct,
    semPrazoPct,
    eficiencia: percent(atendidos, atendidos + violados),
  };
};
