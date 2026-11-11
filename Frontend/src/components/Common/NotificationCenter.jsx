import { useEffect, useRef, useState } from "react";
import "./NotificationCenter.css";
import { readToastedIds, saveToastedIds, subscribeNotifications } from "../../services/notifications";

const TOAST_DURATION_MS = 6000;
const MAX_VISIBLE_TOASTS = 4;

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
function NotificationCenter({ session }) {
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
    setToasts([]);

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
        timeoutIds.set(
          notification.id,
          window.setTimeout(() => removeToast(notification.id), TOAST_DURATION_MS)
        );
        showBrowserNotification(notification);
      });

      saveToastedIds(username, toastedIds);
      setToasts((current) =>
        [...fresh, ...current.filter((toast) => !fresh.some((item) => item.id === toast.id))].slice(
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
            x
          </button>
        </article>
      ))}
    </div>
  );
}

export default NotificationCenter;
