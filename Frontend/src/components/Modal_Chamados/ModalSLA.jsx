import { useMemo, useState } from "react";
import CustomDatePicker from "../Common/CustomDatePicker";
import CustomSelect from "../Common/CustomSelect";
import ModalBase from "./ModalBase";
import ModalRelatorioGrafico from "./ModalRelatorioGrafico";
import { formatPrioridade } from "../../utils/format";

function getSlaLabel(item) {
  if (item.status === "Fechado") {
    return item.slaViolado ? "Violado" : "Atendido";
  }

  const deadline = new Date(item.dataLimite);

  if (!item.dataLimite || Number.isNaN(deadline.getTime())) {
    return "Sem prazo";
  }

  return deadline < new Date() ? "Violado" : "Dentro do prazo";
}

const slaClassName = (label) => {
  if (label === "Violado") {
    return "sla-bad";
  }

  return label === "Sem prazo" ? "" : "sla-good";
};

function formatDateInput(dateValue) {
  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ModalSLA({ isOpen, onClose, chamados }) {
  const [openGraphicModal, setOpenGraphicModal] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSolicitante, setFilterSolicitante] = useState("");
  const [filterSla, setFilterSla] = useState("");

  const statusOptions = useMemo(
    () => [
      { value: "", label: "Todos os status" },
      { value: "Aberto", label: "Aberto" },
      { value: "Em andamento", label: "Em andamento" },
      { value: "Fechado", label: "Fechado" },
    ],
    []
  );
  const slaOptions = useMemo(
    () => [
      { value: "", label: "Todos os resultados" },
      { value: "Atendido", label: "Atendido" },
      { value: "Dentro do prazo", label: "Dentro do prazo" },
      { value: "Violado", label: "Violado" },
      { value: "Sem prazo", label: "Sem prazo" },
    ],
    []
  );

  const filteredChamados = useMemo(() => {
    const normalizedSolicitante = filterSolicitante.trim().toLowerCase();

    return chamados.filter((item) => {
      const slaLabel = getSlaLabel(item);
      const matchesDate = !filterDate || formatDateInput(item.dataCriacao) === filterDate;
      const matchesStatus = !filterStatus || item.status === filterStatus;
      const matchesSolicitante =
        !normalizedSolicitante || String(item.solicitante ?? "").toLowerCase().includes(normalizedSolicitante);
      const matchesSla = !filterSla || slaLabel === filterSla;

      return matchesDate && matchesStatus && matchesSolicitante && matchesSla;
    });
  }, [chamados, filterDate, filterSla, filterSolicitante, filterStatus]);

  const chamadosComSla = useMemo(
    () =>
      filteredChamados.map((item) => ({
        ...item,
        slaLabel: getSlaLabel(item),
      })),
    [filteredChamados]
  );

  return (
    <>
      <ModalBase
        isOpen={isOpen}
        onClose={onClose}
        title="Relatório SLA"
        size="wide"
        centerTitle
        hideCloseButton
      >
        <div className="sla-toolbar">
          <button
            type="button"
            className="modal-secondary-action"
            onClick={() => setOpenGraphicModal(true)}
          >
            Relatório Gráfico
          </button>

          <button type="button" className="modal-close sla-toolbar-close" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="sla-filters">
          <div className="sla-filter-field">
            <label htmlFor="sla-filter-date">Data</label>
            <CustomDatePicker
              id="sla-filter-date"
              name="sla-filter-date"
              value={filterDate}
              onChange={(event) => setFilterDate(event.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </div>

          <div className="sla-filter-field">
            <label htmlFor="sla-filter-status">Status</label>
            <CustomSelect
              className="compact"
              id="sla-filter-status"
              name="sla-filter-status"
              value={filterStatus}
              options={statusOptions}
              onChange={(event) => setFilterStatus(event.target.value)}
              placeholder="Todos os status"
            />
          </div>

          <div className="sla-filter-field">
            <label htmlFor="sla-filter-solicitante">Solicitante</label>
            <input
              id="sla-filter-solicitante"
              type="text"
              value={filterSolicitante}
              onChange={(event) => setFilterSolicitante(event.target.value)}
              placeholder="Buscar por solicitante"
            />
          </div>

          <div className="sla-filter-field">
            <label htmlFor="sla-filter-result">SLA</label>
            <CustomSelect
              className="compact"
              id="sla-filter-result"
              name="sla-filter-result"
              value={filterSla}
              options={slaOptions}
              onChange={(event) => setFilterSla(event.target.value)}
              placeholder="Todos os resultados"
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
                <th>Prioridade</th>
                <th>SLA</th>
              </tr>
            </thead>
            <tbody>
              {filteredChamados.length ? (
                filteredChamados.map((item) => {
                  const slaLabel = getSlaLabel(item);

                  return (
                    <tr key={item.id}>
                      <td data-label="Status">{item.status}</td>
                      <td data-label="Assunto">{item.assunto}</td>
                      <td data-label="Solicitante">{item.solicitante}</td>
                      <td data-label="Prioridade">{formatPrioridade(item.prioridade)}</td>
                      <td data-label="SLA" className={slaClassName(slaLabel)}>
                        {slaLabel}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="sla-empty">
                    Nenhum chamado encontrado para os filtros informados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ModalBase>

      <ModalRelatorioGrafico
        isOpen={openGraphicModal}
        onClose={() => setOpenGraphicModal(false)}
        chamados={chamadosComSla}
      />
    </>
  );
}

export default ModalSLA;
