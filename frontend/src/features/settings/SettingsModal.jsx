import { useEffect, useState } from "react";
import Feedback from "../../shared/components/Feedback";
import BrandName from "../../shared/components/BrandName";
import Modal from "../../shared/components/Modal";
import ListEditor from "./ListEditor";
import { useSettings } from "./useSettings";
import "./settings.css";

const TABS = [
  { value: "branding", label: "Empresa", hint: "Nome, cores e logo" },
  { value: "catalog", label: "Cadastros", hint: "Locais, categorias e departamentos" },
  { value: "sla", label: "SLA e expediente", hint: "Horário de trabalho e prazos" },
  { value: "holidays", label: "Feriados", hint: "Dias sem atendimento" },
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PRIORITIES = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];
const MAX_LOGO_BYTES = 300 * 1024;

const clone = (value) => JSON.parse(JSON.stringify(value));

// Feriados extras: guardados como MM-DD, exibidos e digitados como DD/MM.
const formatMonthDay = (value) => value.split("-").reverse().join("/");
const parseDayMonth = (text) => {
  const match = text.match(/^(\d{1,2})\/(\d{1,2})$/);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

function WeekdayPicker({ value, onChange, label }) {
  const toggle = (day) =>
    onChange(value.includes(day) ? value.filter((item) => item !== day) : [...value, day].sort());

  return (
    <div className="weekday-picker" role="group" aria-label={label}>
      {WEEKDAYS.map((name, day) => (
        <button
          key={name}
          type="button"
          className={value.includes(day) ? "is-active" : ""}
          aria-pressed={value.includes(day)}
          onClick={() => toggle(day)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

/**
 * Miniatura da tela de login com o rascunho (nome, cores e logo), antes de salvar.
 * As cores derivadas da marca são recalculadas aqui porque, no :root, elas já
 * foram resolvidas com as cores salvas.
 */
function BrandingPreview({ branding }) {
  const { primaryColor, secondaryColor } = branding;
  const style = {
    "--brand-primary": primaryColor,
    "--brand-secondary": secondaryColor,
    "--brand-light": `color-mix(in srgb, ${primaryColor} 55%, #ffffff)`,
    "--brand-gradient": `linear-gradient(180deg, ${primaryColor}, ${secondaryColor})`,
  };

  return (
    <figure className="brand-preview" style={style}>
      <div className="paper-ticket-frame" aria-hidden="true">
        <div className="paper-ticket brand-preview-ticket">
          <div className="paper-ticket-stub brand-preview-stub">
            {branding.logoDataUrl ? (
              <img className="brand-logo" src={branding.logoDataUrl} alt="" />
            ) : (
              <div className="brand-mark">
                <span className="brand-mark-core"></span>
              </div>
            )}
            <div>
              <p className="brand-wordmark brand-preview-name">
                <BrandName name={branding.appName || "Nome do sistema"} />
              </p>
              {branding.companyName ? <p className="brand-preview-company">{branding.companyName}</p> : null}
            </div>
          </div>
          <div className="paper-ticket-body brand-preview-body">
            <span className="brand-preview-field"></span>
            <span className="brand-preview-field"></span>
            <span className="brand-preview-button">Entrar</span>
          </div>
        </div>
      </div>
      <figcaption>Prévia da tela de login, com as alterações ainda não salvas.</figcaption>
    </figure>
  );
}

function BrandingTab({ draft, update }) {
  const [logoError, setLogoError] = useState("");
  const branding = draft.branding;
  const set = (field) => (event) => update((next) => (next.branding[field] = event.target.value));

  const handleLogo = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) {
      setLogoError("Use uma imagem PNG, JPG, WEBP ou SVG.");
      return;
    }

    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("O logo deve ter no máximo 300 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoError("");
      update((next) => (next.branding.logoDataUrl = String(reader.result)));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="settings-branding">
      <div className="settings-branding-fields">
        <div className="field">
          <label className="field-label" htmlFor="settings-app-name">
            Nome do sistema
          </label>
          <input
            id="settings-app-name"
            className="input"
            maxLength={40}
            value={branding.appName}
            onChange={set("appName")}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="settings-company">
            Nome da empresa
          </label>
          <input
            id="settings-company"
            className="input"
            maxLength={80}
            value={branding.companyName}
            onChange={set("companyName")}
            placeholder="Ex.: Empresa Exemplo Ltda."
          />
        </div>

        <div className="field">
          <span className="field-label">Cores da marca</span>
          <div className="color-row">
            <label className="color-field">
              <input type="color" value={branding.primaryColor} onChange={set("primaryColor")} />
              <span>Principal</span>
            </label>
            <label className="color-field">
              <input type="color" value={branding.secondaryColor} onChange={set("secondaryColor")} />
              <span>Secundária</span>
            </label>
          </div>
        </div>

        <div className="field">
          <span className="field-label">Logo</span>
          <div className="logo-row">
            {branding.logoDataUrl ? (
              <img className="logo-preview" src={branding.logoDataUrl} alt="Logo atual" />
            ) : null}
            <label className="btn btn-ghost">
              {branding.logoDataUrl ? "Trocar logo" : "Enviar logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                hidden
                onChange={handleLogo}
              />
            </label>
            {branding.logoDataUrl ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => update((next) => (next.branding.logoDataUrl = ""))}
              >
                Remover
              </button>
            ) : null}
          </div>
          <p className="field-hint">PNG, JPG, WEBP ou SVG de até 300 KB.</p>
          <Feedback>{logoError}</Feedback>
        </div>
      </div>

      <BrandingPreview branding={branding} />
    </div>
  );
}

function CatalogTab({ draft, update }) {
  const sections = [
    {
      key: "locations",
      title: "Locais e unidades",
      hint: 'Aparecem no campo "Local" ao abrir um chamado.',
      placeholder: "Ex.: Matriz, Filial Centro",
    },
    {
      key: "categories",
      title: "Categorias de chamado",
      hint: 'Se a lista ficar vazia, o campo "Categoria" deixa de aparecer.',
      placeholder: "Ex.: Hardware, Software",
    },
    {
      key: "departments",
      title: "Departamentos",
      hint: "Usados no cadastro de usuários.",
      placeholder: "Ex.: Financeiro, RH",
    },
  ];

  return (
    <div className="settings-stack">
      {sections.map((section) => (
        <section key={section.key} className="settings-section">
          <h4>{section.title}</h4>
          <p className="field-hint">{section.hint}</p>
          <ListEditor
            id={`settings-${section.key}`}
            items={draft.catalog[section.key]}
            placeholder={section.placeholder}
            emptyText="Nenhum item cadastrado."
            onChange={(items) => update((next) => (next.catalog[section.key] = items))}
          />
        </section>
      ))}
    </div>
  );
}

function SlaTab({ draft, update }) {
  const sla = draft.sla;
  const setNumber = (setter) => (event) => update((next) => setter(next, Number(event.target.value)));

  return (
    <div className="settings-stack">
      <section className="settings-section">
        <h4>Expediente</h4>
        <p className="field-hint">O prazo do SLA só conta dentro do expediente e nos dias úteis.</p>
        <div className="settings-grid">
          <div className="field">
            <label className="field-label" htmlFor="settings-start">
              Início (hora)
            </label>
            <input
              id="settings-start"
              className="input"
              type="number"
              min={0}
              max={23}
              value={sla.workStartHour}
              onChange={setNumber((next, value) => (next.sla.workStartHour = value))}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="settings-end">
              Fim (hora)
            </label>
            <input
              id="settings-end"
              className="input"
              type="number"
              min={1}
              max={24}
              value={sla.workEndHour}
              onChange={setNumber((next, value) => (next.sla.workEndHour = value))}
            />
          </div>
        </div>
        <span className="field-label">Dias úteis</span>
        <WeekdayPicker
          label="Dias úteis"
          value={sla.workDays}
          onChange={(days) => update((next) => (next.sla.workDays = days))}
        />
      </section>

      <section className="settings-section">
        <h4>Prazo por prioridade</h4>
        <p className="field-hint">Horas úteis para atender o chamado, contadas a partir da abertura.</p>
        <div className="settings-grid settings-grid-3">
          {PRIORITIES.map((priority) => (
            <div key={priority.value} className="field">
              <label className="field-label" htmlFor={`settings-sla-${priority.value}`}>
                {priority.label} (horas)
              </label>
              <input
                id={`settings-sla-${priority.value}`}
                className="input"
                type="number"
                min={1}
                max={2000}
                value={sla.hoursByPriority[priority.value]}
                onChange={setNumber((next, value) => (next.sla.hoursByPriority[priority.value] = value))}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function HolidaysTab({ draft, update, movableOptions }) {
  const holidays = draft.holidays;
  const toggleMovable = (value) =>
    update((next) => {
      const list = next.holidays.movable;
      next.holidays.movable = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
    });

  return (
    <div className="settings-stack">
      <section className="settings-section">
        <label className="check-row">
          <input
            type="checkbox"
            checked={holidays.national}
            onChange={(event) => update((next) => (next.holidays.national = event.target.checked))}
          />
          <span>Considerar os feriados nacionais do Brasil (inclui a Sexta-feira Santa)</span>
        </label>

        {movableOptions.map((option) => (
          <label key={option.value} className="check-row">
            <input
              type="checkbox"
              checked={holidays.movable.includes(option.value)}
              onChange={() => toggleMovable(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </section>

      <section className="settings-section">
        <h4>Feriados da empresa ou da cidade</h4>
        <p className="field-hint">Datas que se repetem todo ano, no formato DD/MM (ex.: 25/01).</p>
        <ListEditor
          id="settings-extra-holidays"
          items={holidays.extra}
          placeholder="DD/MM"
          emptyText="Nenhum feriado extra."
          format={formatMonthDay}
          parse={parseDayMonth}
          onChange={(items) => update((next) => (next.holidays.extra = [...items].sort()))}
        />
      </section>
    </div>
  );
}

function SettingsModal({ isOpen = true, onClose }) {
  const { settings, options, reload, save } = useSettings();
  const [tab, setTab] = useState("branding");
  const [draft, setDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Ao abrir, recarrega do servidor e começa a edição a partir dele.
  useEffect(() => {
    reload()
      .then((current) => setDraft(clone(current)))
      .catch(() => setFeedback({ type: "error", text: "Não foi possível carregar as configurações." }));
  }, [reload]);

  /** Altera uma cópia do rascunho (o `mutator` pode modificar o objeto à vontade). */
  const update = (mutator) => {
    setDraft((current) => {
      const next = clone(current);
      mutator(next);
      return next;
    });
    setFeedback({ type: "", text: "" });
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const saved = await save(draft);
      setDraft(clone(saved));
      setFeedback({ type: "success", text: "Configurações salvas com sucesso." });
    } catch (error) {
      setFeedback({ type: "error", text: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = draft && settings && JSON.stringify(draft) !== JSON.stringify(settings);
  const tabProps = { draft, update };

  // Fechar (botão, Esc ou clique fora) com alterações pendentes pede confirmação antes de descartar.
  const requestClose = () => {
    if (hasChanges && !isSaving) {
      setConfirmDiscard(true);
      return;
    }

    onClose();
  };

  const activeTab = TABS.find((item) => item.value === tab);

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      title="Configurações"
      size="wide"
      className="settings-modal"
      actions={
        confirmDiscard ? (
          <div
            className="settings-actions settings-discard"
            role="alertdialog"
            aria-label="Descartar alterações"
          >
            <p className="settings-status">As alterações não salvas serão perdidas. Descartar e fechar?</p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setConfirmDiscard(false)}
              autoFocus
            >
              Continuar editando
            </button>
            <button type="button" className="btn btn-danger" onClick={onClose}>
              Descartar e fechar
            </button>
          </div>
        ) : (
          <div className="settings-actions">
            {feedback.text ? (
              <Feedback type={feedback.type}>{feedback.text}</Feedback>
            ) : (
              <p className="settings-status" aria-live="polite">
                {hasChanges ? "Há alterações não salvas." : ""}
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!hasChanges || isSaving}
              onClick={handleSave}
            >
              {isSaving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        )
      }
    >
      <div className="settings-layout">
        <div
          className="settings-nav"
          role="tablist"
          aria-label="Seções das configurações"
          aria-orientation="vertical"
        >
          {TABS.map((item) => (
            <button
              key={item.value}
              id={`settings-tab-${item.value}`}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              aria-controls="settings-panel"
              className={`settings-nav-item ${tab === item.value ? "is-active" : ""}`.trim()}
              onClick={() => setTab(item.value)}
            >
              <span className="settings-nav-label">{item.label}</span>
              <span className="settings-nav-hint">{item.hint}</span>
            </button>
          ))}
        </div>

        <div
          id="settings-panel"
          className="settings-panel"
          role="tabpanel"
          aria-labelledby={`settings-tab-${tab}`}
        >
          <h3 className="settings-panel-title">{activeTab.label}</h3>

          {!draft ? (
            <p className="field-hint">Carregando...</p>
          ) : (
            <>
              {tab === "branding" ? <BrandingTab {...tabProps} /> : null}
              {tab === "catalog" ? <CatalogTab {...tabProps} /> : null}
              {tab === "sla" ? <SlaTab {...tabProps} /> : null}
              {tab === "holidays" ? (
                <HolidaysTab {...tabProps} movableOptions={options.movableHolidays} />
              ) : null}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default SettingsModal;
