import { useState } from "react";
import { FaArrowRight, FaChevronDown, FaEye, FaEyeSlash } from "react-icons/fa6";
import { getRememberedLogin, loginDemo, loginUser } from "./authService";
import { COLD_START_MESSAGE, useSlowFlag } from "../../shared/hooks/useSlowFlag";
import { useSettings } from "../settings/useSettings";
import AuthTicket from "./AuthTicket";

/**
 * Perfis de exemplo do modo demonstração (os mesmos do backend). O Analista vem
 * primeiro e em destaque: é onde o sistema mostra mais em menos tempo.
 */
const DEMO_PROFILES = [
  {
    value: "analista",
    label: "Analista de TI",
    description: "Atende a fila por prazo, responde e fecha chamados",
    recommended: true,
  },
  { value: "usuario", label: "Usuário", description: "Abre um chamado e acompanha a resposta da TI" },
  {
    value: "administrador",
    label: "Administrador",
    description: "Vê o relatório de SLA, os usuários e as configurações",
  },
];

/** No canhoto, quando a demonstração está ligada: o que é isto e o que esperar. */
function DemoStubNote() {
  return (
    <div className="login-stub-demo">
      <span className="login-stub-stamp">Demonstração</span>
      <p>
        Entre sem senha com um perfil de exemplo. Os dados são fictícios e voltam ao original a cada 6 horas.
      </p>
    </div>
  );
}

const LoginPage = ({ onForgotPassword, onLoginSuccess }) => {
  const remembered = getRememberedLogin();
  const [username, setUsername] = useState(() => remembered?.username ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => remembered?.rememberMe ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoProfile, setDemoProfile] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  // Na demonstração o formulário fica recolhido; quem já entrou com conta antes o encontra aberto.
  const [showAccountForm, setShowAccountForm] = useState(() => Boolean(remembered?.username));
  const { demoMode, isPublicLoaded } = useSettings();
  const isBusy = isSubmitting || Boolean(demoProfile);
  const isSlow = useSlowFlag(isBusy);
  // O site abre antes de a API responder: se ela está dormindo, avisa já na abertura.
  const isWaking = useSlowFlag(!isPublicLoaded);
  const isFormVisible = !demoMode || showAccountForm;

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

    if (!username.trim() && !password.trim()) {
      setErrorMessage("Preencha usuário e senha.");
      return;
    }

    if (!username.trim() || !password.trim()) {
      setErrorMessage(username.trim() ? "Digite a sua senha." : "Digite o seu usuário.");
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

  const feedback = errorMessage ? (
    <div className="feedback feedback-error login-feedback" role="alert">
      {errorMessage}
    </div>
  ) : null;

  return (
    <AuthTicket stubNote={demoMode ? <DemoStubNote /> : null}>
      <form className="paper-ticket-body login-body" onSubmit={handleSubmit} noValidate>
        {demoMode ? (
          <section className="login-demo" aria-labelledby="login-demo-title">
            <h2 id="login-demo-title" className="login-title">
              Escolha um perfil para explorar
            </h2>

            <div className="login-demo-options">
              {DEMO_PROFILES.map((profile) => (
                <button
                  key={profile.value}
                  type="button"
                  className={`login-demo-option ${profile.recommended ? "is-recommended" : ""}`.trim()}
                  onClick={() => handleDemo(profile.value)}
                  disabled={isBusy}
                  aria-describedby={`demo-${profile.value}-hint`}
                >
                  <span className="login-demo-text">
                    <strong>
                      {profile.label}
                      {profile.recommended ? <em className="login-demo-tag">Comece por aqui</em> : null}
                    </strong>
                    <span id={`demo-${profile.value}-hint`}>
                      {demoProfile === profile.value ? "Entrando..." : profile.description}
                    </span>
                  </span>
                  <FaArrowRight className="login-demo-arrow" aria-hidden="true" />
                </button>
              ))}
            </div>

            {isFormVisible ? null : feedback}

            <button
              type="button"
              className="login-account-toggle"
              aria-expanded={showAccountForm}
              aria-controls="login-account-form"
              onClick={() => setShowAccountForm((current) => !current)}
            >
              Tenho uma conta
              <FaChevronDown aria-hidden="true" />
            </button>
          </section>
        ) : (
          <h2 className="login-title">Acesse sua conta</h2>
        )}

        {isFormVisible ? (
          <div id="login-account-form" className={demoMode ? "login-account-form" : undefined}>
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

            {feedback}

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

            <button
              type="submit"
              className={demoMode ? "login-submit is-secondary" : "login-submit"}
              disabled={isBusy}
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </button>
          </div>
        ) : null}

        <p className="login-slow" role="status">
          {isSlow || isWaking ? COLD_START_MESSAGE : ""}
        </p>
      </form>
    </AuthTicket>
  );
};

export default LoginPage;
