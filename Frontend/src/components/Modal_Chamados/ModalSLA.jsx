import { useMemo, useState } from "react";
import CustomDatePicker from "../Common/CustomDatePicker";
import CustomSelect from "../Common/CustomSelect";
import ModalBase from "./ModalBase";
import ModalRelatorioGrafico from "./ModalRelatorioGrafico";

function getSlaLabel(item) {
  const deadline = new Date(item.dataLimite);
  const now = new Date();

  if (item.status === "Fechado") {
    return item.slaViolado ? "Violado" : "Atendido";
  }

  return deadline < now ? "Violado" : "Dentro do prazo";
}

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
        !normalizedSolicitante || item.solicitante.toLowerCase().includes(normalizedSolicitante);
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
        title="Relatorio SLA"
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
                  const isBad = slaLabel === "Violado";

                  return (
                    <tr key={item.id}>
                      <td>{item.status}</td>
                      <td>{item.assunto}</td>
                      <td>{item.solicitante}</td>
                      <td>{item.prioridade}</td>
                      <td className={isBad ? "sla-bad" : "sla-good"}>{slaLabel}</td>
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
