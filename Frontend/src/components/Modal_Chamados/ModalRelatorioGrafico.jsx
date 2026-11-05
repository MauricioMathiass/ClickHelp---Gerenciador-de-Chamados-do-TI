import ModalBase from "./ModalBase";

function buildSlaStats(chamados) {
  const total = chamados.length;
  const atendidos = chamados.filter((item) => item.slaLabel !== "Violado").length;
  const violados = chamados.filter((item) => item.slaLabel === "Violado").length;
  const eficiencia = total ? Math.round((atendidos / total) * 100) : 0;

  return {
    total,
    atendidos,
    violados,
    eficiencia,
  };
}

function ModalRelatorioGrafico({ isOpen, onClose, chamados }) {
  const { total, atendidos, violados, eficiencia } = buildSlaStats(chamados);
  const atendidosPercentual = total ? Math.round((atendidos / total) * 100) : 0;
  const violadosPercentual = total ? 100 - atendidosPercentual : 0;
  const pieStyle = {
    background: total
      ? `conic-gradient(#5de2c0 0 ${atendidosPercentual}%, #ff7d7d ${atendidosPercentual}% 100%)`
      : "conic-gradient(rgba(255,255,255,0.14) 0 100%)",
  };

  const exportarRelatorioExcel = async () => {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ClickHELP";
    workbook.created = new Date();
    const resumoRows = [
      { Indicador: "Total de chamados", Valor: total },
      { Indicador: "Atendidos no prazo", Valor: atendidos },
      { Indicador: "Violados", Valor: violados },
      { Indicador: "Eficiencia", Valor: `${eficiencia}%` },
      { Indicador: "Percentual atendidos", Valor: `${atendidosPercentual}%` },
      { Indicador: "Percentual violados", Valor: `${violadosPercentual}%` },
    ];
    const chamadosOrdenados = [...chamados].sort((left, right) => {
      const leftDate = left.dataCriacao ? new Date(left.dataCriacao).getTime() : 0;
      const rightDate = right.dataCriacao ? new Date(right.dataCriacao).getTime() : 0;
      return leftDate - rightDate;
    });
    const detalhamentoRows = chamadosOrdenados.map((item, index) => ({
      id: index + 1,
      Assunto: item.assunto,
      Solicitante: item.solicitante,
      Status: item.status,
      Prioridade: item.prioridade,
      "Data de abertura": item.dataCriacao
        ? new Date(item.dataCriacao).toLocaleString("pt-BR")
        : "Nao informado",
      "Prazo SLA": item.dataLimite
        ? new Date(item.dataLimite).toLocaleString("pt-BR")
        : "Nao informado",
      SLA: item.slaLabel,
    }));

    const resumoSheet = workbook.addWorksheet("Resumo SLA");
    resumoSheet.columns = [
      { header: "Indicador", key: "Indicador", width: 28 },
      { header: "Valor", key: "Valor", width: 20 },
    ];
    resumoSheet.addRows(resumoRows);

    const detalhamentoSheet = workbook.addWorksheet("Detalhamento");
    detalhamentoSheet.columns = [
      { header: "id", key: "id", width: 8 },
      { header: "Assunto", key: "Assunto", width: 44 },
      { header: "Solicitante", key: "Solicitante", width: 26 },
      { header: "Status", key: "Status", width: 16 },
      { header: "Prioridade", key: "Prioridade", width: 18 },
      { header: "Data de abertura", key: "Data de abertura", width: 24 },
      { header: "Prazo SLA", key: "Prazo SLA", width: 24 },
      { header: "SLA", key: "SLA", width: 16 },
    ];

    if (detalhamentoRows.length) {
      detalhamentoSheet.addRows(detalhamentoRows);
    } else {
      detalhamentoSheet.addRow({
        id: "",
        Assunto: "Nenhum chamado encontrado.",
        Solicitante: "",
        Status: "",
        Prioridade: "",
        "Data de abertura": "",
        "Prazo SLA": "",
        SLA: "",
      });
    }

    const headerFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "9BBB59" },
    };
    const thinBorder = {
      top: { style: "thin", color: { argb: "D9D9D9" } },
      left: { style: "thin", color: { argb: "D9D9D9" } },
      bottom: { style: "thin", color: { argb: "D9D9D9" } },
      right: { style: "thin", color: { argb: "D9D9D9" } },
    };
    const headerStyle = {
      font: { name: "Calibri", size: 11, color: { argb: "000000" } },
      fill: headerFill,
      alignment: { horizontal: "center", vertical: "middle" },
      border: thinBorder,
    };
    const bodyStyle = {
      font: { name: "Calibri", size: 11, color: { argb: "000000" } },
      alignment: { horizontal: "center", vertical: "middle" },
      border: thinBorder,
    };

    [resumoSheet, detalhamentoSheet].forEach((sheet) => {
      sheet.getRow(1).height = 24;
      sheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
      });
    });

    resumoSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      row.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        cell.alignment = {
          horizontal: colNumber === 1 ? "left" : "center",
          vertical: "middle",
        };
        cell.font = { name: "Calibri", size: 11, color: { argb: "000000" } };
      });
    });

    detalhamentoSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      row.height = 22;
      row.eachCell((cell, colNumber) => {
        cell.style = bodyStyle;

        if (colNumber === 2) {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Relatorio_Grafico_SLA_ClickHELP.xlsx";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <ModalBase isOpen={isOpen} onClose={onClose} title="Relatorio grafico de SLA" size="wide">
      <div className="sla-graphic-toolbar">
        <button
          type="button"
          className="modal-secondary-action sla-graphic-export"
          onClick={exportarRelatorioExcel}
        >
          Gerar Relatório Excel
        </button>
      </div>

      <div className="sla-graphic-layout">
        <section className="sla-graphic-panel">
          <div className="sla-pie-wrap">
            <div className="sla-pie-chart" style={pieStyle}>
              <div className="sla-pie-core">
                <strong>{eficiencia}%</strong>
                <span>Eficiência</span>
              </div>
            </div>
          </div>

          <div className="sla-pie-legend">
            <div className="sla-legend-item">
              <span className="sla-legend-dot dot-atendido"></span>
              <div>
                <strong>Atendidos</strong>
                <p>
                  {atendidos} chamado(s) - {atendidosPercentual}%
                </p>
              </div>
            </div>

            <div className="sla-legend-item">
              <span className="sla-legend-dot dot-violado"></span>
              <div>
                <strong>Violados</strong>
                <p>
                  {violados} chamado(s) - {violadosPercentual}%
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="sla-summary-grid">
          <article className="sla-summary-card">
            <span>Total de chamados</span>
            <strong>{total}</strong>
          </article>

          <article className="sla-summary-card">
            <span>Atendidos no prazo</span>
            <strong>{atendidos}</strong>
          </article>

          <article className="sla-summary-card">
            <span>Violados</span>
            <strong>{violados}</strong>
          </article>

          <article className="sla-summary-card">
            <span>Eficiencia</span>
            <strong>{eficiencia}%</strong>
          </article>
        </section>
      </div>
    </ModalBase>
  );
}

export default ModalRelatorioGrafico;
