import { formatDateTime, formatPrioridade } from "../../shared/utils/format";

const FONT = { name: "Calibri", size: 11, color: { argb: "000000" } };
const BORDER_SIDE = { style: "thin", color: { argb: "D9D9D9" } };
const BORDER = { top: BORDER_SIDE, left: BORDER_SIDE, bottom: BORDER_SIDE, right: BORDER_SIDE };
const HEADER_STYLE = {
  font: FONT,
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "9BBB59" } },
  alignment: { horizontal: "center", vertical: "middle" },
  border: BORDER,
};

const DETAIL_COLUMNS = [
  { header: "Nº", key: "numero", width: 8 },
  { header: "Assunto", key: "assunto", width: 44 },
  { header: "Solicitante", key: "solicitante", width: 26 },
  { header: "Local", key: "local", width: 18 },
  { header: "Categoria", key: "categoria", width: 22 },
  { header: "Status", key: "status", width: 16 },
  { header: "Prioridade", key: "prioridade", width: 14 },
  { header: "Data de abertura", key: "abertura", width: 22 },
  { header: "Prazo SLA", key: "prazo", width: 22 },
  { header: "SLA", key: "sla", width: 16 },
];

/** Aplica cabeçalho colorido e bordas; a coluna `leftColumn` fica alinhada à esquerda. */
const styleSheet = (sheet, leftColumn) => {
  sheet.getRow(1).height = 24;
  sheet.getRow(1).eachCell((cell) => {
    cell.style = HEADER_STYLE;
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.font = FONT;
      cell.border = BORDER;
      cell.alignment = { horizontal: colNumber === leftColumn ? "left" : "center", vertical: "middle" };
    });
  });
};

const downloadBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
};

const toFileSafe = (value) =>
  String(value || "ClickHELP")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");

/**
 * Gera e baixa a planilha do relatório de SLA (abas "Resumo SLA" e
 * "Detalhamento"). A biblioteca exceljs é carregada só quando necessário.
 */
export const exportSlaExcel = async ({ chamados, stats, appName }) => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = appName;
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Resumo SLA");
  summary.columns = [
    { header: "Indicador", key: "indicador", width: 44 },
    { header: "Valor", key: "valor", width: 20 },
  ];
  summary.addRows([
    { indicador: "Total de chamados", valor: stats.total },
    { indicador: "Fechados no prazo", valor: stats.atendidos },
    { indicador: "Em aberto no prazo", valor: stats.emAberto },
    { indicador: "Violados", valor: stats.violados },
    { indicador: "Sem prazo", valor: stats.semPrazo },
    { indicador: "Eficiência (fechados no prazo / decididos)", valor: `${stats.eficiencia}%` },
    { indicador: "Percentual fechados no prazo", valor: `${stats.atendidosPct}%` },
    { indicador: "Percentual em aberto no prazo", valor: `${stats.emAbertoPct}%` },
    { indicador: "Percentual violados", valor: `${stats.violadosPct}%` },
  ]);
  styleSheet(summary, 1);

  const detail = workbook.addWorksheet("Detalhamento");
  detail.columns = DETAIL_COLUMNS;
  const sorted = [...chamados].sort(
    (left, right) => new Date(left.dataCriacao) - new Date(right.dataCriacao)
  );

  if (sorted.length) {
    detail.addRows(
      sorted.map((item, index) => ({
        numero: index + 1,
        assunto: item.assunto,
        solicitante: item.solicitante,
        local: item.local || "—",
        categoria: item.categoria || "—",
        status: item.status,
        prioridade: formatPrioridade(item.prioridade),
        abertura: formatDateTime(item.dataCriacao),
        prazo: formatDateTime(item.dataLimite),
        sla: item.slaLabel,
      }))
    );
  } else {
    detail.addRow({ assunto: "Nenhum chamado encontrado." });
  }

  styleSheet(detail, 2);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `Relatorio_SLA_${toFileSafe(appName)}.xlsx`);
};
