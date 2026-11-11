import { useCallback, useEffect, useState } from "react";
import { FaBell } from "react-icons/fa";
import { FaArrowRightFromBracket } from "react-icons/fa6";
import "./ContainerMain.css";
import ModalChamados from "../Modal_Chamados/ModalChamados";
import ModalChamaTi from "../Modal_Chamados/ModalChamaTi";
import ModalHistoricoChama from "../Modal_Chamados/ModalHistoricoChama";
import ModalUsuarios from "../Modal_Chamados/ModalUsuarios";
import ModalSLA from "../Modal_Chamados/ModalSLA";
import ModalNotificacoes from "../Modal_Chamados/ModalNotificacoes";
import CustomSelect from "../Common/CustomSelect";
import { getApiErrorMessage } from "../../services/api";
import { createChamado, getChamados, updateChamado } from "../../services/chamados";
import { notifyNewTicketByEmail } from "../../services/emailNotifications";
import {
  clearNotifications,
  getNotificationsState,
  markAllNotificationsAsRead,
  refreshNotifications,
  subscribeNotifications,
} from "../../services/notifications";

const CHAMADOS_REFRESH_MS = 30000;
const TI_ROLES = ["Administrador", "Analista de TI"];

const LOCAL_OPTIONS = [
  { value: "", label: "Selecione um local" },
  { value: "ORV", label: "ORV" },
  { value: "AWA", label: "AWA" },
  { value: "SOCIAL", label: "SOCIAL" },
];

const PRIORIDADE_OPTIONS = [
  { value: "", label: "Selecione a prioridade" },
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
];

function ContainerMain({ onBack, session }) {
  const [openModalChamados, setOpenModalChamados] = useState(false);
  const [openModalTI, setOpenModalTI] = useState(false);
  const [openModalHistorico, setOpenModalHistorico] = useState(false);
  const [openModalUsuarios, setOpenModalUsuarios] = useState(false);
  const [openModalSLA, setOpenModalSLA] = useState(false);
  const [openModalNotificacoes, setOpenModalNotificacoes] = useState(false);
  const [assunto, setAssunto] = useState("");
  const [local, setLocal] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [problema, setProblema] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [notificationsState, setNotificationsState] = useState(getNotificationsState);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState("");

  const username = session?.user?.username ?? "";
  const role = session?.user?.role ?? "";
  const userDisplayName = (session?.user?.name ?? "Usuário").replace(/\s*ClickHELP\s*/gi, " ").trim();
  const canViewTiPanel = TI_ROLES.includes(role);
  const isAdmin = role === "Administrador";
  const userSolicitacoes = solicitacoes.filter((item) => item.solicitante === username);
  const { notifications, archived: archivedNotifications, unreadCount } = notificationsState;

  const refreshChamados = useCallback(async () => {
    try {
      setSolicitacoes(await getChamados());
      setLoadError("");
    } catch (error) {
      if (error.response?.status !== 401) {
        setLoadError(
          getApiErrorMessage(error, "Não foi possível atualizar os chamados.") +
            " Os dados exibidos podem estar desatualizados."
        );
      }
    }
  }, []);

  useEffect(() => {
    refreshChamados();
    const intervalId = window.setInterval(refreshChamados, CHAMADOS_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [refreshChamados, username]);

  useEffect(() => subscribeNotifications(setNotificationsState), [username]);

  // Ao abrir o modal, marca todas como lidas (inclusive as que não cabem na lista).
  useEffect(() => {
    if (openModalNotificacoes && unreadCount > 0) {
      markAllNotificationsAsRead().catch(() => {});
    }
  }, [openModalNotificacoes, unreadCount]);

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
    if (!assunto.trim() || !local || !prioridade || !problema.trim()) {
      setFeedback("Preencha todos os campos obrigatórios antes de enviar.");
      setFeedbackType("error");
      return;
    }

    setIsSending(true);

    try {
      const chamadoCriado = await createChamado({ assunto, local, prioridade, problema });

      notifyNewTicketByEmail({
        assunto: chamadoCriado.assunto,
        solicitante: chamadoCriado.solicitante,
        local: chamadoCriado.local,
        prioridade: chamadoCriado.prioridade,
        problema: chamadoCriado.problema,
        chamadoId: chamadoCriado.id,
        createdAt: chamadoCriado.dataCriacao,
      }).catch((error) => console.error("Falha ao enviar notificação por e-mail:", error));

      await Promise.all([refreshChamados(), refreshNotifications()]);
      limparFormulario();
      setFeedback("Solicitação enviada com sucesso.");
      setFeedbackType("success");
      setOpenModalChamados(true);
    } catch (error) {
      setFeedback(getApiErrorMessage(error, "Não foi possível enviar a solicitação agora."));
      setFeedbackType("error");
    } finally {
      setIsSending(false);
    }
  };

  /** Envia status/resposta ao backend; devolve a mensagem de erro, se houver. */
  const handleUpdateChamado = async (id, updates) => {
    try {
      await updateChamado(id, updates);
      await Promise.all([refreshChamados(), refreshNotifications()]);
      return null;
    } catch (error) {
      return getApiErrorMessage(error, "Não foi possível atualizar o chamado.");
    }
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
            <p>Centralize solicitações, acompanhe o andamento e mantenha o suporte de TI organizado.</p>
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
                onClick={() => setOpenModalUsuarios(true)}
              >
                Usuários
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
              aria-label="Abrir notificações"
              title="Notificações"
            >
              <FaBell />
              {unreadCount ? (
                <span className="main-notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
              ) : null}
            </button>

            {canViewTiPanel ? (
              <div className="main-actions-admin">
                {isAdmin ? (
                  <button className="botao-status-solicitacao" onClick={() => setOpenModalSLA(true)}>
                    SLA
                  </button>
                ) : null}

                <button
                  className="botao-status-solicitacao"
                  onClick={() => setOpenModalHistorico(true)}
                >
                  Histórico
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {loadError ? (
          <div className="form-feedback form-feedback-error main-load-error" role="alert">
            {loadError}
          </div>
        ) : null}

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
                maxLength={150}
                onChange={(event) => setAssunto(event.target.value)}
                onFocus={limparFeedbackFormulario}
                placeholder="Ex.: impressora sem conexão"
              />
            </div>

            <div>
              <label htmlFor="solicitante-chamado">Solicitante</label>
              <input id="solicitante-chamado" type="text" value={username} readOnly />
            </div>

            <div>
              <label htmlFor="local-chamado">Local</label>
              <CustomSelect
                id="local-chamado"
                className="form-select"
                name="local"
                value={local}
                onChange={(event) => setLocal(event.target.value)}
                options={LOCAL_OPTIONS}
                placeholder="Selecione um local"
              />
            </div>

            <div>
              <label htmlFor="prioridade-chamado">Prioridade</label>
              <CustomSelect
                id="prioridade-chamado"
                className="form-select"
                name="prioridade"
                value={prioridade}
                onChange={(event) => setPrioridade(event.target.value)}
                options={PRIORIDADE_OPTIONS}
                placeholder="Selecione a prioridade"
              />
            </div>

            <div className="chamados-classe">
              <label htmlFor="descreva-chamado">Descreva o problema</label>
              <textarea
                id="descreva-chamado"
                rows="5"
                value={problema}
                maxLength={5000}
                onChange={(event) => setProblema(event.target.value)}
                placeholder="Conte com detalhes o que está acontecendo."
              />
            </div>
          </div>

          {feedback ? (
            <div className={`form-feedback form-feedback-${feedbackType || "error"}`.trim()}>
              {feedback}
            </div>
          ) : null}

          <div className="enviar-help">
            <button onClick={enviarSolicitacao} disabled={isSending}>
              {isSending ? "Enviando..." : "Enviar solicitação"}
            </button>
          </div>
        </div>
      </div>

      <ModalChamados
        isOpen={openModalChamados}
        onClose={() => setOpenModalChamados(false)}
        solicitacoes={userSolicitacoes}
      />

      {canViewTiPanel ? (
        <ModalChamaTi
          isOpen={openModalTI}
          onClose={() => setOpenModalTI(false)}
          chamados={solicitacoes}
          onUpdateChamado={handleUpdateChamado}
          abrirSLA={isAdmin ? () => setOpenModalSLA(true) : null}
        />
      ) : null}

      {canViewTiPanel ? (
        <ModalHistoricoChama
          isOpen={openModalHistorico}
          onClose={() => setOpenModalHistorico(false)}
          chamados={solicitacoes}
          currentUsername={username}
        />
      ) : null}

      {isAdmin ? (
        <>
          <ModalUsuarios
            isOpen={openModalUsuarios}
            onClose={() => setOpenModalUsuarios(false)}
            currentUserId={session?.user?.id}
          />

          {/* Rotinas diárias fixas não entram no relatório de SLA. */}
          <ModalSLA
            isOpen={openModalSLA}
            onClose={() => setOpenModalSLA(false)}
            chamados={solicitacoes.filter((item) => !item.isFixedRoutine)}
          />
        </>
      ) : null}

      <ModalNotificacoes
        isOpen={openModalNotificacoes}
        onClose={() => setOpenModalNotificacoes(false)}
        notifications={notifications}
        archivedNotifications={archivedNotifications}
        onClear={() => clearNotifications().catch(() => {})}
      />
    </section>
  );
}

export default ContainerMain;
