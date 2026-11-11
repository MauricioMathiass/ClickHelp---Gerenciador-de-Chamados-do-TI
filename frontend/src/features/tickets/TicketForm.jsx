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
 * Formulário "Cadastrar solicitação". Locais e categorias vêm das
 * Configurações da empresa. `onSubmit` devolve uma mensagem de erro ou null.
 */
function TicketForm({ username, onSubmit }) {
  const { catalog } = useSettings();
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSending, setIsSending] = useState(false);
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
    <form className="ticket-form surface-card" onSubmit={handleSubmit}>
      <div className="ticket-form-title">
        <h2>Cadastrar solicitação</h2>
        <p>Abra um novo chamado para a equipe de tecnologia.</p>
      </div>

      <div className="ticket-form-grid">
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

        <div className="field">
          <label className="field-label" htmlFor="ticket-solicitante">
            Solicitante
          </label>
          <input id="ticket-solicitante" className="input" type="text" value={username} readOnly />
        </div>

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

        <div className="field ticket-form-full">
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
            placeholder="Conte com detalhes o que está acontecendo."
          />
        </div>
      </div>

      <Feedback type={feedback.type}>{feedback.text}</Feedback>

      <div className="ticket-form-actions">
        <button type="submit" className="btn btn-primary btn-lg" disabled={isSending}>
          {isSending ? "Enviando..." : "Enviar solicitação"}
        </button>
      </div>
    </form>
  );
}

export default TicketForm;
