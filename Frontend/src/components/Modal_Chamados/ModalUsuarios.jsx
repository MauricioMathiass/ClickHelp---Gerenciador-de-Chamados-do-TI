import { useCallback, useEffect, useState } from "react";
import ModalBase from "./ModalBase";
import ModalNovoUsuario from "./ModalNovoUsuario";
import CustomSelect from "../Common/CustomSelect";
import { listUsers, updateUser } from "../../services/users";
import { getApiErrorMessage } from "../../services/api";
import { ROLE_OPTIONS } from "./roleOptions";

const MIN_PASSWORD_LENGTH = 6;

function UsuarioCard({ user, isSelf, onSaved }) {
  const [newPassword, setNewPassword] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const locked = user.fromEnv;

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
      setFeedback({ type: "error", text: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` });
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
          <CustomSelect
            className="compact"
            name={`perfil-${user.id}`}
            value={user.role}
            options={ROLE_OPTIONS}
            disabled={isSaving || isSelf}
            onChange={(event) => save({ role: event.target.value }, "Perfil atualizado.")}
          />

          <button
            type="button"
            className="modal-close"
            disabled={isSaving || isSelf}
            onClick={() =>
              save({ active: !user.active }, user.active ? "Usuário desativado." : "Usuário reativado.")
            }
          >
            {user.active ? "Desativar" : "Reativar"}
          </button>

          <button
            type="button"
            className="modal-close"
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
            type="text"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder={`Nova senha (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`}
            aria-label={`Nova senha para ${user.name}`}
            autoComplete="new-password"
          />
          <button type="button" className="modal-primary-action" disabled={isSaving} onClick={handleResetPassword}>
            Salvar senha
          </button>
        </div>
      ) : null}

      {feedback.text ? (
        <div className={`admin-user-feedback admin-user-feedback-${feedback.type}`} role="status">
          {feedback.text}
        </div>
      ) : null}
    </article>
  );
}

function ModalUsuarios({ isOpen, onClose, currentUserId }) {
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
    if (isOpen) {
      refresh();
    }
  }, [isOpen, refresh]);

  return (
    <>
      <ModalBase
        isOpen={isOpen}
        onClose={onClose}
        title="Usuários"
        size="wide"
        actions={
          <button type="button" className="modal-primary-action" onClick={() => setOpenNovoUsuario(true)}>
            Cadastrar novo usuário
          </button>
        }
      >
        {loadError ? <div className="form-feedback form-feedback-error">{loadError}</div> : null}

        <div className="tickets-stack">
          {users.map((user) => (
            <UsuarioCard
              key={user.id}
              user={user}
              isSelf={Number(user.id) === Number(currentUserId)}
              onSaved={refresh}
            />
          ))}
        </div>
      </ModalBase>

      <ModalNovoUsuario
        isOpen={openNovoUsuario}
        onClose={() => {
          setOpenNovoUsuario(false);
          refresh();
        }}
        existingUsernames={users.map((user) => user.username)}
      />
    </>
  );
}

export default ModalUsuarios;
