import { useCallback, useEffect, useState } from "react";
import { FaChartLine, FaClockRotateLeft, FaGear, FaHeadset, FaInbox, FaUsers } from "react-icons/fa6";
import Feedback from "../../shared/components/Feedback";
import { getApiErrorMessage } from "../../shared/services/api";
import NotificationsModal from "../notifications/NotificationsModal";
import {
  clearNotifications,
  getNotificationsState,
  markAllNotificationsAsRead,
  refreshNotifications,
  subscribeNotifications,
} from "../notifications/notificationsService";
import SettingsModal from "../settings/SettingsModal";
import SlaReportModal from "../sla/SlaReportModal";
import MyTicketsModal from "../tickets/MyTicketsModal";
import TicketForm from "../tickets/TicketForm";
import TicketHistoryModal from "../tickets/TicketHistoryModal";
import { createChamado, getChamados, updateChamado } from "../tickets/ticketsService";
import TiPanelModal from "../tickets/TiPanelModal";
import { ROLE_ADMIN, TI_ROLES } from "../users/roles";
import UsersModal from "../users/UsersModal";
import HomeHeader from "./HomeHeader";
import "./HomePage.css";

const TICKETS_REFRESH_MS = 30000;

/** Telas que abrem em janela (modal) a partir da página inicial. */
const MODALS = {
  MY_TICKETS: "my-tickets",
  TI_PANEL: "ti-panel",
  HISTORY: "history",
  SLA: "sla",
  USERS: "users",
  SETTINGS: "settings",
  NOTIFICATIONS: "notifications",
};

function HomePage({ onBack, session }) {
  const [openModal, setOpenModal] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [notificationsState, setNotificationsState] = useState(getNotificationsState);

  const user = session?.user;
  const username = user?.username ?? "";
  const canViewTiPanel = TI_ROLES.includes(user?.role);
  const isAdmin = user?.role === ROLE_ADMIN;
  // O backend compara sem diferenciar maiúsculas; dados antigos podem ter "Maria.Silva".
  const myTickets = tickets.filter(
    (item) => String(item.solicitante ?? "").toLowerCase() === username.toLowerCase()
  );
  const { notifications, archived, unreadCount } = notificationsState;

  const open = (name) => () => setOpenModal(name);
  const close = () => setOpenModal(null);
  const isOpen = (name) => openModal === name;

  const refreshTickets = useCallback(async () => {
    try {
      setTickets(await getChamados());
      setLoadError("");
    } catch (error) {
      if (error.response?.status !== 401) {
        setLoadError(
          `${getApiErrorMessage(error, "Não foi possível atualizar os chamados.")} Os dados exibidos podem estar desatualizados.`
        );
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca ao abrir; o estado muda só após a resposta
    refreshTickets();
    const intervalId = window.setInterval(refreshTickets, TICKETS_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [refreshTickets, username]);

  useEffect(() => subscribeNotifications(setNotificationsState), [username]);

  // Ao abrir as notificações, marca todas como lidas (inclusive as que não cabem na lista).
  useEffect(() => {
    if (openModal === MODALS.NOTIFICATIONS && unreadCount > 0) {
      markAllNotificationsAsRead().catch(() => {});
    }
  }, [openModal, unreadCount]);

  /** Envia o chamado; devolve a mensagem de erro, se houver. */
  const handleCreateTicket = async (form) => {
    try {
      await createChamado(form);
      await Promise.all([refreshTickets(), refreshNotifications()]);
      setOpenModal(MODALS.MY_TICKETS);
      return null;
    } catch (error) {
      return getApiErrorMessage(error, "Não foi possível enviar a solicitação agora.");
    }
  };

  /** Envia status/resposta ao backend; devolve a mensagem de erro, se houver. */
  const handleUpdateTicket = async (id, updates) => {
    try {
      await updateChamado(id, updates);
      await Promise.all([refreshTickets(), refreshNotifications()]);
      return null;
    } catch (error) {
      return getApiErrorMessage(error, "Não foi possível atualizar o chamado.");
    }
  };

  return (
    <section className="home">
      <HomeHeader
        user={user}
        unreadCount={unreadCount}
        onOpenNotifications={open(MODALS.NOTIFICATIONS)}
        onLogout={onBack}
      />

      <nav className="home-nav" aria-label="Menu principal">
        <div className="home-nav-group">
          <button type="button" className="home-nav-item" onClick={open(MODALS.MY_TICKETS)}>
            <FaInbox aria-hidden="true" />
            Minhas solicitações
          </button>

          {canViewTiPanel ? (
            <>
              <button type="button" className="home-nav-item" onClick={open(MODALS.TI_PANEL)}>
                <FaHeadset aria-hidden="true" />
                Painel TI
              </button>
              <button type="button" className="home-nav-item" onClick={open(MODALS.HISTORY)}>
                <FaClockRotateLeft aria-hidden="true" />
                Histórico
              </button>
            </>
          ) : null}

          {isAdmin ? (
            <button type="button" className="home-nav-item" onClick={open(MODALS.SLA)}>
              <FaChartLine aria-hidden="true" />
              Relatório de SLA
            </button>
          ) : null}
        </div>

        {isAdmin ? (
          <div className="home-nav-group" aria-label="Administração" role="group">
            <button type="button" className="home-nav-item" onClick={open(MODALS.USERS)}>
              <FaUsers aria-hidden="true" />
              Usuários
            </button>
            <button type="button" className="home-nav-item" onClick={open(MODALS.SETTINGS)}>
              <FaGear aria-hidden="true" />
              Configurações
            </button>
          </div>
        ) : null}
      </nav>

      <div className="home-main">
        <Feedback className="home-load-error">{loadError}</Feedback>

        <TicketForm username={username} onSubmit={handleCreateTicket} />
      </div>

      <MyTicketsModal isOpen={isOpen(MODALS.MY_TICKETS)} onClose={close} solicitacoes={myTickets} />

      {canViewTiPanel ? (
        <>
          <TiPanelModal
            isOpen={isOpen(MODALS.TI_PANEL)}
            onClose={close}
            chamados={tickets}
            onUpdateChamado={handleUpdateTicket}
            abrirSLA={isAdmin ? open(MODALS.SLA) : null}
          />

          {isOpen(MODALS.HISTORY) ? (
            <TicketHistoryModal isOpen onClose={close} chamados={tickets} currentUsername={username} />
          ) : null}
        </>
      ) : null}

      {isAdmin ? (
        <>
          {isOpen(MODALS.USERS) ? <UsersModal isOpen onClose={close} currentUserId={user?.id} /> : null}
          {isOpen(MODALS.SETTINGS) ? <SettingsModal isOpen onClose={close} /> : null}
          <SlaReportModal isOpen={isOpen(MODALS.SLA)} onClose={close} chamados={tickets} />
        </>
      ) : null}

      {isOpen(MODALS.NOTIFICATIONS) ? (
        <NotificationsModal
          isOpen
          onClose={close}
          notifications={notifications}
          archivedNotifications={archived}
          onClear={() => clearNotifications().catch(() => {})}
        />
      ) : null}
    </section>
  );
}

export default HomePage;
