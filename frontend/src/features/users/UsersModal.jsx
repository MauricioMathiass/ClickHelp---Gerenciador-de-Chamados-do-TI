import { useCallback, useEffect, useState } from "react";
import Feedback from "../../shared/components/Feedback";
import Modal from "../../shared/components/Modal";
import Select from "../../shared/components/Select";
import { getApiErrorMessage } from "../../shared/services/api";
import { useSettings } from "../settings/useSettings";
import NewUserModal from "./NewUserModal";
import { ROLE_OPTIONS } from "./roles";
import { listUsers, updateUser } from "./usersService";
import "./users.css";

const MIN_PASSWORD_LENGTH = 6;

function UserCard({ user, isSelf, onSaved }) {
  const { catalog } = useSettings();
  const [newPassword, setNewPassword] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const locked = user.fromEnv;
  // Mantém o departamento atual na lista, mesmo que tenha sido removido das Configurações.
  const departmentOptions = [
    { value: "", label: "Sem departamento" },
    ...Array.from(new Set([...catalog.departments, user.department].filter(Boolean))).map((item) => ({
      value: item,
      label: item,
    })),
  ];

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
            value={user.role}
            options={ROLE_OPTIONS}
            disabled={isSaving || isSelf}
            onChange={(event) => save({ role: event.target.value }, "Perfil atualizado.")}
          />

          <Select
            className="compact"
            name={`departamento-${user.id}`}
            value={user.department ?? ""}
            options={departmentOptions}
            disabled={isSaving}
            onChange={(event) => save({ department: event.target.value }, "Departamento atualizado.")}
          />

          <button
            type="button"
            className="btn btn-ghost"
            disabled={isSaving || isSelf}
            onClick={() =>
              save({ active: !user.active }, user.active ? "Usuário desativado." : "Usuário reativado.")
            }
          >
            {user.active ? "Desativar" : "Reativar"}
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            disabled={isSaving}
            onClick={() => setShowReset((current) => !current)}
          >
            Redefinir senha
          </button>
        </div>
      )}

      {showReset && !locked ? (
        <div className="user-card-reset">
          <input
            className="input"
            type="text"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder={`Nova senha (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`}
            aria-label={`Nova senha para ${user.name}`}
            autoComplete="new-password"
          />
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
