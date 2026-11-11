import { useEffect, useMemo, useRef, useState } from "react";
import "./CustomDatePicker.css";
import { capitalizeFirst } from "../../utils/format";

const MONTH_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

function parseDateValue(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function buildCalendarDays(baseMonth) {
  const firstDay = new Date(baseMonth.getFullYear(), baseMonth.getMonth(), 1);
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + index);
    return currentDate;
  });
}

function CustomDatePicker({ id, name, onChange, placeholder = "dd/mm/aaaa", value }) {
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => parseDateValue(value) ?? new Date());
  const containerRef = useRef(null);
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  useEffect(() => {
    if (selectedDate) {
      setVisibleMonth(selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      // Com a lista aberta, Esc fecha só a lista (e não o modal em volta).
      if (event.key === "Escape" && isOpenRef.current) {
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
  }, []);

  const emitChange = (nextValue) => {
    onChange?.({
      target: {
        name,
        value: nextValue,
      },
    });
  };

  const handleSelectDate = (date) => {
    emitChange(formatDateValue(date));
    setIsOpen(false);
  };

  const handleToday = () => {
    const today = new Date();
    setVisibleMonth(today);
    emitChange(formatDateValue(today));
    setIsOpen(false);
  };

  const handleClear = () => {
    emitChange("");
    setIsOpen(false);
  };

  const displayValue = selectedDate
    ? selectedDate.toLocaleDateString("pt-BR")
    : placeholder;

  return (
    <div
      ref={containerRef}
      className={`custom-date-picker ${isOpen ? "is-open" : ""}`.trim()}
    >
      <button
        type="button"
        id={id}
        className="custom-date-trigger"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className={`custom-date-value ${selectedDate ? "has-value" : ""}`}>{displayValue}</span>
        <span className="custom-date-icon" aria-hidden="true"></span>
      </button>

      {isOpen ? (
        <div className="custom-date-menu" role="dialog" aria-label="Selecionar data">
          <div className="custom-date-header">
            <button
              type="button"
              className="custom-date-nav"
              onClick={() =>
                setVisibleMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                )
              }
            >
              &lt;
            </button>

            <strong>{capitalizeFirst(MONTH_FORMATTER.format(visibleMonth))}</strong>

            <button
              type="button"
              className="custom-date-nav"
              onClick={() =>
                setVisibleMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                )
              }
            >
              &gt;
            </button>
          </div>

          <div className="custom-date-weekdays">
            {WEEKDAY_LABELS.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>

          <div className="custom-date-grid">
            {calendarDays.map((day) => {
              const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
              const isToday = isSameDay(day, new Date());

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  className={[
                    "custom-date-day",
                    isCurrentMonth ? "" : "is-outside",
                    isSelected ? "is-selected" : "",
                    isToday ? "is-today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleSelectDate(day)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="custom-date-actions">
            <button type="button" className="custom-date-action" onClick={handleClear}>
              Limpar
            </button>
            <button type="button" className="custom-date-action primary" onClick={handleToday}>
              Hoje
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CustomDatePicker;
