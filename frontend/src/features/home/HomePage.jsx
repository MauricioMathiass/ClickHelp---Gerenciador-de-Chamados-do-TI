import { useCallback, useEffect, useState } from "react";
import { FaChartLine, FaClockRotateLeft, FaGear, FaHeadset, FaInbox, FaPlus, FaUsers } from "react-icons/fa6";
import Feedback from "../../shared/components/Feedback";
import Modal from "../../shared/components/Modal";
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
import SlaReportView from "../sla/SlaReportView";
import MyTicketsModal from "../tickets/MyTicketsModal";
import TicketForm from "../tickets/TicketForm";
import TicketHistoryView from "../tickets/TicketHistoryView";
import { createChamado, getChamados, updateChamado } from "../tickets/ticketsService";
import TiQueueView from "../tickets/TiQueueView";
import { ROLE_ADMIN, TI_ROLES } from "../users/roles";
import UsersModal from "../users/UsersModal";
import HomeHeader from "./HomeHeader";
import "./HomePage.css";

const TICKETS_REFRESH_MS = 30000;

/** Rascunhos de resposta da fila: guardados na aba, para não sumirem ao trocar de tela ou recarregar. */
const draftsKey = (username) => `clickhelp.drafts.${username}`;

const readDrafts = (username) => {
  try {
    return JSON.parse(window.sessionStorage.getItem(draftsKey(username)) ?? "{}") || {};
  } catch {
    return {};
  }
};

/** Telas do TI no corpo da página (o menu troca entre elas). */
const VIEWS = {
  QUEUE: "queue",
  HISTORY: "history",
  SLA: "sla",
};

/** Janelas (modais) abertas a partir do menu. */
const MODALS = {
  NEW_TICKET: "new-ticket",
  MY_TICKETS: "my-tickets",
  USERS: "users",
  SETTINGS: "settings",
  NOTIFICATIONS: "notifications",
};

function HomePage({ onBack, session }) {
  const [view, setView] = useState(VIEWS.QUEUE);
  const [openModal, setOpenModal] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notificationsState, setNotificationsState] = useState(getNotificationsState);

  const user = session?.user;
  const username = user?.username ?? "";
  const isTeam = TI_ROLES.includes(user?.role);
  const isAdmin = user?.role === ROLE_ADMIN;
  // O backend compara sem diferenciar maiúsculas; dados antigos podem ter "Maria.Silva".
  const myTickets = tickets.filter(
    (item) => String(item.solicitante ?? "").toLowerCase() === username.toLowerCase()
  );
  const { notifications, archived, unreadCount } = notificationsState;
  const [queueDrafts, setQueueDrafts] = useState(() => readDrafts(username));
  // Respostas digitadas que ainda não foram salvas (em chamados que continuam abertos).
  const unsavedDrafts = Object.entries(queueDrafts).filter(([id, text]) => {
    const chamado = tickets.find((item) => item.id === id);
    return chamado && chamado.status !== "Fechado" && text.trim() !== (chamado.resposta ?? "").trim();
  }).length;
  // O Relatório de SLA é só do administrador; se o perfil mudar, volta para a fila.
  const currentView = view === VIEWS.SLA && !isAdmin ? VIEWS.QUEUE : view;

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
    } finally {
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca ao abrir; o estado muda só após a resposta
    refreshTickets();
    const intervalId = window.setInterval(refreshTickets, TICKETS_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [refreshTickets, username]);

  useEffect(() => subscribeNotifications(setNotificationsState), [username]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(draftsKey(username), JSON.stringify(queueDrafts));
    } catch {
      // Sem sessionStorage (modo privado restrito): os rascunhos ficam só na memória.
    }
  }, [username, queueDrafts]);

  // Fechar a aba com resposta não salva pede confirmação do navegador.
  useEffect(() => {
    if (!unsavedDrafts) {
      return undefined;
    }

    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsavedDrafts]);

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

  /** Item do menu que troca a tela do TI. */
  const viewItem = (name, Icon, label, note = "") => (
    <button
      type="button"
      className="home-nav-item"
      aria-current={currentView === name ? "page" : undefined}
      onClick={() => setView(name)}
    >
      <Icon aria-hidden="true" />
      {label}
      {note ? <span className="home-nav-note">{note}</span> : null}
    </button>
  );

  /** Item do menu que abre uma janela. */
  const modalItem = (name, Icon, label) => (
    <button type="button" className="home-nav-item" onClick={open(name)}>
      <Icon aria-hidden="true" />
      {label}
    </button>
  );

  return (
    <section className="home">
      <HomeHeader
        user={user}
        unreadCount={unreadCount}
        onOpenNotifications={open(MODALS.NOTIFICATIONS)}
        onLogout={onBack}
      />

      <nav className="home-nav" aria-label="Menu principal">
        {isTeam ? (
          <div className="home-nav-group">
            {viewItem(
              VIEWS.QUEUE,
              FaHeadset,
              "Fila de atendimento",
              unsavedDrafts && currentView !== VIEWS.QUEUE
                ? `${unsavedDrafts} ${unsavedDrafts === 1 ? "resposta não salva" : "respostas não salvas"}`
                : ""
            )}
            {viewItem(VIEWS.HISTORY, FaClockRotateLeft, "Histórico")}
            {isAdmin ? viewItem(VIEWS.SLA, FaChartLine, "Relatório de SLA") : null}
          </div>
        ) : null}

        <div className="home-nav-group">
          {isTeam ? modalItem(MODALS.NEW_TICKET, FaPlus, "Nova solicitação") : null}
          {modalItem(MODALS.MY_TICKETS, FaInbox, "Minhas solicitações")}
        </div>

        {isAdmin ? (
          <div className="home-nav-group" aria-label="Administração" role="group">
            {modalItem(MODALS.USERS, FaUsers, "Usuários")}
            {modalItem(MODALS.SETTINGS, FaGear, "Configurações")}
          </div>
        ) : null}
      </nav>

      <div className="home-main">
        <Feedback className="home-load-error">{loadError}</Feedback>

        {!isTeam ? <TicketForm requesterName={user?.name || username} onSubmit={handleCreateTicket} /> : null}

        {isTeam && currentView === VIEWS.QUEUE ? (
          <TiQueueView
            chamados={tickets}
            isLoading={!hasLoaded}
            onUpdateChamado={handleUpdateTicket}
            drafts={queueDrafts}
            setDrafts={setQueueDrafts}
          />
        ) : null}

        {isTeam && currentView === VIEWS.HISTORY ? (
          <TicketHistoryView
            chamados={tickets}
            currentUsername={username}
            isLoading={!hasLoaded}
            onUpdateChamado={handleUpdateTicket}
          />
        ) : null}

        {isAdmin && currentView === VIEWS.SLA ? <SlaReportView chamados={tickets} /> : null}
      </div>

      {isTeam && isOpen(MODALS.NEW_TICKET) ? (
        <Modal isOpen onClose={close} title="Nova solicitação" className="modal-paper">
          <TicketForm requesterName={user?.name || username} onSubmit={handleCreateTicket} headingTag="p" />
        </Modal>
      ) : null}

      <MyTicketsModal isOpen={isOpen(MODALS.MY_TICKETS)} onClose={close} solicitacoes={myTickets} />

      {isAdmin ? (
        <>
          {isOpen(MODALS.USERS) ? <UsersModal isOpen onClose={close} currentUserId={user?.id} /> : null}
          {isOpen(MODALS.SETTINGS) ? <SettingsModal isOpen onClose={close} /> : null}
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
