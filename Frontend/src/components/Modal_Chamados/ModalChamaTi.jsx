import { useMemo, useState } from "react";
import ModalBase from "./ModalBase";
import CustomSelect from "../Common/CustomSelect";

function formatDate(dateValue) {
  return new Date(dateValue).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ModalChamaTi({ isOpen, onClose, chamados, onUpdateChamado, abrirSLA }) {
  const [draftResponses, setDraftResponses] = useState({});
  const chamadosAbertos = useMemo(
    () => chamados.filter((item) => item.status !== "Fechado"),
    [chamados]
  );
  const statusOptions = useMemo(
    () => [
      { value: "Aberto", label: "Aberto" },
      { value: "Em andamento", label: "Em andamento" },
      { value: "Fechado", label: "Fechado" },
    ],
    []
  );

  const handleDraftChange = (id, value) => {
    setDraftResponses((current) => ({
      ...current,
      [id]: value,
    }));
  };

  const handleCloseChamado = (chamado) => {
    const resposta = draftResponses[chamado.id] ?? chamado.resposta ?? "";

    if (!resposta.trim()) {
      return;
    }

    onUpdateChamado(chamado.id, {
      resposta,
      status: "Fechado",
    });
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Painel TI"
      size="wide"
      actions={
        <button type="button" className="modal-secondary-action" onClick={abrirSLA}>
          Ver SLA
        </button>
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
                <span className={`ticket-status status-${item.status.toLowerCase().replace(/\s+/g, "-")}`}>
                  {item.status}
                </span>
              </div>

              <div className="ticket-meta">
                <span>Solicitante: {item.solicitante}</span>
                <span>Local: {item.local}</span>
                <span>Prioridade: {item.prioridade}</span>
                <span>Aberto em: {formatDate(item.dataCriacao ?? item.dataAtualizacao)}</span>
                <span>Prazo SLA: {formatDate(item.dataLimite)}</span>
              </div>

              <div className="ti-actions-grid">
                <CustomSelect
                  className="compact"
                  name={`status-${item.id}`}
                  value={item.status}
                  options={statusOptions}
                  onChange={(event) =>
                    onUpdateChamado(item.id, {
                      status: event.target.value,
                    })
                  }
                />

                <textarea
                  className="ti-response-input"
                  placeholder="Escreva a resposta da equipe de TI"
                  value={draftResponses[item.id] ?? item.resposta ?? ""}
                  onChange={(event) => handleDraftChange(item.id, event.target.value)}
                />

                <button
                  type="button"
                  className="modal-primary-action"
                  onClick={() => handleCloseChamado(item)}
                >
                  Fechar solicitaçãoo
                </button>
              </div>
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
