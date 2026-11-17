import { useEffect, useMemo, useState } from "react";
import Select from "../../shared/components/Select";
import { COLD_START_MESSAGE, useSlowFlag } from "../../shared/hooks/useSlowFlag";
import { formatDateTime, statusClassName } from "../../shared/utils/format";
import {
  compareByDeadline,
  formatProtocolo,
  formatSpan,
  getSlaClock,
  joinMeta,
  requesterLabel,
} from "./ticketDisplay";
import TicketStrip from "./TicketStrip";
import "./queue.css";

const STATUS_ABERTO = "Aberto";
const STATUS_ANDAMENTO = "Em andamento";
const STATUS_FECHADO = "Fechado";

const STATUS_FILTERS = [
  { value: "", label: "Todos abertos" },
  { value: STATUS_ABERTO, label: "Aberto" },
  { value: STATUS_ANDAMENTO, label: "Em andamento" },
];

const PRIORITY_FILTERS = [
  { value: "", label: "Todas as prioridades" },
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];

const CLOCK_TICK_MS = 60 * 1000;
/** Tempo para desfazer o fechamento de um chamado. */
const UNDO_MS = 25 * 1000;

/** Hora atual, atualizada a cada minuto, para o relógio do SLA andar sozinho. */
const useNow = () => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return now;
};

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/**
 * Fila de atendimento do TI: chamados abertos como tiras do chamado impresso,
 * o prazo mais próximo primeiro. `onUpdateChamado` devolve a mensagem de erro ou null.
 */
function TiQueueView({ chamados, isLoading, onUpdateChamado, drafts, setDrafts }) {
  const now = useNow();
  const isSlow = useSlowFlag(isLoading);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [errors, setErrors] = useState({});
  const [savingId, setSavingId] = useState(null);
  // Aviso da última ação: { text, tone: "ok" | "late" | "error" }.
  const [announcement, setAnnouncement] = useState(null);
  // Chamado recém-fechado: fica no lugar dele na fila, com "Desfazer", por alguns segundos.
  const [recentlyClosed, setRecentlyClosed] = useState(null);
  const [isUndoPaused, setIsUndoPaused] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  // O prazo do "Desfazer" para enquanto o mouse ou o foco estão nele.
  useEffect(() => {
    if (!recentlyClosed || isUndoPaused) {
      return undefined;
    }

    const id = window.setTimeout(() => setRecentlyClosed(null), UNDO_MS);
    return () => window.clearTimeout(id);
  }, [recentlyClosed, isUndoPaused]);

  const abertos = useMemo(
    () =>
      chamados
        .filter((item) => item.status !== STATUS_FECHADO)
        .map((item) => ({ ...item, clock: getSlaClock(item, now) }))
        .sort(compareByDeadline),
    [chamados, now]
  );

  const counts = useMemo(
    () => ({
      total: abertos.length,
      late: abertos.filter((item) => item.clock.tone === "late").length,
      dueToday: abertos.filter((item) => item.clock.dueToday).length,
    }),
    [abertos]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return abertos.filter(
      (item) =>
        (!statusFilter || item.status === statusFilter) &&
        (!priorityFilter || item.prioridade === priorityFilter) &&
        (!term ||
          String(item.assunto ?? "")
            .toLowerCase()
            .includes(term) ||
          `${item.solicitante ?? ""} ${item.solicitanteNome ?? ""}`.toLowerCase().includes(term) ||
          formatProtocolo(item.numero).includes(term))
    );
  }, [abertos, statusFilter, priorityFilter, search]);

  // A fila com o chamado recém-fechado de volta no lugar onde estava (para o "Desfazer").
  const rows = useMemo(() => {
    const closed = recentlyClosed?.chamado;

    if (!closed || visible.some((item) => item.id === closed.id)) {
      return visible;
    }

    return [...visible, { ...closed, isRecentlyClosed: true }].sort(compareByDeadline);
  }, [visible, recentlyClosed]);

  const getDraft = (chamado) => drafts[chamado.id] ?? chamado.resposta ?? "";

  const setError = (id, message) => setErrors((current) => ({ ...current, [id]: message }));

  const toggle = (id) => () => setExpandedId((current) => (current === id ? null : id));

  const submit = async (chamado, updates, successMessage) => {
    setSavingId(chamado.id);
    setError(chamado.id, "");
    const errorMessage = await onUpdateChamado(chamado.id, updates);
    setSavingId(null);

    if (errorMessage) {
      setError(chamado.id, errorMessage);
      return false;
    }

    setDrafts((current) => {
      const next = { ...current };
      delete next[chamado.id];
      return next;
    });
    setAnnouncement({ text: successMessage, tone: "ok" });
    return true;
  };

  const handleStatus = (chamado, status) => {
    if (status !== chamado.status) {
      submit(chamado, { status }, `${formatProtocolo(chamado.numero)} agora está ${status.toLowerCase()}.`);
    }
  };

  const handleSave = (chamado) => {
    const resposta = getDraft(chamado).trim();

    if (!resposta) {
      setError(chamado.id, "Escreva a resposta antes de salvar.");
      return;
    }

    const updates = { resposta };

    if (chamado.status === STATUS_ABERTO) {
      updates.status = STATUS_ANDAMENTO;
    }

    submit(chamado, updates, `Resposta de ${formatProtocolo(chamado.numero)} salva.`);
  };

  const handleClose = async (chamado) => {
    const resposta = getDraft(chamado).trim();

    if (!resposta) {
      setError(chamado.id, "Escreva a resposta da TI antes de fechar o chamado.");
      return;
    }

    const protocolo = formatProtocolo(chamado.numero);
    const closed = await submit(
      chamado,
      { resposta, status: STATUS_FECHADO },
      `Chamado ${protocolo} fechado.`
    );

    if (!closed) {
      return;
    }

    // O servidor marca o SLA como violado quando o fechamento passa do prazo; o relógio diz o mesmo.
    const slaNote = { late: " · com atraso", none: "" }[chamado.clock.tone] ?? " · no prazo";
    const text = `Chamado ${protocolo} fechado${slaNote}.`;
    setExpandedId(null);
    setIsUndoPaused(false);
    setRecentlyClosed({ chamado, previousStatus: chamado.status, text });
    // O aviso visível fica na própria fila; aqui só o leitor de tela ouve.
    setAnnouncement({ text: `${text} Dá para desfazer no lugar dele na fila.`, tone: "ok", srOnly: true });
  };

  /** Reabre o chamado que acabou de ser fechado, no status em que estava. */
  const handleUndo = async () => {
    const { chamado, previousStatus } = recentlyClosed;
    const protocolo = formatProtocolo(chamado.numero);

    setIsUndoing(true);
    const errorMessage = await onUpdateChamado(chamado.id, { status: previousStatus });
    setIsUndoing(false);

    if (errorMessage) {
      setAnnouncement({ text: `Não foi possível reabrir ${protocolo}. ${errorMessage}`, tone: "error" });
      return;
    }

    setRecentlyClosed(null);
    setAnnouncement({ text: `Chamado ${protocolo} reaberto.`, tone: "ok" });
    setExpandedId(chamado.id);
  };

  const clearFilters = () => {
    setStatusFilter("");
    setPriorityFilter("");
    setSearch("");
  };

  return (
    <section className="view" aria-labelledby="queue-title">
      <header className="view-header">
        <div>
          <h1 id="queue-title" className="view-title">
            Fila de atendimento
          </h1>
          {!isLoading ? (
            <p className="view-summary">
              {plural(counts.total, "chamado aberto", "chamados abertos")}
              {counts.late ? (
                <>
                  {" · "}
                  <span className="summary-late">{plural(counts.late, "atrasado", "atrasados")}</span>
                </>
              ) : null}
              {counts.dueToday ? ` · ${plural(counts.dueToday, "vence hoje", "vencem hoje")}` : null}
            </p>
          ) : null}
        </div>
      </header>

      <div className="queue-toolbar" role="search" aria-label="Filtrar a fila">
        <div className="segmented-control queue-status-filter" role="group" aria-label="Status">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.value || "all"}
              type="button"
              aria-pressed={statusFilter === option.value}
              className={statusFilter === option.value ? "is-active" : ""}
              onClick={() => setStatusFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="queue-priority-filter">
          <label className="visually-hidden" htmlFor="queue-priority">
            Prioridade
          </label>
          <Select
            id="queue-priority"
            className="compact"
            name="prioridade"
            value={priorityFilter}
            options={PRIORITY_FILTERS}
            onChange={(event) => setPriorityFilter(event.target.value)}
          />
        </div>

        <div className="queue-search">
          <label className="visually-hidden" htmlFor="queue-search">
            Buscar na fila
          </label>
          <input
            id="queue-search"
            className="input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Assunto, solicitante ou protocolo"
          />
        </div>
      </div>

      <div
        className={`queue-announcement tone-${announcement?.tone ?? "ok"} ${announcement?.srOnly ? "is-sr-only" : ""}`}
      >
        <p role="status">{announcement?.text}</p>
      </div>

      {isLoading ? (
        <div className="view-loading" role="status">
          <p>Carregando a fila...</p>
          {isSlow ? <p className="view-loading-hint">{COLD_START_MESSAGE}</p> : null}
        </div>
      ) : null}

      {!isLoading && !abertos.length && !recentlyClosed ? (
        <div className="empty-state queue-empty">
          <h2>Fila em dia</h2>
          <p>Nenhum chamado aberto agora. Os novos aparecem aqui assim que forem enviados.</p>
        </div>
      ) : null}

      {!isLoading && abertos.length && !rows.length ? (
        <div className="empty-state">
          <h2>Nenhum chamado com esses filtros</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
            Limpar filtros
          </button>
        </div>
      ) : null}

      {rows.length ? (
        <ol className="strip-list">
          {rows.map((item) => {
            if (item.isRecentlyClosed) {
              return (
                <li
                  key={item.id}
                  className="strip-closed"
                  onMouseEnter={() => setIsUndoPaused(true)}
                  onMouseLeave={() => setIsUndoPaused(false)}
                  onFocus={() => setIsUndoPaused(true)}
                  onBlur={() => setIsUndoPaused(false)}
                >
                  <span>
                    {recentlyClosed.text} <span className="strip-closed-subject">{item.assunto}</span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleUndo}
                    disabled={isUndoing}
                  >
                    {isUndoing ? "Reabrindo..." : "Desfazer"}
                  </button>
                </li>
              );
            }

            const isSaving = savingId === item.id;
            const draft = getDraft(item);
            const errorId = `queue-error-${item.id}`;
            const responseId = `queue-response-${item.id}`;
            const created = new Date(item.dataCriacao).getTime();
            const age = Number.isNaN(created) ? "" : `aberto há ${formatSpan(Math.max(0, now - created))}`;

            return (
              <TicketStrip
                key={item.id}
                chamado={item}
                tone={item.clock.tone}
                stubNote={item.clock.label}
                meta={joinMeta(requesterLabel(item), item.local, item.categoria, age)}
                aside={<span className={`ticket-status ${statusClassName(item.status)}`}>{item.status}</span>}
                isExpanded={expandedId === item.id}
                onToggle={toggle(item.id)}
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
                </dl>

                <div className="queue-work">
                  <div className="field">
                    <span className="field-label" id={`queue-status-${item.id}`}>
                      Status
                    </span>
                    <div
                      className="segmented-control queue-status-switch"
                      role="group"
                      aria-labelledby={`queue-status-${item.id}`}
                    >
                      {[STATUS_ABERTO, STATUS_ANDAMENTO].map((status) => (
                        <button
                          key={status}
                          type="button"
                          aria-pressed={item.status === status}
                          className={item.status === status ? "is-active" : ""}
                          disabled={isSaving}
                          onClick={() => handleStatus(item, status)}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor={responseId}>
                      Resposta da TI
                    </label>
                    <textarea
                      id={responseId}
                      className="input"
                      rows="4"
                      value={draft}
                      maxLength={5000}
                      aria-invalid={errors[item.id] ? true : undefined}
                      aria-describedby={errors[item.id] ? errorId : undefined}
                      placeholder="O que foi feito e o que o solicitante precisa saber."
                      onChange={(event) => {
                        const { value } = event.target;
                        setDrafts((current) => ({ ...current, [item.id]: value }));
                        setError(item.id, "");
                      }}
                    />
                    {errors[item.id] ? (
                      <p id={errorId} className="field-error" role="alert">
                        {errors[item.id]}
                      </p>
                    ) : null}
                  </div>

                  <div className="queue-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={isSaving || draft.trim() === (item.resposta ?? "").trim()}
                      onClick={() => handleSave(item)}
                    >
                      Salvar resposta
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={isSaving}
                      aria-label={`Fechar chamado ${formatProtocolo(item.numero)}: ${item.assunto}`}
                      onClick={() => handleClose(item)}
                    >
                      {isSaving ? "Salvando..." : "Fechar chamado"}
                    </button>
                  </div>
                </div>
              </TicketStrip>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

export default TiQueueView;
