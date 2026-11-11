import { useEffect, useState } from "react";
import LoginPage from "../features/auth/LoginPage";
import ForgotPasswordPage from "../features/auth/ForgotPasswordPage";
import HomePage from "../features/home/HomePage";
import NotificationToasts from "../features/notifications/NotificationToasts";
import { SettingsProvider } from "../features/settings/SettingsProvider";
import { SESSION_EXPIRED_EVENT } from "../shared/services/api";
import { getStoredSession, logoutUser, refreshSessionUser } from "../features/auth/authService";
import {
  requestBrowserNotificationPermission,
  resetNotificationsState,
} from "../features/notifications/notificationsService";

const SESSION_SYNC_INTERVAL_MS = 60000;

function App() {
  const [session, setSession] = useState(() => getStoredSession());
  const [currentView, setCurrentView] = useState("login");

  const handleBackToLogin = () => {
    logoutUser();
    resetNotificationsState();
    setSession(null);
    setCurrentView("login");
  };

  useEffect(() => {
    // O backend recusou o token (expirado/inválido): volta para o login.
    const handleSessionExpired = () => handleBackToLogin();
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  // Confirma a sessão no backend ao abrir e a cada minuto: se o admin mudar o
  // perfil ou o nome do usuário, a tela se ajusta sem precisar recarregar.
  const sessionToken = session?.token;

  useEffect(() => {
    if (!sessionToken) {
      return undefined;
    }

    let cancelled = false;

    const syncUser = async () => {
      const current = getStoredSession();

      if (!current || current.token !== sessionToken) {
        return;
      }

      const nextSession = await refreshSessionUser(current);

      if (cancelled || !nextSession) {
        return;
      }

      setSession((previous) => {
        if (!previous || previous.token !== nextSession.token) {
          return previous;
        }

        const changed = ["role", "name", "department"].some(
          (field) => previous.user?.[field] !== nextSession.user[field]
        );

        return changed ? nextSession : previous;
      });
    };

    syncUser();
    const intervalId = window.setInterval(syncUser, SESSION_SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [sessionToken]);

  const handleLoginSuccess = (nextSession) => {
    setSession(nextSession);
    setCurrentView("login");
    requestBrowserNotificationPermission().catch(() => {});
  };

  return (
    <SettingsProvider isAuthenticated={Boolean(session)}>
      <main className="app-shell">
        <NotificationToasts key={session?.user?.username ?? "anonimo"} session={session} />
        {session ? <HomePage onBack={handleBackToLogin} session={session} /> : null}
        {!session && currentView === "login" ? (
          <div className="login-view-shell">
            <LoginPage
              onForgotPassword={() => setCurrentView("forgot-password")}
              onLoginSuccess={handleLoginSuccess}
            />
          </div>
        ) : null}
        {!session && currentView === "forgot-password" ? (
          <ForgotPasswordPage onBack={() => setCurrentView("login")} />
        ) : null}
      </main>
    </SettingsProvider>
  );
}

export default App;
