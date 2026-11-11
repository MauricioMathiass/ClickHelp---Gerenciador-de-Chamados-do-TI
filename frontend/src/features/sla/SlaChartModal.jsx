import { useMemo, useState } from "react";
import Feedback from "../../shared/components/Feedback";
import Modal from "../../shared/components/Modal";
import { useSettings } from "../settings/useSettings";
import { exportSlaExcel } from "./exportSlaExcel";
import { buildSlaStats } from "./slaUtils";
import "./sla.css";

const LEGEND = [
  { key: "atendidos", pct: "atendidosPct", label: "Fechados no prazo", dot: "dot-atendido" },
  { key: "emAberto", pct: "emAbertoPct", label: "Em aberto no prazo", dot: "dot-aberto" },
  { key: "violados", pct: "violadosPct", label: "Violados", dot: "dot-violado" },
];

/** Gráfico de pizza (conic-gradient) com as fatias na ordem da legenda. */
const buildPieBackground = (stats) => {
  if (!stats.total) {
    return "conic-gradient(var(--surface-4) 0 100%)";
  }

  const a = stats.atendidosPct;
  const b = a + stats.emAbertoPct;
  const c = b + stats.violadosPct;

  return `conic-gradient(var(--color-success) 0 ${a}%, var(--color-info) ${a}% ${b}%, var(--color-danger) ${b}% ${c}%, var(--surface-4) ${c}% 100%)`;
};

function SlaChartModal({ isOpen, onClose, chamados }) {
  const { branding } = useSettings();
  const [exportError, setExportError] = useState("");
  const stats = useMemo(() => buildSlaStats(chamados), [chamados]);

  const handleExport = async () => {
    setExportError("");

    try {
      await exportSlaExcel({ chamados, stats, appName: branding.appName });
    } catch {
      setExportError("Não foi possível gerar a planilha. Tente novamente.");
    }
  };

  const summary = [
    { label: "Total de chamados", value: stats.total },
    { label: "Fechados no prazo", value: stats.atendidos },
    { label: "Em aberto no prazo", value: stats.emAberto },
    { label: "Violados", value: stats.violados },
    { label: "Eficiência", value: `${stats.eficiencia}%` },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Relatório gráfico de SLA" size="wide">
      <div className="sla-graphic-toolbar">
        <button type="button" className="btn btn-primary btn-sm" onClick={handleExport}>
          Gerar relatório Excel
        </button>
      </div>

      <Feedback>{exportError}</Feedback>

      <div className="sla-graphic-layout">
        <section className="sla-graphic-panel">
          <div className="sla-pie-wrap">
            <div className="sla-pie-chart" style={{ background: buildPieBackground(stats) }}>
              <div className="sla-pie-core">
                <strong>{stats.eficiencia}%</strong>
                <span>Eficiência</span>
              </div>
            </div>
          </div>

          <div className="sla-pie-legend">
            {LEGEND.map((item) => (
              <div key={item.key} className="sla-legend-item">
                <span className={`sla-legend-dot ${item.dot}`}></span>
                <div>
                  <strong>{item.label}</strong>
                  <p>
                    {stats[item.key]} chamado(s) - {stats[item.pct]}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="sla-summary-grid">
          {summary.map((item) => (
            <article key={item.label} className="sla-summary-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>
      </div>
    </Modal>
  );
}

export default SlaChartModal;
