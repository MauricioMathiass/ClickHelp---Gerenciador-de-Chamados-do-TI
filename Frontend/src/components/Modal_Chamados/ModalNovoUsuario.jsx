import { useEffect, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import ModalBase from "./ModalBase";
import { buildDisplayUsernamePreview, createUser } from "../../services/auth";

function ModalNovoUsuario({ isOpen, onClose }) {
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const displayUsername = buildDisplayUsernamePreview(name, surname);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setSurname("");
      setPassword("");
      setConfirmPassword("");
      setFeedback("");
      setFeedbackType("");
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [isOpen]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name.trim() || !surname.trim() || !password.trim() || !confirmPassword.trim()) {
      setFeedback("Preencha todos os campos obrigatorios.");
      setFeedbackType("error");
      return;
    }

    if (password !== confirmPassword) {
      setFeedback("A confirmacao de senha precisa ser igual a senha informada.");
      setFeedbackType("error");
      return;
    }

    try {
      const createdUser = await createUser({
        name,
        surname,
        password,
      });

      setFeedback(`Usuario cadastrado com sucesso. Login gerado: ${createdUser.username}`);
      setFeedbackType("success");
      setName("");
      setSurname("");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setFeedback(error.message || "Nao foi possivel cadastrar o usuario.");
      setFeedbackType("error");
    }
  };

  return (
    <ModalBase isOpen={isOpen} onClose={onClose} title="Cadastrar novo usuario">
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
            <label htmlFor="novo-usuario-exibicao">Nome de exibicao</label>
            <input
              id="novo-usuario-exibicao"
              type="text"
              value={displayUsername}
              placeholder="nome.sobrenome"
              readOnly
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
                placeholder="Crie uma senha"
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
          <button type="submit" className="modal-primary-action">
            Cadastrar usuario
          </button>
        </div>
      </form>
    </ModalBase>
  );
}

export default ModalNovoUsuario;
