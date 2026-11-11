import { useEffect, useMemo, useRef, useState } from "react";
import "./Select.css";

function Select({
  className = "",
  disabled = false,
  id,
  name,
  onChange,
  options,
  placeholder = "Selecione uma opcao",
  value,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      // Com a lista aberta, Esc fecha só a lista (e não o modal em volta).
      if (event.key === "Escape") {
        event.stopPropagation();
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) {
      return;
    }

    setIsOpen((current) => !current);
  };

  const handleSelect = (optionValue) => {
    if (disabled) {
      return;
    }

    onChange?.({
      target: {
        name,
        value: optionValue,
      },
    });
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`custom-select ${isOpen ? "is-open" : ""} ${disabled ? "is-disabled" : ""} ${className}`.trim()}
    >
      <button
        type="button"
        id={id}
        className="custom-select-trigger"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
      >
        <span className={`custom-select-value ${selectedOption ? "has-value" : ""}`}>
          {selectedOption?.label ?? placeholder}
        </span>
        <span className="custom-select-arrow" aria-hidden="true"></span>
      </button>

      {isOpen ? (
        <div className="custom-select-menu" role="listbox">
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value || option.label}
                type="button"
                className={`custom-select-option ${isSelected ? "is-selected" : ""}`}
                onClick={() => handleSelect(option.value)}
                disabled={option.disabled}
                role="option"
                aria-selected={isSelected}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default Select;
