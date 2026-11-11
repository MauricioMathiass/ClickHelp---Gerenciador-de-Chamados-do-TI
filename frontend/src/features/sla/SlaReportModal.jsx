import { useMemo, useState } from "react";
import DatePicker from "../../shared/components/DatePicker";
import Modal from "../../shared/components/Modal";
import Select from "../../shared/components/Select";
import { formatPrioridade, toDateInputValue } from "../../shared/utils/format";
import SlaChartModal from "./SlaChartModal";
import { getSlaLabel, SLA_FILTER_OPTIONS, slaClassName } from "./slaUtils";
import "./sla.css";

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "Aberto", label: "Aberto" },
  { value: "Em andamento", label: "Em andamento" },
  { value: "Fechado", label: "Fechado" },
];

const EMPTY_FILTERS = { date: "", status: "", solicitante: "", sla: "" };

function SlaReportModal({ isOpen, onClose, chamados }) {
  const [openChart, setOpenChart] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

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
            String(item.solicitante ?? "")
              .toLowerCase()
              .includes(solicitante)) &&
          (!filters.sla || item.slaLabel === filters.sla)
      );
  }, [chamados, filters]);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Relatório SLA" size="wide" centerTitle hideCloseButton>
        <div className="sla-toolbar">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpenChart(true)}>
            Relatório gráfico
          </button>

          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="sla-filters">
          <div className="field">
            <label className="field-label" htmlFor="sla-filter-date">
              Data
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
              type="text"
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
                    <td data-label="Status">{item.status}</td>
                    <td data-label="Assunto">{item.assunto}</td>
                    <td data-label="Solicitante">{item.solicitante}</td>
                    <td data-label="Categoria">{item.categoria || "—"}</td>
                    <td data-label="Prioridade">{formatPrioridade(item.prioridade)}</td>
                    <td data-label="SLA" className={slaClassName(item.slaLabel)}>
                      {item.slaLabel}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="sla-empty">
                    Nenhum chamado encontrado para os filtros informados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      <SlaChartModal isOpen={openChart} onClose={() => setOpenChart(false)} chamados={rows} />
    </>
  );
}

export default SlaReportModal;
