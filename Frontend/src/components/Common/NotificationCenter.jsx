import { useEffect, useRef, useState } from "react";
import "./NotificationCenter.css";
import {
  getPendingNotificationsForSession,
  markNotificationsAsSeen,
  subscribeNotifications,
} from "../../services/notifications";

const TOAST_DURATION_MS = 6000;

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

function NotificationCenter({ session }) {
  const [toasts, setToasts] = useState([]);
  const audioContextRef = useRef(null);
  const shownIdsRef = useRef(new Set());
  const timeoutIdsRef = useRef(new Map());

  const removeToast = (toastId) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));

    const timeoutId = timeoutIdsRef.current.get(toastId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(toastId);
    }
  };

  useEffect(() => {
    shownIdsRef.current = new Set();
    setToasts([]);
  }, [session?.user?.username]);

  useEffect(() => {
    if (!session?.user) {
      return undefined;
    }

    const processNotifications = () => {
      const pendingNotifications = getPendingNotificationsForSession(session).filter(
        (notification) => !shownIdsRef.current.has(notification.id)
      );

      if (!pendingNotifications.length) {
        return;
      }

      pendingNotifications.forEach((notification) => {
        shownIdsRef.current.add(notification.id);

        setToasts((current) => {
          const nextToasts = [notification, ...current.filter((toast) => toast.id !== notification.id)];
          return nextToasts.slice(0, 4);
        });

        const timeoutId = window.setTimeout(() => {
          removeToast(notification.id);
        }, TOAST_DURATION_MS);

        timeoutIdsRef.current.set(notification.id, timeoutId);

        playNotificationSound(audioContextRef).catch(() => {});

        if (document.visibilityState !== "visible" && typeof Notification !== "undefined") {
          if (Notification.permission === "granted") {
            const browserNotification = new Notification(notification.title, {
              body: notification.message,
              tag: notification.id,
            });

            browserNotification.onclick = () => {
              window.focus();
              browserNotification.close();
            };
          }
        }
      });

      markNotificationsAsSeen(
        session,
        pendingNotifications.map((notification) => notification.id)
      );
    };

    processNotifications();
    const unsubscribe = subscribeNotifications(processNotifications);

    return () => {
      unsubscribe();
      timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutIdsRef.current.clear();
    };
  }, [session]);

  if (!session?.user || !toasts.length) {
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
            aria-label="Fechar notificacao"
          >
            x
          </button>
        </article>
      ))}
    </div>
  );
}

export default NotificationCenter;
