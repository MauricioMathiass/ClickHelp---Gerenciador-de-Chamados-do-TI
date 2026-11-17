import { useMemo, useState } from "react";
import { formatDateTime } from "../../shared/utils/format";
import { formatProtocolo, getClosedSeal, joinMeta, requesterLabel } from "./ticketDisplay";
import TicketStrip from "./TicketStrip";
import "./queue.css";

const FILTERS = [
  { value: "mine", label: "Fechados por mim" },
  { value: "all", label: "Todos" },
];

const closedAt = (item) => new Date(item.dataFechamento ?? item.dataAtualizacao);

/** Chamados fechados, com o selo do SLA no canhoto. */
function TicketHistoryView({ chamados, currentUsername, isLoading, onUpdateChamado }) {
  const [filter, setFilter] = useState("mine");
  const [expandedId, setExpandedId] = useState(null);
  const [reopeningId, setReopeningId] = useState(null);
  const [notice, setNotice] = useState({ tone: "ok", text: "" });

  /** Devolve o chamado à fila como "Em andamento"; a resposta já escrita continua lá. */
  const handleReopen = async (chamado) => {
    const protocolo = formatProtocolo(chamado.numero);
    setReopeningId(chamado.id);
    const errorMessage = await onUpdateChamado(chamado.id, { status: "Em andamento" });
    setReopeningId(null);

    if (errorMessage) {
      setNotice({ tone: "error", text: `Não foi possível reabrir ${protocolo}. ${errorMessage}` });
      return;
    }

    setExpandedId(null);
    setNotice({
      tone: "ok",
      text: `Chamado ${protocolo} reaberto. Ele voltou para a Fila de atendimento como "Em andamento".`,
    });
  };

  const fechados = useMemo(
    () =>
      chamados
        .filter((item) => item.status === "Fechado")
        .filter((item) => filter === "all" || item.closedByUsername === currentUsername)
        .sort((first, second) => closedAt(second) - closedAt(first)),
    [chamados, filter, currentUsername]
  );

  const late = fechados.filter((item) => item.slaViolado).length;

  return (
    <section className="view" aria-labelledby="history-title">
      <header className="view-header">
        <div>
          <h1 id="history-title" className="view-title">
            Histórico
          </h1>
          {!isLoading ? (
            <p className="view-summary">
              {fechados.length === 1 ? "1 chamado fechado" : `${fechados.length} chamados fechados`}
              {late ? (
                <>
                  {" · "}
                  <span className="summary-late">{late} com atraso</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>

        <div className="segmented-control" role="group" aria-label="Quais chamados mostrar">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              className={filter === option.value ? "is-active" : ""}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div className={`queue-announcement tone-${notice.tone}`}>
        <p role="status">{notice.text}</p>
      </div>

      {isLoading ? (
        <div className="view-loading" role="status">
          <p>Carregando o histórico...</p>
        </div>
      ) : null}

      {!isLoading && !fechados.length ? (
        <div className="empty-state">
          <h2>Nenhum chamado fechado</h2>
          <p>
            {filter === "mine"
              ? 'Os chamados que você fechar aparecem aqui. Use "Todos" para ver os da equipe.'
              : "Os chamados fechados pela equipe de TI aparecem aqui."}
          </p>
        </div>
      ) : null}

      {fechados.length ? (
        <ol className="strip-list">
          {fechados.map((item) => {
            const seal = getClosedSeal(item);
            const closedBy = item.closedByName || item.closedByUsername;

            return (
              <TicketStrip
                key={item.id}
                chamado={item}
                tone={seal.tone}
                stubNote={seal.label}
                meta={joinMeta(
                  requesterLabel(item),
                  closedBy ? `fechado por ${closedBy}` : "",
                  formatDateTime(item.dataFechamento ?? item.dataAtualizacao)
                )}
                isExpanded={expandedId === item.id}
                onToggle={() => setExpandedId((current) => (current === item.id ? null : item.id))}
              >
                <p className="strip-problem">{item.problema}</p>

                <dl className="strip-facts">
                  <div>
                    <dt>Aberto em</dt>
                    <dd>{formatDateTime(item.dataCriacao)}</dd>
                  </div>
                  <div>
                    <dt>Prazo do SLA</dt>
                    <dd>{formatDateTime(item.dataLimite)}</dd>
                  </div>
                  <div>
                    <dt>Local</dt>
                    <dd>{joinMeta(item.local, item.categoria)}</dd>
                  </div>
                </dl>

                {item.resposta ? (
                  <div className="strip-response">
                    <strong>Resposta da TI</strong>
                    <p>{item.resposta}</p>
                  </div>
                ) : null}

                <div className="queue-actions history-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={reopeningId === item.id}
                    aria-label={`Reabrir chamado ${formatProtocolo(item.numero)}: ${item.assunto}`}
                    onClick={() => handleReopen(item)}
                  >
                    {reopeningId === item.id ? "Reabrindo..." : "Reabrir chamado"}
                  </button>
                </div>
              </TicketStrip>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

export default TicketHistoryView;
