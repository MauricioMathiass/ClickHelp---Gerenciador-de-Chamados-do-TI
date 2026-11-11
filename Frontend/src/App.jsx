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

  // Sessão salva: confirma no backend e atualiza nome/perfil (podem ter mudado).
  useEffect(() => {
    const storedSession = getStoredSession();

    if (!storedSession) {
      return;
    }

    refreshSessionUser(storedSession).then((nextSession) => {
      if (nextSession) {
        setSession(nextSession);
      }
    });
  }, []);

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
