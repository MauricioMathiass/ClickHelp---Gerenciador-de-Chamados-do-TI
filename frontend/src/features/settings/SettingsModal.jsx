import { useEffect, useState } from "react";
import Feedback from "../../shared/components/Feedback";
import Modal from "../../shared/components/Modal";
import Select from "../../shared/components/Select";
import ListEditor from "./ListEditor";
import { useSettings } from "./useSettings";
import "./settings.css";

const TABS = [
  { value: "branding", label: "Empresa" },
  { value: "catalog", label: "Cadastros" },
  { value: "sla", label: "SLA e expediente" },
  { value: "holidays", label: "Feriados" },
  { value: "routines", label: "Rotinas" },
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PRIORITIES = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];
const FREQUENCIES = [
  { value: "daily", label: "Todo dia útil" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
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

const newRoutine = () => ({
  id: `rotina-${Date.now().toString(36)}`,
  title: "",
  description: "",
  location: "",
  priority: "media",
  time: "08:00",
  frequency: "daily",
  weekdays: [1],
  monthDay: 1,
  active: true,
});

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
    <div className="settings-grid">
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
          <span
            className="color-preview"
            style={{
              background: `linear-gradient(180deg, ${branding.primaryColor}, ${branding.secondaryColor})`,
            }}
          >
            Prévia do botão
          </span>
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
  );
}

function CatalogTab({ draft, update }) {
  const sections = [
    {
      key: "locations",
      title: "Locais / unidades",
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
          <h3>{section.title}</h3>
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
        <h3>Expediente</h3>
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
        <h3>Prazo por prioridade</h3>
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
        <h3>Feriados da empresa ou da cidade</h3>
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

function RoutineCard({ routine, index, locations, update }) {
  const set = (field, value) => update((next) => (next.routines[index][field] = value));
  const locationOptions = [
    { value: "", label: "Sem local" },
    ...locations.map((item) => ({ value: item, label: item })),
  ];

  return (
    <article className="routine-card">
      <div className="routine-card-top">
        <label className="check-row">
          <input
            type="checkbox"
            checked={routine.active}
            onChange={(event) => set("active", event.target.checked)}
          />
          <span>{routine.active ? "Ativa" : "Desativada"}</span>
        </label>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={() => update((next) => next.routines.splice(index, 1))}
        >
          Remover
        </button>
      </div>

      <div className="settings-grid">
        <div className="field">
          <label className="field-label" htmlFor={`routine-title-${routine.id}`}>
            Título
          </label>
          <input
            id={`routine-title-${routine.id}`}
            className="input"
            maxLength={150}
            value={routine.title}
            onChange={(event) => set("title", event.target.value)}
            placeholder="Ex.: Conferir backup"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor={`routine-location-${routine.id}`}>
            Local
          </label>
          <Select
            id={`routine-location-${routine.id}`}
            className="compact"
            name="local"
            value={routine.location}
            options={locationOptions}
            onChange={(event) => set("location", event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor={`routine-frequency-${routine.id}`}>
            Frequência
          </label>
          <Select
            id={`routine-frequency-${routine.id}`}
            className="compact"
            name="frequencia"
            value={routine.frequency}
            options={FREQUENCIES}
            onChange={(event) =>
              update((next) => {
                const target = next.routines[index];
                target.frequency = event.target.value;
                // Valores iniciais ao trocar a frequência.
                if (target.frequency === "weekly" && !target.weekdays?.length) target.weekdays = [1];
                if (target.frequency === "monthly" && !target.monthDay) target.monthDay = 1;
              })
            }
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor={`routine-time-${routine.id}`}>
            Horário de abertura
          </label>
          <input
            id={`routine-time-${routine.id}`}
            className="input"
            type="time"
            value={routine.time}
            onChange={(event) => set("time", event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor={`routine-priority-${routine.id}`}>
            Prioridade
          </label>
          <Select
            id={`routine-priority-${routine.id}`}
            className="compact"
            name="prioridade"
            value={routine.priority}
            options={PRIORITIES}
            onChange={(event) => set("priority", event.target.value)}
          />
        </div>

        {routine.frequency === "monthly" ? (
          <div className="field">
            <label className="field-label" htmlFor={`routine-day-${routine.id}`}>
              Dia do mês
            </label>
            <input
              id={`routine-day-${routine.id}`}
              className="input"
              type="number"
              min={1}
              max={31}
              value={routine.monthDay ?? 1}
              onChange={(event) => set("monthDay", Number(event.target.value))}
            />
          </div>
        ) : null}
      </div>

      {routine.frequency === "weekly" ? (
        <div className="field">
          <span className="field-label">Dias da semana</span>
          <WeekdayPicker
            label="Dias da semana da rotina"
            value={routine.weekdays ?? []}
            onChange={(days) => set("weekdays", days)}
          />
        </div>
      ) : null}

      <div className="field">
        <label className="field-label" htmlFor={`routine-description-${routine.id}`}>
          Descrição
        </label>
        <textarea
          id={`routine-description-${routine.id}`}
          className="input routine-description"
          maxLength={500}
          value={routine.description}
          onChange={(event) => set("description", event.target.value)}
          placeholder="O que deve ser feito nesta rotina"
        />
      </div>
    </article>
  );
}

function RoutinesTab({ draft, update }) {
  return (
    <div className="settings-stack">
      <p className="field-hint">
        Rotinas abrem chamados automaticamente, visíveis só para administradores. Quando uma nova ocorrência é
        aberta, a anterior que ficou aberta é encerrada. Rotinas não entram no relatório de SLA.
      </p>

      {draft.routines.map((routine, index) => (
        <RoutineCard
          key={routine.id}
          routine={routine}
          index={index}
          locations={draft.catalog.locations}
          update={update}
        />
      ))}

      {!draft.routines.length ? (
        <div className="empty-state">
          <h3>Nenhuma rotina cadastrada</h3>
          <p>Cadastre tarefas recorrentes da equipe de TI, como conferir backups.</p>
        </div>
      ) : null}

      <div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => update((next) => next.routines.push(newRoutine()))}
        >
          Adicionar rotina
        </button>
      </div>
    </div>
  );
}

function SettingsModal({ isOpen = true, onClose }) {
  const { settings, options, reload, save } = useSettings();
  const [tab, setTab] = useState("branding");
  const [draft, setDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configurações"
      size="wide"
      actions={
        <div className="settings-actions">
          <Feedback type={feedback.type}>{feedback.text}</Feedback>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Fechar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!hasChanges || isSaving}
            onClick={handleSave}
          >
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      }
    >
      <div className="segmented-control settings-tabs" role="tablist" aria-label="Seções das configurações">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={tab === item.value ? "is-active" : ""}
            onClick={() => setTab(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!draft ? (
        <p className="field-hint">Carregando...</p>
      ) : (
        <div role="tabpanel">
          {tab === "branding" ? <BrandingTab {...tabProps} /> : null}
          {tab === "catalog" ? <CatalogTab {...tabProps} /> : null}
          {tab === "sla" ? <SlaTab {...tabProps} /> : null}
          {tab === "holidays" ? <HolidaysTab {...tabProps} movableOptions={options.movableHolidays} /> : null}
          {tab === "routines" ? <RoutinesTab {...tabProps} /> : null}
        </div>
      )}
    </Modal>
  );
}

export default SettingsModal;
