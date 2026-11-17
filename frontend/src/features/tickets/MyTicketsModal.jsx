import { useState } from "react";
import Modal from "../../shared/components/Modal";
import { formatDateTime, statusClassName } from "../../shared/utils/format";
import { formatDueDay, getClosedSeal, joinMeta } from "./ticketDisplay";
import TicketStrip from "./TicketStrip";

/**
 * O que o solicitante vê no canhoto. O atraso aparece com honestidade, mas em
 * âmbar (não no vermelho de alerta da fila do TI): é um aviso, não um alarme.
 */
const getRequesterNote = (item, now = Date.now()) => {
  if (item.status === "Fechado") {
    const seal = getClosedSeal(item);
    return { tone: "none", label: seal.label };
  }

  const deadline = new Date(item.dataLimite).getTime();

  if (!item.dataLimite || Number.isNaN(deadline)) {
    return { tone: "ok", label: "Sem prazo definido" };
  }

  if (deadline <= now) {
    return {
      tone: "soon",
      label: "Passou do prazo",
      detail: `O prazo previsto era ${formatDueDay(deadline, now)}. A equipe de TI vê o atraso na fila de atendimento.`,
    };
  }

  return { tone: "ok", label: `Previsto até ${formatDueDay(deadline, now)}` };
};

function MyTicketsModal({ isOpen, onClose, solicitacoes }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Minhas solicitações" size="wide">
      {solicitacoes.length ? (
        <ol className="strip-list">
          {solicitacoes.map((item) => {
            const note = getRequesterNote(item);

            return (
              <TicketStrip
                key={item.id}
                chamado={item}
                tone={note.tone}
                stubNote={note.label}
                meta={joinMeta(item.local, item.categoria, `aberto em ${formatDateTime(item.dataCriacao)}`)}
                aside={<span className={`ticket-status ${statusClassName(item.status)}`}>{item.status}</span>}
                isExpanded={expandedId === item.id}
                onToggle={() => setExpandedId((current) => (current === item.id ? null : item.id))}
              >
                {note.detail ? <p className="strip-notice">{note.detail}</p> : null}

                <p className="strip-problem">{item.problema}</p>

                {item.resposta ? (
                  <div className="strip-response">
                    <strong>Resposta da TI</strong>
                    <p>{item.resposta}</p>
                  </div>
                ) : (
                  <p className="field-hint">A equipe de TI ainda não respondeu.</p>
                )}
              </TicketStrip>
            );
          })}
        </ol>
      ) : (
        <div className="empty-state">
          <h3>Nenhuma solicitação cadastrada</h3>
          <p>Assim que você abrir um chamado, ele aparecerá aqui.</p>
        </div>
      )}
    </Modal>
  );
}

export default MyTicketsModal;
