import { useEffect, useRef, useState } from "react";
import { FaXmark } from "react-icons/fa6";
import "./NotificationToasts.css";
import { readToastedIds, saveToastedIds, subscribeNotifications } from "./notificationsService";

const TOAST_DURATION_MS = 6000;
const MAX_VISIBLE_TOASTS = 3;
/** A partir daqui, várias notificações chegando juntas viram um aviso só. */
const GROUP_FROM = 3;

const playNotificationSound = async (audioContextRef) => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  if (!audioContextRef.current) {
    audioContextRef.current = new AudioContextClass();
  }

  const audioContext = audioContextRef.current;

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const startTime = audioContext.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(784, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(1046, startTime + 0.18);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.12, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + 0.36);
};

const showBrowserNotification = (notification) => {
  if (
    document.visibilityState === "visible" ||
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  const browserNotification = new Notification(notification.title, {
    body: notification.message,
    tag: notification.id,
  });

  browserNotification.onclick = () => {
    window.focus();
    browserNotification.close();
  };
};

/** Exibe "toasts" para notificações novas (não lidas e ainda não exibidas neste navegador). */
function NotificationToasts({ session }) {
  const [toasts, setToasts] = useState([]);
  const audioContextRef = useRef(null);
  const timeoutIdsRef = useRef(new Map());
  const username = session?.user?.username;

  const removeToast = (toastId) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));

    const timeoutId = timeoutIdsRef.current.get(toastId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(toastId);
    }
  };

  useEffect(() => {
    if (!username) {
      return undefined;
    }

    const timeoutIds = timeoutIdsRef.current;

    const handleState = ({ notifications }) => {
      const toastedIds = readToastedIds(username);
      const fresh = notifications.filter((item) => !item.read && !toastedIds.has(item.id));

      if (!fresh.length) {
        return;
      }

      fresh.forEach((notification) => {
        toastedIds.add(notification.id);
        showBrowserNotification(notification);
      });

      // Ao entrar com várias novidades, um aviso resumido em vez de uma pilha cobrindo a tela.
      const incoming =
        fresh.length >= GROUP_FROM
          ? [
              {
                id: `grupo-${fresh[0].id}`,
                title: `${fresh.length} notificações novas`,
                message: "Abra o sino no topo da tela para ver todas.",
              },
            ]
          : fresh;

      incoming.forEach((toast) => {
        timeoutIds.set(
          toast.id,
          window.setTimeout(() => removeToast(toast.id), TOAST_DURATION_MS)
        );
      });

      saveToastedIds(username, toastedIds);
      setToasts((current) =>
        [...incoming, ...current.filter((toast) => !incoming.some((item) => item.id === toast.id))].slice(
          0,
          MAX_VISIBLE_TOASTS
        )
      );
      playNotificationSound(audioContextRef).catch(() => {});
    };

    const unsubscribe = subscribeNotifications(handleState);

    return () => {
      unsubscribe();
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutIds.clear();
    };
  }, [username]);

  if (!username || !toasts.length) {
    return null;
  }

  return (
    <div className="notification-center" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <article key={toast.id} className="notification-toast">
          <div className="notification-toast-copy">
            <strong>{toast.title}</strong>
            <p>{toast.message}</p>
          </div>

          <button
            type="button"
            className="notification-toast-close"
            onClick={() => removeToast(toast.id)}
            aria-label="Fechar notificação"
          >
            <FaXmark aria-hidden="true" />
          </button>
        </article>
      ))}
    </div>
  );
}

export default NotificationToasts;
