import { useEffect, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import ModalBase from "./ModalBase";
import CustomSelect from "../Common/CustomSelect";
import { buildDisplayUsernamePreview, createUser } from "../../services/auth";

import { ROLE_OPTIONS } from "./roleOptions";

const MIN_PASSWORD_LENGTH = 6;

/** Mesma regra do backend: se o login já existe, acrescenta .2, .3... */
const buildUsernamePreview = (name, surname, existingUsernames) => {
  const base = buildDisplayUsernamePreview(name, surname);

  if (!base) {
    return "";
  }

  const taken = new Set(existingUsernames);
  let candidate = base;
  let counter = 1;

  while (taken.has(candidate)) {
    counter += 1;
    candidate = `${base}.${counter}`;
  }

  return candidate;
};

function ModalNovoUsuario({ isOpen, onClose, existingUsernames = [] }) {
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("Usuario");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const displayUsername = buildUsernamePreview(name, surname, existingUsernames);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setSurname("");
      setPassword("");
      setConfirmPassword("");
      setRole("Usuario");
      setFeedback("");
      setFeedbackType("");
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [isOpen]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name.trim() || !surname.trim() || !password.trim() || !confirmPassword.trim()) {
      setFeedback("Preencha todos os campos obrigatórios.");
      setFeedbackType("error");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFeedback(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      setFeedbackType("error");
      return;
    }

    if (password !== confirmPassword) {
      setFeedback("A confirmação de senha precisa ser igual à senha informada.");
      setFeedbackType("error");
      return;
    }

    setIsSaving(true);

    try {
      const createdUser = await createUser({
        name,
        surname,
        password,
        role,
      });

      setFeedback(`Usuário cadastrado com sucesso. Login gerado: ${createdUser.username}`);
      setFeedbackType("success");
      setName("");
      setSurname("");
      setPassword("");
      setConfirmPassword("");
      setRole("Usuario");
    } catch (error) {
      setFeedback(error.message || "Não foi possível cadastrar o usuário.");
      setFeedbackType("error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalBase isOpen={isOpen} onClose={onClose} title="Cadastrar novo usuário">
      <form className="admin-user-form" onSubmit={handleSubmit}>
        <div className="admin-user-grid">
          <div className="admin-user-field">
            <label htmlFor="novo-usuario-nome">Nome</label>
            <input
              id="novo-usuario-nome"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Digite o nome"
            />
          </div>

          <div className="admin-user-field">
            <label htmlFor="novo-usuario-sobrenome">Sobrenome</label>
            <input
              id="novo-usuario-sobrenome"
              type="text"
              value={surname}
              onChange={(event) => setSurname(event.target.value)}
              placeholder="Digite o sobrenome"
            />
          </div>

          <div className="admin-user-field">
            <label htmlFor="novo-usuario-exibicao">Login (gerado automaticamente)</label>
            <input
              id="novo-usuario-exibicao"
              type="text"
              value={displayUsername}
              placeholder="nome.sobrenome"
              readOnly
            />
          </div>

          <div className="admin-user-field">
            <label htmlFor="novo-usuario-perfil">Perfil</label>
            <CustomSelect
              id="novo-usuario-perfil"
              className="compact"
              name="perfil"
              value={role}
              options={ROLE_OPTIONS}
              onChange={(event) => setRole(event.target.value)}
            />
          </div>

          <div className="admin-user-field">
            <label htmlFor="novo-usuario-senha">Senha</label>
            <div className="admin-user-password-wrap">
              <input
                id="novo-usuario-senha"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`}
              />
              <button
                type="button"
                className="admin-user-password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <FaEye /> : <FaEyeSlash />}
              </button>
            </div>
          </div>

          <div className="admin-user-field">
            <label htmlFor="novo-usuario-confirma-senha">Confirme Senha</label>
            <div className="admin-user-password-wrap">
              <input
                id="novo-usuario-confirma-senha"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repita a senha"
              />
              <button
                type="button"
                className="admin-user-password-toggle"
                onClick={() => setShowConfirmPassword((current) => !current)}
                aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showConfirmPassword ? <FaEye /> : <FaEyeSlash />}
              </button>
            </div>
          </div>
        </div>

        {feedback ? (
          <div className={`admin-user-feedback admin-user-feedback-${feedbackType || "error"}`.trim()}>
            {feedback}
          </div>
        ) : null}

        <div className="admin-user-actions">
          <button type="submit" className="modal-primary-action" disabled={isSaving}>
            {isSaving ? "Cadastrando..." : "Cadastrar usuário"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}

export default ModalNovoUsuario;
