import { useEffect, useMemo, useState } from "react";
import { FaBell } from "react-icons/fa";
import { FaArrowRightFromBracket } from "react-icons/fa6";
import "./ContainerMain.css";
import ModalChamados from "../Modal_Chamados/ModalChamados";
import ModalChamaTi from "../Modal_Chamados/ModalChamaTi";
import ModalHistoricoChama from "../Modal_Chamados/ModalHistoricoChama";
import ModalNovoUsuario from "../Modal_Chamados/ModalNovoUsuario";
import ModalSLA from "../Modal_Chamados/ModalSLA";
import ModalNotificacoes from "../Modal_Chamados/ModalNotificacoes";
import CustomSelect from "../Common/CustomSelect";
import { createChamado, getChamadosForSession, updateChamado } from "../../services/chamados";
import { notifyNewTicketByEmail } from "../../services/emailNotifications";
import {
  clearNotificationsForSession,
  getArchivedNotificationsForSession,
  createAppNotification,
  getNotificationsForSession,
  getUnreadNotificationCountForSession,
  markNotificationHistoryAsSeen,
  subscribeNotifications,
  TI_NOTIFICATION_ROLES,
} from "../../services/notifications";

function ContainerMain({ onBack, session }) {
  const [openModalChamados, setOpenModalChamados] = useState(false);
  const [openModalTI, setOpenModalTI] = useState(false);
  const [openModalHistorico, setOpenModalHistorico] = useState(false);
  const [openModalNovoUsuario, setOpenModalNovoUsuario] = useState(false);
  const [openModalSLA, setOpenModalSLA] = useState(false);
  const [openModalNotificacoes, setOpenModalNotificacoes] = useState(false);
  const [assunto, setAssunto] = useState("");
  const [local, setLocal] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [problema, setProblema] = useState("");
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [archivedNotifications, setArchivedNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState("");

  const solicitante = session?.user?.username ?? "";
  const userDisplayName = (session?.user?.name ?? "Usuario")
    .replace(/\s*ClickHELP\s*/gi, " ")
    .trim();
  const canViewTiPanel = useMemo(
    () => ["Administrador", "Analista de TI"].includes(session?.user?.role ?? ""),
    [session]
  );
  const isAdmin = session?.user?.role === "Administrador";
  const localOptions = useMemo(
    () => [
      { value: "", label: "Selecione um local" },
      { value: "ORV", label: "ORV" },
      { value: "AWA", label: "ÃƒWA" },
      { value: "SOCIAL", label: "SOCIAL" },
    ],
    []
  );
  const prioridadeOptions = useMemo(
    () => [
      { value: "", label: "Selecione a prioridade" },
      { value: "baixa", label: "Baixa" },
      { value: "media", label: "Media" },
      { value: "alta", label: "Alta" },
    ],
    []
  );
  const userSolicitacoes = useMemo(
    () => solicitacoes.filter((item) => item.solicitante === solicitante),
    [solicitacoes, solicitante]
  );

  const refreshChamados = async () => {
    if (!session?.user) {
      setSolicitacoes([]);
      return;
    }

    try {
      const chamados = await getChamadosForSession(session);
      setSolicitacoes(chamados);
    } catch (error) {
      console.error("Falha ao carregar chamados do backend:", error);
      setSolicitacoes([]);
    }
  };

  useEffect(() => {
    refreshChamados();
  }, [session]);

  useEffect(() => {
    if (!session?.user) {
      setNotifications([]);
      setArchivedNotifications([]);
      return undefined;
    }

    const refreshNotifications = () => {
      setNotifications(getNotificationsForSession(session));
      setArchivedNotifications(getArchivedNotificationsForSession(session));
      setUnreadNotificationCount(getUnreadNotificationCountForSession(session));
    };

    refreshNotifications();
    const unsubscribe = subscribeNotifications(refreshNotifications);

    return unsubscribe;
  }, [session]);

  useEffect(() => {
    if (!openModalNotificacoes || !session?.user || !notifications.length) {
      return;
    }

    markNotificationHistoryAsSeen(
      session,
      notifications.map((notification) => notification.id)
    );
    setUnreadNotificationCount(0);
  }, [openModalNotificacoes, notifications, session]);

  const limparFormulario = () => {
    setAssunto("");
    setLocal("");
    setPrioridade("");
    setProblema("");
  };

  const limparFeedbackFormulario = () => {
    if (feedback) {
      setFeedback("");
      setFeedbackType("");
    }
  };

  const enviarSolicitacao = async () => {
    if (!assunto || !solicitante || !local || !prioridade || !problema) {
      setFeedback("Preencha todos os campos obrigatórios antes de enviar.");
      setFeedbackType("error");
      return;
    }

    try {
      const chamadoCriado = await createChamado({
        assunto,
        solicitante,
        local,
        prioridade,
        problema,
        userId: session?.user?.id,
      });

      createAppNotification({
        type: "solicitacao-enviada",
        title: "Solicitação enviada",
        message: `Seu chamado "${assunto}" foi registrado com sucesso no ClickHELP.`,
        recipients: {
          usernames: [solicitante],
        },
        context: {
          chamadoId: chamadoCriado.id,
        },
      });

      createAppNotification({
        type: "novo-chamado-ti",
        title: "Nova solicitação recebida",
        message: `${solicitante} abriu o chamado "${assunto}" e aguarda atendimento da equipe de TI.`,
        recipients: {
          roles: TI_NOTIFICATION_ROLES,
        },
        context: {
          chamadoId: chamadoCriado.id,
        },
      });

      try {
        await notifyNewTicketByEmail({
          assunto: chamadoCriado.assunto,
          solicitante: chamadoCriado.solicitante,
          local: chamadoCriado.local,
          prioridade: chamadoCriado.prioridade,
          problema: chamadoCriado.problema,
          chamadoId: chamadoCriado.id,
          createdAt: chamadoCriado.dataCriacao,
        });
      } catch (error) {
        console.error("Falha ao enviar notificacao por e-mail:", error);
      }

      await refreshChamados();
      limparFormulario();
      setFeedback("Solicitação enviada com sucesso.");
      setFeedbackType("success");
      setOpenModalChamados(true);
    } catch (error) {
      console.error("Falha ao criar chamado no backend:", error);
      setFeedback("Nao foi possivel enviar a solicitacao agora.");
      setFeedbackType("error");
    }
  };

  const handleUpdateChamado = async (id, updates) => {
    const chamadoAnterior = solicitacoes.find((item) => item.id === id);
    const nextStatus = updates.status ?? chamadoAnterior?.status;
    const isClosingNow = nextStatus === "Fechado" && chamadoAnterior?.status !== "Fechado";

    try {
      const updated = await updateChamado(id, {
        ...updates,
        ...(isClosingNow
          ? {
              dataFechamento: new Date().toISOString(),
              closedByUsername: session?.user?.username ?? "",
              closedByName: userDisplayName,
              closedByRole: session?.user?.role ?? "",
            }
          : {}),
        slaViolado:
          nextStatus === "Fechado" && chamadoAnterior?.dataLimite
            ? new Date(chamadoAnterior.dataLimite) < new Date()
            : chamadoAnterior?.slaViolado ?? false,
      });

      if (updated) {
        if (
          updates.status &&
          updates.status !== chamadoAnterior?.status &&
          ["Em andamento", "Fechado"].includes(updates.status)
        ) {
          createAppNotification({
            type: "status-chamado-atualizado",
            title: `Chamado ${updates.status === "Fechado" ? "fechado" : "em andamento"}`,
            message: `Sua solicitação "${updated.assunto}" foi atualizada para "${updates.status}".`,
            recipients: {
              usernames: [updated.solicitante],
            },
            context: {
              chamadoId: updated.id,
              status: updates.status,
            },
          });
        }

        await refreshChamados();
      }
    } catch (error) {
      console.error("Falha ao atualizar chamado no backend:", error);
    }
  };

  const handleClearNotifications = () => {
    clearNotificationsForSession(session);
  };

  return (
    <section className="container-main">
      <button type="button" className="top-back-button" onClick={onBack}>
        <FaArrowRightFromBracket className="top-back-button-icon-left" />
        <span>Sair</span>
      </button>

      <div className="main-panel">
        <div className="main-panel-head">
          <div>
            <h1>ClickHELP</h1>
            <p>Centralize solicitação, acompanhe o andamento e mantenha o suporte de TI organizado.</p>
          </div>

          <div className="main-user-card-stack">
            <div className="main-user-card">
              <span>Conectado como</span>
              <strong>{userDisplayName}</strong>
            </div>

            {isAdmin ? (
              <button
                type="button"
                className="main-user-action-button"
                onClick={() => setOpenModalNovoUsuario(true)}
              >
                Novo usuario
              </button>
            ) : null}
          </div>
        </div>

        <div className="main-actions">
          {canViewTiPanel ? (
            <button className="botao-status-solicitacao" onClick={() => setOpenModalTI(true)}>
              Painel TI
            </button>
          ) : null}

          <button className="botao-status-solicitacao" onClick={() => setOpenModalChamados(true)}>
            Solicitações
          </button>

          <div className="main-actions-tools">
            <button
              type="button"
              className="main-notification-button"
              onClick={() => setOpenModalNotificacoes(true)}
              aria-label="Abrir notificacoes"
              title="Notificacoes"
            >
              <FaBell />
              {unreadNotificationCount ? (
                <span className="main-notification-badge">{Math.min(unreadNotificationCount, 9)}</span>
              ) : null}
            </button>

            {isAdmin ? (
              <div className="main-actions-admin">
                <button className="botao-status-solicitacao" onClick={() => setOpenModalSLA(true)}>
                  SLA
                </button>

                <button
                  className="botao-status-solicitacao"
                  onClick={() => setOpenModalHistorico(true)}
                >
                  HistÃ³rico
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="form-card">
          <div className="sub-titulo-help">
            <h2>Cadastrar solicitação</h2>
            <p>Abra um novo chamado para a equipe de tecnologia.</p>
          </div>

          <div className="corpo-solicitacao">
            <div>
              <label htmlFor="assunto-chamado">Assunto</label>
              <input
                id="assunto-chamado"
                type="text"
                value={assunto}
                onChange={(event) => setAssunto(event.target.value)}
                onFocus={limparFeedbackFormulario}
                placeholder="Ex.: impressora sem conexÃ£o"
              />
            </div>

            <div>
              <label htmlFor="solicitante-chamado">Solicitante</label>
              <input id="solicitante-chamado" type="text" value={solicitante} readOnly />
            </div>

            <div>
              <label htmlFor="local-chamado">Local</label>
              <CustomSelect
                className="form-select"
                name="local"
                value={local}
                onChange={(event) => setLocal(event.target.value)}
                options={localOptions}
                placeholder="Selecione um local"
              />
            </div>

            <div>
              <label htmlFor="prioridade-chamado">Prioridade</label>
              <CustomSelect
                className="form-select"
                name="prioridade"
                value={prioridade}
                onChange={(event) => setPrioridade(event.target.value)}
                options={prioridadeOptions}
                placeholder="Selecione a prioridade"
              />
            </div>

            <div className="chamados-classe">
              <label htmlFor="descreva-chamado">Descreva o problema</label>
              <textarea
                id="descreva-chamado"
                rows="5"
                value={problema}
                onChange={(event) => setProblema(event.target.value)}
                placeholder="Conte com detalhes o que esta acontecendo."
              />
            </div>
          </div>

          {feedback ? (
            <div className={`form-feedback form-feedback-${feedbackType || "error"}`.trim()}>
              {feedback}
            </div>
          ) : null}

          <div className="enviar-help">
            <button onClick={enviarSolicitacao}>Enviar solicitação</button>
          </div>
        </div>
      </div>

      <ModalChamados
        isOpen={openModalChamados}
        onClose={() => setOpenModalChamados(false)}
        solicitacoes={userSolicitacoes}
      />

      <ModalChamaTi
        isOpen={openModalTI}
        onClose={() => setOpenModalTI(false)}
        chamados={solicitacoes}
        onUpdateChamado={handleUpdateChamado}
        abrirSLA={() => setOpenModalSLA(true)}
      />

      <ModalHistoricoChama
        isOpen={openModalHistorico}
        onClose={() => setOpenModalHistorico(false)}
        solicitacoes={solicitacoes.filter(
          (item) =>
            item.status === "Fechado" &&
            (!item.closedByUsername || item.closedByUsername === session?.user?.username)
        )}
      />

      <ModalNovoUsuario
        isOpen={openModalNovoUsuario}
        onClose={() => setOpenModalNovoUsuario(false)}
      />

      <ModalSLA isOpen={openModalSLA} onClose={() => setOpenModalSLA(false)} chamados={solicitacoes} />

      <ModalNotificacoes
        isOpen={openModalNotificacoes}
        onClose={() => setOpenModalNotificacoes(false)}
        notifications={notifications}
        archivedNotifications={archivedNotifications}
        onClear={handleClearNotifications}
      />
    </section>
  );
}

export default ContainerMain;
