import { useState } from "react";

/**
 * Editor simples de lista de textos (locais, categorias, departamentos...).
 * `format`/`parse` permitem exibir e digitar em outro formato (ex.: datas).
 */
function ListEditor({
  id,
  items,
  onChange,
  placeholder,
  emptyText,
  format = (item) => item,
  parse = (text) => text,
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const add = () => {
    const value = parse(draft.trim());

    if (!draft.trim()) {
      return;
    }

    if (value === null) {
      setError("Valor inválido.");
      return;
    }

    if (items.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setError("Este item já está na lista.");
      return;
    }

    onChange([...items, value]);
    setDraft("");
    setError("");
  };

  return (
    <div className="list-editor">
      <div className="list-editor-add">
        <input
          id={id}
          className="input"
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(event) => {
            setDraft(event.target.value);
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn btn-primary" onClick={add}>
          Adicionar
        </button>
      </div>

      {error ? <p className="field-hint list-editor-error">{error}</p> : null}

      {items.length ? (
        <ul className="list-editor-items">
          {items.map((item) => (
            <li key={item}>
              <span>{format(item)}</span>
              <button
                type="button"
                className="list-editor-remove"
                aria-label={`Remover ${format(item)}`}
                onClick={() => onChange(items.filter((current) => current !== item))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="field-hint">{emptyText}</p>
      )}
    </div>
  );
}

export default ListEditor;
