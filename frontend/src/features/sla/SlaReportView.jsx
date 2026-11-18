import { useMemo, useState } from "react";
import DatePicker from "../../shared/components/DatePicker";
import Feedback from "../../shared/components/Feedback";
import Select from "../../shared/components/Select";
import { formatPrioridade, statusClassName, toDateInputValue } from "../../shared/utils/format";
import { useSettings } from "../settings/useSettings";
import { formatProtocolo, requesterLabel } from "../tickets/ticketDisplay";
import { exportSlaExcel } from "./exportSlaExcel";
import SlaChartModal from "./SlaChartModal";
import { buildSlaStats, getSlaLabel, SLA_FILTER_OPTIONS, slaClassName } from "./slaUtils";
import "../tickets/queue.css";
import "./sla.css";

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "Aberto", label: "Aberto" },
  { value: "Em andamento", label: "Em andamento" },
  { value: "Fechado", label: "Fechado" },
];

const EMPTY_FILTERS = { date: "", status: "", solicitante: "", sla: "" };

/** Relatório de SLA como tela: filtros, tabela e exportação para Excel. */
function SlaReportView({ chamados }) {
  const { branding } = useSettings();
  const [openChart, setOpenChart] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [exportError, setExportError] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const setFilter = (field) => (event) =>
    setFilters((current) => ({ ...current, [field]: event.target.value }));

  // Calcula o rótulo de SLA uma vez e aplica os filtros.
  const rows = useMemo(() => {
    const solicitante = filters.solicitante.trim().toLowerCase();

    return chamados
      .map((item) => ({ ...item, slaLabel: getSlaLabel(item) }))
      .filter(
        (item) =>
          (!filters.date || toDateInputValue(item.dataCriacao) === filters.date) &&
          (!filters.status || item.status === filters.status) &&
          (!solicitante ||
            `${item.solicitante ?? ""} ${item.solicitanteNome ?? ""}`.toLowerCase().includes(solicitante)) &&
          (!filters.sla || item.slaLabel === filters.sla)
      );
  }, [chamados, filters]);

  const handleExport = async () => {
    setExportError("");
    setIsExporting(true);

    try {
      await exportSlaExcel({ chamados: rows, stats: buildSlaStats(rows), appName: branding.appName });
    } catch {
      setExportError("Não foi possível gerar a planilha. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="view" aria-labelledby="sla-title">
      <header className="view-header">
        <div>
          <h1 id="sla-title" className="view-title">
            Relatório de SLA
          </h1>
          <p className="view-summary">
            {rows.length === 1 ? "1 chamado" : `${rows.length} chamados`} nos filtros atuais
          </p>
        </div>

        <div className="view-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setOpenChart(true)}>
            Ver gráfico
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExport}
            disabled={isExporting || !rows.length}
          >
            {isExporting ? "Gerando..." : "Exportar para Excel"}
          </button>
        </div>
      </header>

      <Feedback>{exportError}</Feedback>

      <div className="sla-filters">
        <div className="field">
          <label className="field-label" htmlFor="sla-filter-date">
            Data de abertura
          </label>
          <DatePicker id="sla-filter-date" name="date" value={filters.date} onChange={setFilter("date")} />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="sla-filter-status">
            Status
          </label>
          <Select
            id="sla-filter-status"
            className="compact"
            name="status"
            value={filters.status}
            options={STATUS_OPTIONS}
            onChange={setFilter("status")}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="sla-filter-solicitante">
            Solicitante
          </label>
          <input
            id="sla-filter-solicitante"
            className="input"
            type="search"
            value={filters.solicitante}
            onChange={setFilter("solicitante")}
            placeholder="Buscar por solicitante"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="sla-filter-result">
            SLA
          </label>
          <Select
            id="sla-filter-result"
            className="compact"
            name="sla"
            value={filters.sla}
            options={SLA_FILTER_OPTIONS}
            onChange={setFilter("sla")}
          />
        </div>
      </div>

      <div className="sla-table-wrapper">
        <table className="sla-table">
          <thead>
            <tr>
              <th>Protocolo</th>
              <th>Status</th>
              <th>Assunto</th>
              <th>Solicitante</th>
              <th>Categoria</th>
              <th>Prioridade</th>
              <th>SLA</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((item) => (
                <tr key={item.id}>
                  <td data-label="Protocolo" className="sla-protocol">
                    {formatProtocolo(item.numero) || "—"}
                  </td>
                  <td data-label="Status">
                    <span className={`ticket-status ${statusClassName(item.status)}`}>{item.status}</span>
                  </td>
                  <td data-label="Assunto">{item.assunto}</td>
                  <td data-label="Solicitante">{requesterLabel(item)}</td>
                  <td data-label="Categoria">{item.categoria || "—"}</td>
                  <td data-label="Prioridade">{formatPrioridade(item.prioridade)}</td>
                  <td data-label="SLA" className={slaClassName(item.slaLabel)}>
                    {item.slaLabel}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="sla-empty">
                  Nenhum chamado encontrado para os filtros informados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <SlaChartModal isOpen={openChart} onClose={() => setOpenChart(false)} chamados={rows} />
    </section>
  );
}

export default SlaReportView;
