import { useState } from "react";
import CartaoLogin from "./components/Login/CartaoLogin";
import EsqueceuSenha from "./components/Login/EsqueceuSenha";
import ContainerMain from "./components/MainContent/ContainerMain";
import NotificationCenter from "./components/Common/NotificationCenter";
import { getStoredSession, logoutUser } from "./services/auth";
import { requestBrowserNotificationPermission } from "./services/notifications";

function App() {
  const [session, setSession] = useState(() => getStoredSession());
  const [currentView, setCurrentView] = useState("login");

  const handleBackToLogin = () => {
    logoutUser();
    setSession(null);
    setCurrentView("login");
  };

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
