import { useMemo, useState } from "react";
import ModalBase from "./ModalBase";
import CustomSelect from "../Common/CustomSelect";
import { formatDateTime as formatDate, formatPrioridade, statusClassName } from "../../utils/format";

const STATUS_OPTIONS = [
  { value: "Aberto", label: "Aberto" },
  { value: "Em andamento", label: "Em andamento" },
  { value: "Fechado", label: "Fechado" },
];

function ModalChamaTi({ isOpen, onClose, chamados, onUpdateChamado, abrirSLA }) {
  const [draftResponses, setDraftResponses] = useState({});
  const [errors, setErrors] = useState({});
  const [savingId, setSavingId] = useState(null);
  const chamadosAbertos = useMemo(
    () => chamados.filter((item) => item.status !== "Fechado"),
    [chamados]
  );

  const getResposta = (chamado) => draftResponses[chamado.id] ?? chamado.resposta ?? "";

  const setError = (id, message) => setErrors((current) => ({ ...current, [id]: message }));

  const handleDraftChange = (id, value) => {
    setDraftResponses((current) => ({ ...current, [id]: value }));
    setError(id, "");
  };

  const submitUpdate = async (chamado, updates) => {
    setSavingId(chamado.id);
    const errorMessage = await onUpdateChamado(chamado.id, updates);
    setSavingId(null);
    setError(chamado.id, errorMessage ?? "");
  };

  const handleStatusChange = (chamado, nextStatus) => {
    if (nextStatus === chamado.status) {
      return;
    }

    // Fechar sempre exige resposta, venha do seletor ou do botão.
    if (nextStatus === "Fechado") {
      handleCloseChamado(chamado);
      return;
    }

    submitUpdate(chamado, { status: nextStatus });
  };

  const handleCloseChamado = (chamado) => {
    const resposta = getResposta(chamado).trim();

    if (!resposta) {
      setError(chamado.id, "Escreva a resposta da TI antes de fechar o chamado.");
      return;
    }

    submitUpdate(chamado, { resposta, status: "Fechado" });
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Painel TI"
      size="wide"
      actions={
        abrirSLA ? (
          <button type="button" className="modal-secondary-action" onClick={abrirSLA}>
            Ver SLA
          </button>
        ) : null
      }
    >
      <div className="tickets-stack">
        {chamadosAbertos.length ? (
          chamadosAbertos.map((item) => (
            <article key={item.id} className="ticket-card ticket-card-ti">
              <div className="ticket-card-top">
                <div>
                  <h3>{item.assunto}</h3>
                  <p>{item.problema}</p>
                </div>
                <span className={`ticket-status ${statusClassName(item.status)}`}>
                  {item.status}
                </span>
              </div>

              <div className="ticket-meta">
                <span>Solicitante: {item.solicitante}</span>
                <span>Local: {item.local}</span>
                <span>Prioridade: {formatPrioridade(item.prioridade)}</span>
                <span>Aberto em: {formatDate(item.dataCriacao ?? item.dataAtualizacao)}</span>
                <span>Prazo SLA: {formatDate(item.dataLimite)}</span>
              </div>

              <div className="ti-actions-grid">
                <CustomSelect
                  className="compact"
                  name={`status-${item.id}`}
                  value={item.status}
                  options={STATUS_OPTIONS}
                  disabled={savingId === item.id}
                  onChange={(event) => handleStatusChange(item, event.target.value)}
                />

                <textarea
                  className="ti-response-input"
                  placeholder="Escreva a resposta da equipe de TI"
                  aria-label={`Resposta da TI para ${item.assunto}`}
                  value={getResposta(item)}
                  maxLength={5000}
                  onChange={(event) => handleDraftChange(item.id, event.target.value)}
                />

                <button
                  type="button"
                  className="modal-primary-action"
                  disabled={savingId === item.id}
                  onClick={() => handleCloseChamado(item)}
                >
                  {savingId === item.id ? "Salvando..." : "Fechar solicitação"}
                </button>
              </div>

              {errors[item.id] ? (
                <div className="form-feedback form-feedback-error" role="alert">
                  {errors[item.id]}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h3>Nenhum chamado aberto</h3>
            <p>Quando houver novas solicitações, elas aparecerão aqui para atendimento.</p>
          </div>
        )}
      </div>
    </ModalBase>
  );
}

export default ModalChamaTi;
