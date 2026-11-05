import "./ModalChamados.css";

function ModalBase({
  isOpen,
  title,
  onClose,
  children,
  actions = null,
  size = "default",
  centerTitle = false,
  hideCloseButton = false,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-card modal-size-${size}`} onClick={(event) => event.stopPropagation()}>
        <div className={`modal-header ${centerTitle ? "modal-header-center-title" : ""}`.trim()}>
          <h2>{title}</h2>
          {!hideCloseButton ? (
            <button type="button" className="modal-close" onClick={onClose}>
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

export default ModalBase;
