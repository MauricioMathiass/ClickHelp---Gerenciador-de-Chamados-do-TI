import BrandName from "../../shared/components/BrandName";
import { useSettings } from "../settings/useSettings";
import "./LoginPage.css";

/**
 * Moldura das telas de acesso, desenhada como um chamado impresso: o canhoto
 * (à esquerda, ou em cima no celular) leva a marca, e o corpo, depois da linha
 * de corte, vem em `children`. O elemento raiz de `children` usa a classe
 * "login-body".
 */
function AuthTicket({ children }) {
  const { branding } = useSettings();

  return (
    <div className="login-ticket">
      <header className="login-stub">
        {branding.logoDataUrl ? (
          <img
            className="login-logo"
            src={branding.logoDataUrl}
            alt={`Logo ${branding.companyName || branding.appName}`}
          />
        ) : (
          <div className="login-mark" aria-hidden="true">
            <span className="login-mark-core"></span>
          </div>
        )}

        <div className="login-stub-text">
          <h1 className="login-wordmark">
            <BrandName name={branding.appName} />
          </h1>
          {branding.companyName ? <p className="login-company">{branding.companyName}</p> : null}
          <p className="login-purpose">Abra chamados e acompanhe o atendimento da equipe de TI.</p>
        </div>
      </header>

      {children}
    </div>
  );
}

export default AuthTicket;
