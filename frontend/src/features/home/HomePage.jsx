import { useCallback, useEffect, useState } from "react";
import { FaBell } from "react-icons/fa";
import { FaArrowRightFromBracket } from "react-icons/fa6";
import Feedback from "../../shared/components/Feedback";
import { getApiErrorMessage } from "../../shared/services/api";
import { notifyNewTicketByEmail } from "../notifications/emailNotifications";
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
import UsersModal from "../users/UsersModal";
import HomeHeader from "./HomeHeader";
import "./HomePage.css";

const TICKETS_REFRESH_MS = 30000;
const TI_ROLES = ["Administrador", "Analista de TI"];

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
  const isAdmin = user?.role === "Administrador";
  const myTickets = tickets.filter((item) => item.solicitante === username);
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
      const created = await createChamado(form);

      notifyNewTicketByEmail(created).catch((error) =>
        console.error("Falha ao enviar notificação por e-mail:", error)
      );

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
      <button type="button" className="home-logout" onClick={onBack}>
        <FaArrowRightFromBracket />
        <span>Sair</span>
      </button>

      <div className="home-panel">
        <HomeHeader
          user={user}
          isAdmin={isAdmin}
          onOpenUsers={open(MODALS.USERS)}
          onOpenSettings={open(MODALS.SETTINGS)}
        />

        <nav className="home-actions" aria-label="Ações">
          {canViewTiPanel ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={open(MODALS.TI_PANEL)}>
              Painel TI
            </button>
          ) : null}

          <button type="button" className="btn btn-primary btn-lg" onClick={open(MODALS.MY_TICKETS)}>
            Solicitações
          </button>

          <div className="home-actions-tools">
            <button
              type="button"
              className="notification-bell"
              onClick={open(MODALS.NOTIFICATIONS)}
              aria-label="Abrir notificações"
              title="Notificações"
            >
              <FaBell />
              {unreadCount ? (
                <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
              ) : null}
            </button>

            {isAdmin ? (
              <button type="button" className="btn btn-primary btn-lg" onClick={open(MODALS.SLA)}>
                SLA
              </button>
            ) : null}

            {canViewTiPanel ? (
              <button type="button" className="btn btn-primary btn-lg" onClick={open(MODALS.HISTORY)}>
                Histórico
              </button>
            ) : null}
          </div>
        </nav>

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
          {/* Rotinas não entram no relatório de SLA. */}
          <SlaReportModal
            isOpen={isOpen(MODALS.SLA)}
            onClose={close}
            chamados={tickets.filter((item) => !item.isFixedRoutine)}
          />
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
