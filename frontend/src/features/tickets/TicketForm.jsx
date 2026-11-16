import { useState } from "react";
import Feedback from "../../shared/components/Feedback";
import Select from "../../shared/components/Select";
import { useSettings } from "../settings/useSettings";
import "./TicketForm.css";

const PRIORIDADE_OPTIONS = [
  { value: "", label: "Selecione a prioridade" },
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
];

const EMPTY_FORM = { assunto: "", local: "", categoria: "", prioridade: "", problema: "" };

const toOptions = (items, placeholder) => [
  { value: "", label: placeholder },
  ...items.map((item) => ({ value: item, label: item })),
];

/**
 * Formulário de nova solicitação, no formato de chamado impresso. Locais e categorias vêm das
 * Configurações da empresa. `onSubmit` devolve uma mensagem de erro ou null.
 */
function TicketForm({ username, onSubmit }) {
  const { catalog, isLoaded, loadError, reload } = useSettings();
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSending, setIsSending] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const retryLoadSettings = async () => {
    setIsRetrying(true);
    // O erro, se houver de novo, aparece pelo `loadError`.
    await reload().catch(() => {});
    setIsRetrying(false);
  };
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const hasCategories = catalog.categories.length > 0;

  const setField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setFeedback({ type: "", text: "" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const missing =
      !form.assunto.trim() ||
      !form.local ||
      !form.prioridade ||
      !form.problema.trim() ||
      (hasCategories && !form.categoria);

    if (missing) {
      setFeedback({ type: "error", text: "Preencha todos os campos obrigatórios antes de enviar." });
      return;
    }

    setIsSending(true);
    const error = await onSubmit(form);
    setIsSending(false);

    if (error) {
      setFeedback({ type: "error", text: error });
      return;
    }

    setForm(EMPTY_FORM);
    setFeedback({ type: "success", text: "Solicitação enviada com sucesso." });
  };

  return (
    <div className="paper-ticket-frame">
      <form className="paper-ticket request-ticket" onSubmit={handleSubmit} noValidate>
        <div className="paper-ticket-stub request-stub">
          <div>
            <h1 className="request-title">Nova solicitação</h1>
            <p className="request-intro">
              Conte o que aconteceu. A equipe de TI responde por aqui, e você acompanha em Minhas
              solicitações.
            </p>
          </div>

          <dl className="request-meta">
            <dt>Solicitante</dt>
            <dd>{username}</dd>
          </dl>
        </div>

        <div className="paper-ticket-body request-body">
          {loadError && !isLoaded ? (
            <div className="feedback feedback-error request-load-error" role="alert">
              {loadError} Sem elas não dá para escolher local e categoria.{" "}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={retryLoadSettings}
                disabled={isRetrying}
              >
                {isRetrying ? "Carregando..." : "Tentar de novo"}
              </button>
            </div>
          ) : null}

          <div className="field">
            <label className="field-label" htmlFor="ticket-assunto">
              Assunto
            </label>
            <input
              id="ticket-assunto"
              className="input"
              type="text"
              value={form.assunto}
              maxLength={150}
              onChange={setField("assunto")}
              placeholder="Ex.: impressora sem conexão"
            />
          </div>

          <div className="request-row">
            <div className="field">
              <label className="field-label" htmlFor="ticket-local">
                Local
              </label>
              <Select
                id="ticket-local"
                className="form-select"
                name="local"
                value={form.local}
                onChange={setField("local")}
                options={toOptions(catalog.locations, "Selecione um local")}
              />
              {isLoaded && !catalog.locations.length ? (
                <p className="field-hint">
                  Nenhum local cadastrado. O administrador cadastra em Configurações → Cadastros.
                </p>
              ) : null}
            </div>

            {hasCategories ? (
              <div className="field">
                <label className="field-label" htmlFor="ticket-categoria">
                  Categoria
                </label>
                <Select
                  id="ticket-categoria"
                  className="form-select"
                  name="categoria"
                  value={form.categoria}
                  onChange={setField("categoria")}
                  options={toOptions(catalog.categories, "Selecione a categoria")}
                />
              </div>
            ) : null}

            <div className="field">
              <label className="field-label" htmlFor="ticket-prioridade">
                Prioridade
              </label>
              <Select
                id="ticket-prioridade"
                className="form-select"
                name="prioridade"
                value={form.prioridade}
                onChange={setField("prioridade")}
                options={PRIORIDADE_OPTIONS}
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="ticket-problema">
              Descreva o problema
            </label>
            <textarea
              id="ticket-problema"
              className="input"
              rows="5"
              value={form.problema}
              maxLength={5000}
              onChange={setField("problema")}
              placeholder="O que aconteceu, desde quando e o que você já tentou."
            />
          </div>

          <Feedback type={feedback.type}>{feedback.text}</Feedback>

          <div className="request-actions">
            <button type="submit" className="request-submit" disabled={isSending}>
              {isSending ? "Enviando..." : "Enviar solicitação"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default TicketForm;
