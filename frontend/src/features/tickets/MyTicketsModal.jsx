import { useState } from "react";
import Modal from "../../shared/components/Modal";
import { formatDateTime, statusClassName } from "../../shared/utils/format";
import { formatDueDay, getClosedSeal, joinMeta } from "./ticketDisplay";
import TicketStrip from "./TicketStrip";

/** O que o solicitante vê no canhoto: até quando a TI deve responder, ou como terminou. */
const getRequesterNote = (item) => {
  if (item.status === "Fechado") {
    const seal = getClosedSeal(item);
    return { tone: "none", label: seal.tone === "late" ? "Fechado fora do prazo" : "Fechado" };
  }

  const deadline = new Date(item.dataLimite).getTime();

  if (!item.dataLimite || Number.isNaN(deadline)) {
    return { tone: "ok", label: "Sem prazo definido" };
  }

  return { tone: "ok", label: `Previsto até ${formatDueDay(deadline)}` };
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
