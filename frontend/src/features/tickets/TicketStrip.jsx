import { useId } from "react";
import { FaChevronDown } from "react-icons/fa6";
import { formatPrioridade } from "../../shared/utils/format";
import { formatProtocolo } from "./ticketDisplay";
import "./TicketStrip.css";

const PRIORITY_LEVEL = { alta: 3, media: 2, baixa: 1 };

/** Três barras, como sinal: Alta enche as três, Baixa só uma. */
export function PriorityMark({ prioridade }) {
  const level = PRIORITY_LEVEL[prioridade] ?? 0;
  const label = formatPrioridade(prioridade) || "Sem prioridade";

  return (
    <span className={`priority-mark priority-${prioridade ?? "none"}`}>
      <span className="priority-bars" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <span key={bar} className={bar <= level ? "is-on" : ""} />
        ))}
      </span>
      {label}
    </span>
  );
}

/**
 * Um chamado como tira do chamado impresso: canhoto (protocolo, prioridade e
 * `stubNote`, ex.: o relógio do SLA) | picote | corpo com assunto e `meta`.
 * Clicar no corpo (ou no canhoto) abre a tira e mostra `children`.
 */
function TicketStrip({ chamado, tone = "ok", stubNote, meta, aside = null, isExpanded, onToggle, children }) {
  const panelId = useId();
  const protocolo = formatProtocolo(chamado.numero);

  return (
    <li className="paper-ticket-frame ticket-strip-frame">
      <article
        className={`paper-ticket ticket-strip tone-${tone} ${isExpanded ? "is-expanded" : ""}`.trim()}
        aria-label={[protocolo, chamado.assunto].filter(Boolean).join(" ")}
      >
        {/* O canhoto também abre a tira com o mouse; no teclado, o botão do corpo faz isso. */}
        <div className="paper-ticket-stub strip-stub" onClick={onToggle}>
          {protocolo ? <span className="strip-protocol">{protocolo}</span> : null}
          <PriorityMark prioridade={chamado.prioridade} />
          {stubNote ? <span className="strip-note">{stubNote}</span> : null}
        </div>

        <div className="paper-ticket-body strip-body">
          <button
            type="button"
            className="strip-header"
            aria-expanded={isExpanded}
            aria-controls={panelId}
            onClick={onToggle}
          >
            <span className="strip-heading">
              <span className="strip-title">{chamado.assunto}</span>
              {meta ? <span className="strip-meta">{meta}</span> : null}
            </span>
            {aside ? <span className="strip-aside">{aside}</span> : null}
            <FaChevronDown className="strip-chevron" aria-hidden="true" />
          </button>

          {isExpanded ? (
            <div id={panelId} className="strip-panel">
              {children}
            </div>
          ) : null}
        </div>
      </article>
    </li>
  );
}

export default TicketStrip;
