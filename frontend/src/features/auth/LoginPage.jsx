import { useState } from "react";
import { FaEye, FaEyeSlash, FaLock, FaUser } from "react-icons/fa";
import BrandName from "../../shared/components/BrandName";
import { useSettings } from "../settings/useSettings";
import { getRememberedLogin, loginUser } from "./authService";
import "./LoginPage.css";

const LoginPage = ({ onForgotPassword, onLoginSuccess }) => {
  const { branding } = useSettings();
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
    <div className="container-cartaoLogin">
      <form className="form-login" onSubmit={handleSubmit}>
        <div className="brand-header">
          {branding.logoDataUrl ? (
            <img
              className="brand-logo"
              src={branding.logoDataUrl}
              alt={`Logo ${branding.companyName || branding.appName}`}
            />
          ) : (
            <div className="brand-mark" aria-hidden="true">
              <span className="brand-mark-core"></span>
            </div>
          )}

          <div className="brand-copy">
            <span className="brand-chip">{branding.companyName || "Central de chamados de TI"}</span>
            <h1>
              <BrandName name={branding.appName} />
            </h1>
            <p>Acesse a plataforma para abrir, acompanhar e resolver chamados com agilidade.</p>
          </div>
        </div>

        <label className="input-label" htmlFor="username">
          NOME DE USUÁRIO
        </label>
        <div className="input-field has-left-icon">
          <input
            id="username"
            type="text"
            placeholder="nome.sobrenome"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            disabled={isSubmitting}
          />
          <FaUser className="icon" />
        </div>

        <label className="input-label" htmlFor="password">
          SENHA
        </label>
        <div className="input-field has-left-icon">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            placeholder="••••••••"
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            disabled={isSubmitting}
          />
          <FaLock className="icon" />
          <button
            type="button"
            className="toggle-password"
            onClick={togglePassword}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            disabled={isSubmitting}
          >
            {showPassword ? <FaEye /> : <FaEyeSlash />}
          </button>
        </div>

        {errorMessage ? (
          <div className="feedback feedback-error login-feedback" role="alert">
            {errorMessage}
          </div>
        ) : null}

        <div className="login-options">
          <label className="remember-me">
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
            className="forgot-password"
            onClick={(event) => {
              event.preventDefault();
              onForgotPassword?.();
            }}
          >
            Esqueceu a senha?
          </a>
        </div>

        <button type="submit" className="submit-button" disabled={isSubmitting}>
          {isSubmitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
