import { useEffect, useState } from "react";
import CartaoLogin from "./components/Login/CartaoLogin";
import EsqueceuSenha from "./components/Login/EsqueceuSenha";
import ContainerMain from "./components/MainContent/ContainerMain";
import NotificationCenter from "./components/Common/NotificationCenter";
import { SESSION_EXPIRED_EVENT } from "./services/api";
import { getStoredSession, logoutUser, refreshSessionUser } from "./services/auth";
import {
  requestBrowserNotificationPermission,
  resetNotificationsState,
} from "./services/notifications";

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

        const changed =
          previous.user?.role !== nextSession.user.role || previous.user?.name !== nextSession.user.name;

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
    <main className="app-shell">
      <NotificationCenter session={session} />
      {session ? <ContainerMain onBack={handleBackToLogin} session={session} /> : null}
      {!session && currentView === "login" ? (
        <div className="login-view-shell">
          <div className="login-background-video" aria-hidden="true">
            <video autoPlay muted loop playsInline>
              <source src="/login-background.mp4" type="video/mp4" />
            </video>
          </div>

          <CartaoLogin
            onForgotPassword={() => setCurrentView("forgot-password")}
            onLoginSuccess={handleLoginSuccess}
          />
        </div>
      ) : null}
      {!session && currentView === "forgot-password" ? (
        <EsqueceuSenha onBack={() => setCurrentView("login")} />
      ) : null}
    </main>
  );
}

export default App;
