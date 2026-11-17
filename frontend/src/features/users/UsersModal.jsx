import { useCallback, useEffect, useState } from "react";
import Feedback from "../../shared/components/Feedback";
import Modal from "../../shared/components/Modal";
import Select from "../../shared/components/Select";
import { getApiErrorMessage } from "../../shared/services/api";
import { useSettings } from "../settings/useSettings";
import NewUserModal from "./NewUserModal";
import { ROLE_ADMIN, ROLE_OPTIONS } from "./roles";
import { listUsers, updateUser } from "./usersService";
import "../tickets/tickets.css";
import "./users.css";

const MIN_PASSWORD_LENGTH = 6;

const SUCCESS_VISIBLE_MS = 4000;

function UserCard({ user, isSelf, onSaved }) {
  const { catalog } = useSettings();
  const [newPassword, setNewPassword] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingRole, setPendingRole] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const locked = user.fromEnv;
  const roleLabel = (role) => ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
  // Mantém o departamento atual na lista, mesmo que tenha sido removido das Configurações.
  const departmentOptions = [
    { value: "", label: "Sem departamento" },
    ...Array.from(new Set([...catalog.departments, user.department].filter(Boolean))).map((item) => ({
      value: item,
      label: item,
    })),
  ];

  // Avisos de sucesso somem sozinhos; erros ficam até a próxima ação.
  useEffect(() => {
    if (feedback.type !== "success") {
      return undefined;
    }

    const id = window.setTimeout(() => setFeedback({ type: "", text: "" }), SUCCESS_VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [feedback]);

  const save = async (changes, successText) => {
    setIsSaving(true);
    setFeedback({ type: "", text: "" });

    try {
      await updateUser(user.id, changes);
      setFeedback({ type: "success", text: successText });
      onSaved();
      return true;
    } catch (error) {
      setFeedback({ type: "error", text: error.message });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRole = async () => {
    if (
      await save({ role: pendingRole }, `Perfil de ${user.name} alterado para ${roleLabel(pendingRole)}.`)
    ) {
      setPendingRole(null);
    }
  };

  const handleDeactivate = async () => {
    if (await save({ active: false }, `Acesso de ${user.name} desativado.`)) {
      setConfirmDeactivate(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setFeedback({
        type: "error",
        text: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      });
      return;
    }

    if (await save({ password: newPassword }, "Senha redefinida. Informe a nova senha ao usuário.")) {
      setNewPassword("");
      setShowReset(false);
      setShowPassword(false);
    }
  };

  return (
    <article className={`ticket-card user-card ${user.active ? "" : "user-card-inactive"}`.trim()}>
      <div className="ticket-card-top">
        <div>
          <h3>{user.name}</h3>
          <p>
            {user.username}
            {isSelf ? " (você)" : ""}
            {user.department ? ` · ${user.department}` : ""}
          </p>
        </div>
        <span className={`ticket-status ${user.active ? "status-fechado" : "status-inativo"}`}>
          {user.active ? "Ativo" : "Inativo"}
        </span>
      </div>

      {locked ? (
        <p className="user-card-note">
          Administrador principal, definido no arquivo .env do servidor. Não pode ser alterado por aqui.
        </p>
      ) : (
        <div className="user-card-actions">
          <Select
            className="compact"
            name={`perfil-${user.id}`}
            ariaLabel={`Perfil de ${user.name}`}
            value={pendingRole ?? user.role}
            options={ROLE_OPTIONS}
            disabled={isSaving || isSelf}
            onChange={(event) => {
              const { value } = event.target;
              setPendingRole(value === user.role ? null : value);
              setConfirmDeactivate(false);
            }}
          />

          <Select
            className="compact"
            name={`departamento-${user.id}`}
            ariaLabel={`Departamento de ${user.name}`}
            value={user.department ?? ""}
            options={departmentOptions}
            disabled={isSaving}
            onChange={(event) => save({ department: event.target.value }, "Departamento atualizado.")}
          />

          <button
            type="button"
            className="btn btn-ghost"
            disabled={isSaving || isSelf}
            aria-label={`${user.active ? "Desativar" : "Reativar"} ${user.name}`}
            onClick={() => {
              if (user.active) {
                setConfirmDeactivate(true);
                setPendingRole(null);
              } else {
                save({ active: true }, `Acesso de ${user.name} reativado.`);
              }
            }}
          >
            {user.active ? "Desativar" : "Reativar"}
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            disabled={isSaving}
            aria-expanded={showReset}
            aria-label={`Redefinir senha de ${user.name}`}
            onClick={() => setShowReset((current) => !current)}
          >
            Redefinir senha
          </button>
        </div>
      )}

      {pendingRole && !locked ? (
        <div className="user-card-confirm" role="group" aria-label="Confirmar mudança de perfil">
          <p>
            Mudar o perfil de <strong>{user.name}</strong> para <strong>{roleLabel(pendingRole)}</strong>?
            {pendingRole === ROLE_ADMIN
              ? " Administradores cadastram usuários e alteram as Configurações."
              : ""}
          </p>
          <div className="user-card-confirm-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPendingRole(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={isSaving}
              onClick={handleSaveRole}
            >
              {isSaving ? "Salvando..." : "Salvar perfil"}
            </button>
          </div>
        </div>
      ) : null}

      {confirmDeactivate && !locked ? (
        <div className="user-card-confirm is-danger" role="group" aria-label="Confirmar desativação">
          <p>
            Desativar <strong>{user.name}</strong>? A pessoa perde o acesso agora e as sessões abertas são
            encerradas. Os chamados dela continuam no sistema, e você pode reativar depois.
          </p>
          <div className="user-card-confirm-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setConfirmDeactivate(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={isSaving}
              onClick={handleDeactivate}
            >
              {isSaving ? "Desativando..." : `Desativar ${user.name}`}
            </button>
          </div>
        </div>
      ) : null}

      {showReset && !locked ? (
        <div className="user-card-reset">
          <input
            className="input"
            type={showPassword ? "text" : "password"}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder={`Nova senha (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`}
            aria-label={`Nova senha para ${user.name}`}
            autoComplete="new-password"
          />
          <button
            type="button"
            className="btn btn-ghost"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
          <button type="button" className="btn btn-primary" disabled={isSaving} onClick={handleResetPassword}>
            Salvar senha
          </button>
        </div>
      ) : null}

      <Feedback type={feedback.type}>{feedback.text}</Feedback>
    </article>
  );
}

function UsersModal({ isOpen, onClose, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [openNovoUsuario, setOpenNovoUsuario] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setUsers(await listUsers());
      setLoadError("");
    } catch (error) {
      setLoadError(getApiErrorMessage(error, "Não foi possível carregar os usuários."));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca ao abrir; o estado muda só após a resposta
    refresh();
  }, [refresh]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Usuários"
        size="wide"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setOpenNovoUsuario(true)}>
            Cadastrar novo usuário
          </button>
        }
      >
        <Feedback>{loadError}</Feedback>

        <div className="tickets-stack">
          {users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              isSelf={Number(user.id) === Number(currentUserId)}
              onSaved={refresh}
            />
          ))}
        </div>
      </Modal>

      {openNovoUsuario ? (
        <NewUserModal
          isOpen
          onClose={() => {
            setOpenNovoUsuario(false);
            refresh();
          }}
          onCreated={refresh}
          existingUsernames={users.map((user) => user.username)}
        />
      ) : null}
    </>
  );
}

export default UsersModal;
