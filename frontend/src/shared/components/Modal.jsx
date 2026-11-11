import { useEffect, useId, useRef } from "react";
import "./Modal.css";

// Pilha de modais abertos: Esc fecha só o de cima, e a página de fundo
// fica sem rolagem enquanto houver algum modal aberto.
const openModals = [];

const syncBodyScroll = () => {
  document.body.style.overflow = openModals.length ? "hidden" : "";
};

function Modal({
  isOpen,
  title,
  onClose,
  children,
  actions = null,
  size = "default",
  centerTitle = false,
  hideCloseButton = false,
}) {
  const modalId = useId();
  const titleId = `${modalId}-title`;
  const onCloseRef = useRef(onClose);
  const cardRef = useRef(null);
  const pressedOnOverlayRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    openModals.push(modalId);
    syncBodyScroll();
    cardRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && openModals[openModals.length - 1] === modalId) {
        event.stopPropagation();
        onCloseRef.current?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const index = openModals.lastIndexOf(modalId);

      if (index !== -1) {
        openModals.splice(index, 1);
      }

      syncBodyScroll();
    };
  }, [isOpen, modalId]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        // Arrastar a seleção de texto para fora do modal não deve fechá-lo.
        pressedOnOverlayRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedOnOverlayRef.current && event.target === event.currentTarget) {
          onClose?.();
        }

        pressedOnOverlayRef.current = false;
      }}
    >
      <div
        ref={cardRef}
        className={`modal-card modal-size-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={`modal-header ${centerTitle ? "modal-header-center-title" : ""}`.trim()}>
          <h2 id={titleId}>{title}</h2>
          {!hideCloseButton ? (
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Fechar
            </button>
          ) : null}
        </div>
        <div className="modal-content">{children}</div>
        {actions ? <div className="modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export default Modal;
