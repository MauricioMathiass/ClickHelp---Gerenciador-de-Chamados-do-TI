import { useSettings } from "../settings/useSettings";

/** Marca da empresa (logo, nome do sistema e da empresa) e cartão do usuário logado. */
function HomeHeader({ user, isAdmin, onOpenUsers, onOpenSettings }) {
  const { branding } = useSettings();

  return (
    <header className="home-header">
      <div className="home-brand">
        {branding.logoDataUrl ? (
          <img
            className="home-brand-logo"
            src={branding.logoDataUrl}
            alt={`Logo ${branding.companyName || branding.appName}`}
          />
        ) : null}

        <div>
          <h1>{branding.appName}</h1>
          {branding.companyName ? <p className="home-brand-company">{branding.companyName}</p> : null}
          <p className="home-brand-tagline">
            Centralize solicitações, acompanhe o andamento e mantenha o suporte de TI organizado.
          </p>
        </div>
      </div>

      <div className="home-user">
        <div className="home-user-card surface-card">
          <span>Conectado como</span>
          <strong>{user?.name ?? "Usuário"}</strong>
          <small>
            {user?.role}
            {user?.department ? ` · ${user.department}` : ""}
          </small>
        </div>

        {isAdmin ? (
          <div className="home-admin-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={onOpenUsers}>
              Usuários
            </button>
            <button type="button" className="btn btn-ghost btn-lg" onClick={onOpenSettings}>
              Configurações
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export default HomeHeader;
