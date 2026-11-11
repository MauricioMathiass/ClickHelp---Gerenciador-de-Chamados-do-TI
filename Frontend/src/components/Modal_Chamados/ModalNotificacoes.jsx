import { useEffect, useState } from "react";
import ModalBase from "./ModalBase";

const formatNotificationDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

function ModalNotificacoes({ isOpen, onClose, notifications, archivedNotifications, onClear }) {
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowHistory(false);
    }
  }, [isOpen]);

  const canShowHistoryButton = !notifications.length;
  const currentNotifications = showHistory ? archivedNotifications : notifications;

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={showHistory ? "Histórico de notificações" : "Notificações recentes"}
      actions={
        <div className="notification-modal-actions">
          {showHistory ? (
            <button
              type="button"
              className="modal-close notification-history-back"
              onClick={() => setShowHistory(false)}
            >
              Voltar
            </button>
          ) : null}

          {canShowHistoryButton && !showHistory ? (
            <button
              type="button"
              className="modal-close notification-history-button"
              onClick={() => setShowHistory(true)}
            >
              Histórico de notificações
            </button>
          ) : null}

          {!showHistory && notifications.length ? (
            <button type="button" className="modal-secondary-action" onClick={onClear}>
              Limpar notificações
            </button>
          ) : null}
        </div>
      }
    >
      {currentNotifications.length ? (
        <div className="notifications-history">
          {currentNotifications.map((notification) => (
            <article key={notification.id} className="notification-history-card">
              <div className="notification-history-top">
                <strong>{notification.title}</strong>
                <span>{formatNotificationDate(notification.createdAt)}</span>
              </div>

              <p>{notification.message}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>{showHistory ? "Nenhum histórico encontrado" : "Nenhuma notificação encontrada"}</h3>
          <p>
            {showHistory
              ? "As mensagens removidas das notificações recentes aparecerão aqui."
              : "As últimas atualizações recebidas aparecerão aqui."}
          </p>
        </div>
      )}
    </ModalBase>
  );
}

export default ModalNotificacoes;
