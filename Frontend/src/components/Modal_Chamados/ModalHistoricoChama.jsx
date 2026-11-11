import { useEffect, useMemo, useState } from "react";
import ModalBase from "./ModalBase";
import { formatDateTime, formatPrioridade } from "../../utils/format";

const FILTERS = [
  { value: "mine", label: "Fechados por mim" },
  { value: "all", label: "Todos" },
];

function ModalHistoricoChama({ isOpen, onClose, chamados, currentUsername }) {
  const [filter, setFilter] = useState("mine");

  useEffect(() => {
    if (!isOpen) {
      setFilter("mine");
    }
  }, [isOpen]);

  const fechados = useMemo(
    () =>
      chamados
        .filter((item) => item.status === "Fechado")
        .filter((item) => filter === "all" || item.closedByUsername === currentUsername)
        .sort(
          (first, second) =>
            new Date(second.dataFechamento ?? second.dataAtualizacao) -
            new Date(first.dataFechamento ?? first.dataAtualizacao)
        ),
    [chamados, filter, currentUsername]
  );

  return (
    <ModalBase isOpen={isOpen} onClose={onClose} title="Histórico de chamados fechados" size="wide">
      <div className="segmented-control" role="tablist" aria-label="Filtrar histórico">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={filter === option.value}
            className={filter === option.value ? "is-active" : ""}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="tickets-stack">
        {fechados.length ? (
          fechados.map((item) => (
            <article key={item.id} className="ticket-card">
              <div className="ticket-card-top">
                <div>
                  <h3>{item.assunto}</h3>
                  <p>{item.problema}</p>
                </div>
                <span className="ticket-status status-fechado">
                  {item.autoClosed ? "Encerrado automaticamente" : item.status}
                </span>
              </div>

              <div className="ticket-meta">
                <span>Solicitante: {item.solicitante}</span>
                <span>Local: {item.local}</span>
                <span>Prioridade: {formatPrioridade(item.prioridade)}</span>
                <span>Abertura: {formatDateTime(item.dataCriacao)}</span>
                <span>Fechado em: {formatDateTime(item.dataFechamento ?? item.dataAtualizacao)}</span>
                {item.closedByName || item.closedByUsername ? (
                  <span>Fechado por: {item.closedByName || item.closedByUsername}</span>
                ) : null}
              </div>

              {item.resposta ? (
                <div className="ticket-response">
                  <strong>Resposta da TI</strong>
                  <p>{item.resposta}</p>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h3>Nenhum chamado fechado</h3>
            <p>
              {filter === "mine"
                ? "Os chamados que você fechar aparecerão aqui. Use \"Todos\" para ver os da equipe."
                : "Os chamados fechados pela equipe de TI aparecerão aqui."}
            </p>
          </div>
        )}
      </div>
    </ModalBase>
  );
}

export default ModalHistoricoChama;
