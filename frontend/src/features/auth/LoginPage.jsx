import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { getRememberedLogin, loginDemo, loginUser } from "./authService";
import { COLD_START_MESSAGE, useSlowFlag } from "../../shared/hooks/useSlowFlag";
import { useSettings } from "../settings/useSettings";
import AuthTicket from "./AuthTicket";

/** Perfis de exemplo do modo demonstração (os mesmos do backend). */
const DEMO_PROFILES = [
  { value: "usuario", label: "Usuário", description: "Abre chamados e acompanha a resposta da TI" },
  { value: "analista", label: "Analista de TI", description: "Atende a fila, responde e fecha chamados" },
  { value: "administrador", label: "Administrador", description: "Vê o SLA, os usuários e as configurações" },
];

const LoginPage = ({ onForgotPassword, onLoginSuccess }) => {
  const [username, setUsername] = useState(() => getRememberedLogin()?.username ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => getRememberedLogin()?.rememberMe ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoProfile, setDemoProfile] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { demoMode, isPublicLoaded } = useSettings();
  const isBusy = isSubmitting || Boolean(demoProfile);
  const isSlow = useSlowFlag(isBusy);
  // O site abre antes de a API responder: se ela está dormindo, avisa já na abertura.
  const isWaking = useSlowFlag(!isPublicLoaded);

  const togglePassword = () => setShowPassword((current) => !current);

  const handleDemo = async (perfil) => {
    setErrorMessage("");
    setDemoProfile(perfil);

    try {
      onLoginSuccess?.(await loginDemo(perfil));
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setDemoProfile("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      setErrorMessage("Preencha usuário e senha.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const session = await loginUser({
        username,
        password,
        rememberMe,
      });

      onLoginSuccess?.(session);
    } catch (error) {
      setErrorMessage(error.message || "Não foi possível fazer login.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthTicket>
      <form className="paper-ticket-body login-body" onSubmit={handleSubmit} noValidate>
        {demoMode ? (
          <section className="login-demo" aria-labelledby="login-demo-title">
            <h2 id="login-demo-title" className="login-title">
              Conheça o sistema
            </h2>
            <p className="login-demo-intro">
              Entre sem senha com um perfil de exemplo. Os dados são fictícios e voltam ao original sozinhos.
            </p>

            <div className="login-demo-options">
              {DEMO_PROFILES.map((profile) => (
                <button
                  key={profile.value}
                  type="button"
                  className="login-demo-option"
                  onClick={() => handleDemo(profile.value)}
                  disabled={isBusy}
                >
                  <strong>{demoProfile === profile.value ? "Entrando..." : profile.label}</strong>
                  <span>{profile.description}</span>
                </button>
              ))}
            </div>

            <p className="login-demo-divider">
              <span>ou entre com sua conta</span>
            </p>
          </section>
        ) : null}

        {demoMode ? null : <h2 className="login-title">Acesse sua conta</h2>}

        <label className="login-label" htmlFor="username">
          Usuário
        </label>
        <input
          id="username"
          className="login-input"
          type="text"
          placeholder="nome.sobrenome"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          disabled={isBusy}
        />

        <label className="login-label" htmlFor="password">
          Senha
        </label>
        <div className="login-password">
          <input
            id="password"
            className="login-input"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            disabled={isBusy}
          />
          <button
            type="button"
            className="login-toggle-password"
            onClick={togglePassword}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={showPassword}
            disabled={isBusy}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>

        {errorMessage ? (
          <div className="feedback feedback-error login-feedback" role="alert">
            {errorMessage}
          </div>
        ) : null}

        <div className="login-options">
          <label className="login-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              disabled={isBusy}
            />
            <span>Manter conectado</span>
          </label>

          <a
            href="#"
            className="login-forgot"
            onClick={(event) => {
              event.preventDefault();
              onForgotPassword?.();
            }}
          >
            Esqueci minha senha
          </a>
        </div>

        <button type="submit" className="login-submit" disabled={isBusy}>
          {isSubmitting ? "Entrando..." : "Entrar"}
        </button>

        <p className="login-slow" role="status">
          {isSlow || isWaking ? COLD_START_MESSAGE : ""}
        </p>
      </form>
    </AuthTicket>
  );
};

export default LoginPage;
