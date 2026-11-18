import BrandMark from "../../shared/components/BrandMark";
import BrandName from "../../shared/components/BrandName";
import { useSettings } from "../settings/useSettings";
import "./LoginPage.css";

/**
 * Moldura das telas de acesso, no formato de chamado impresso: o canhoto leva
 * a marca e o corpo, depois da linha de corte, vem em `children`. O elemento
 * raiz de `children` usa as classes "paper-ticket-body login-body". `stubNote`
 * entra no fim do canhoto (ex.: o aviso do modo demonstração).
 */
function AuthTicket({ children, stubNote = null }) {
  const { branding } = useSettings();

  return (
    <div className="paper-ticket-frame login-frame">
      <div className="paper-ticket">
        <header className="paper-ticket-stub login-stub">
          <BrandMark size={48} />

          <div className="login-stub-text">
            <h1 className="brand-wordmark login-wordmark">
              <BrandName name={branding.appName} />
            </h1>
            {branding.companyName ? <p className="login-company">{branding.companyName}</p> : null}
            <p className="login-purpose">Abra chamados e acompanhe o atendimento da equipe de TI.</p>
            {stubNote}
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}

export default AuthTicket;
