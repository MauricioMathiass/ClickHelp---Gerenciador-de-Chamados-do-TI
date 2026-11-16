import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { getRememberedLogin, loginUser } from "./authService";
import AuthTicket from "./AuthTicket";

const LoginPage = ({ onForgotPassword, onLoginSuccess }) => {
  const [username, setUsername] = useState(() => getRememberedLogin()?.username ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => getRememberedLogin()?.rememberMe ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const togglePassword = () => setShowPassword((current) => !current);

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
        <h2 className="login-title">Acesse sua conta</h2>

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
          disabled={isSubmitting}
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
            disabled={isSubmitting}
          />
          <button
            type="button"
            className="login-toggle-password"
            onClick={togglePassword}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={showPassword}
            disabled={isSubmitting}
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
              disabled={isSubmitting}
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

        <button type="submit" className="login-submit" disabled={isSubmitting}>
          {isSubmitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </AuthTicket>
  );
};

export default LoginPage;
