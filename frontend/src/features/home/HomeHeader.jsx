import { FaArrowRightFromBracket, FaBell } from "react-icons/fa6";
import BrandMark from "../../shared/components/BrandMark";
import BrandName from "../../shared/components/BrandName";
import { useSettings } from "../settings/useSettings";

/** Barra do topo: marca da empresa, notificações, usuário conectado e Sair. */
function HomeHeader({ user, unreadCount, onOpenNotifications, onLogout }) {
  const { branding } = useSettings();
  const roleLine = [user?.role, user?.department].filter(Boolean).join(", ");

  return (
    <header className="home-top">
      <div className="home-brand">
        <BrandMark size={36} />
        <div className="home-brand-text">
          <p className="brand-wordmark home-wordmark">
            <BrandName name={branding.appName} />
          </p>
          {branding.companyName ? <p className="home-company">{branding.companyName}</p> : null}
        </div>
      </div>

      <div className="home-session">
        <button
          type="button"
          className="home-bell"
          onClick={onOpenNotifications}
          aria-label={unreadCount ? `Notificações: ${unreadCount} não lidas` : "Notificações"}
          title="Notificações"
        >
          <FaBell />
          {unreadCount ? (
            <span className="home-bell-badge" aria-hidden="true">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>

        <div className="home-user">
          <strong>{user?.name ?? "Usuário"}</strong>
          {roleLine ? <span>{roleLine}</span> : null}
        </div>

        <button type="button" className="home-logout" onClick={onLogout}>
          <FaArrowRightFromBracket aria-hidden="true" />
          <span>Sair</span>
        </button>
      </div>
    </header>
  );
}

export default HomeHeader;
