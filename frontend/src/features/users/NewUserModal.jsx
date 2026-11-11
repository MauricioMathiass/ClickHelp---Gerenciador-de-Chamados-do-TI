import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import Feedback from "../../shared/components/Feedback";
import Modal from "../../shared/components/Modal";
import Select from "../../shared/components/Select";
import { useSettings } from "../settings/useSettings";
import { ROLE_OPTIONS } from "./roles";
import { buildUsernamePreview, createUser } from "./usersService";
import "./users.css";

const MIN_PASSWORD_LENGTH = 6;

const EMPTY_FORM = {
  name: "",
  surname: "",
  password: "",
  confirmPassword: "",
  role: "Usuario",
  department: "",
};

function PasswordInput({ id, value, onChange, placeholder }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="admin-user-password-wrap">
      <input
        id={id}
        className="input"
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="new-password"
      />
      <button
        type="button"
        className="admin-user-password-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
      >
        {visible ? <FaEye /> : <FaEyeSlash />}
      </button>
    </div>
  );
}

function NewUserModal({ isOpen, onClose, onCreated, existingUsernames = [] }) {
  const { catalog } = useSettings();
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const displayUsername = buildUsernamePreview(form.name, form.surname, existingUsernames);
  const departmentOptions = [
    { value: "", label: "Sem departamento" },
    ...catalog.departments.map((item) => ({ value: item, label: item })),
  ];

  const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const fail = (text) => setFeedback({ type: "error", text });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.surname.trim() || !form.password.trim() || !form.confirmPassword.trim()) {
      fail("Preencha todos os campos obrigatórios.");
      return;
    }

    if (form.password.length < MIN_PASSWORD_LENGTH) {
      fail(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (form.password !== form.confirmPassword) {
      fail("A confirmação de senha precisa ser igual à senha informada.");
      return;
    }

    setIsSaving(true);

    try {
      const createdUser = await createUser(form);
      setFeedback({
        type: "success",
        text: `Usuário cadastrado com sucesso. Login gerado: ${createdUser.username}`,
      });
      onCreated?.(createdUser);
      setForm(EMPTY_FORM);
    } catch (error) {
      fail(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cadastrar novo usuário">
      <form className="admin-user-form" onSubmit={handleSubmit}>
        <div className="admin-user-grid">
          <div className="field">
            <label className="field-label" htmlFor="novo-usuario-nome">
              Nome
            </label>
            <input
              id="novo-usuario-nome"
              className="input"
              type="text"
              value={form.name}
              onChange={setField("name")}
              placeholder="Digite o nome"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="novo-usuario-sobrenome">
              Sobrenome
            </label>
            <input
              id="novo-usuario-sobrenome"
              className="input"
              type="text"
              value={form.surname}
              onChange={setField("surname")}
              placeholder="Digite o sobrenome"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="novo-usuario-login">
              Login (gerado automaticamente)
            </label>
            <input
              id="novo-usuario-login"
              className="input"
              type="text"
              value={displayUsername}
              placeholder="nome.sobrenome"
              readOnly
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="novo-usuario-perfil">
              Perfil
            </label>
            <Select
              id="novo-usuario-perfil"
              className="compact"
              name="perfil"
              value={form.role}
              options={ROLE_OPTIONS}
              onChange={setField("role")}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="novo-usuario-departamento">
              Departamento
            </label>
            <Select
              id="novo-usuario-departamento"
              className="compact"
              name="departamento"
              value={form.department}
              options={departmentOptions}
              onChange={setField("department")}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="novo-usuario-senha">
              Senha
            </label>
            <PasswordInput
              id="novo-usuario-senha"
              value={form.password}
              onChange={setField("password")}
              placeholder={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="novo-usuario-confirma-senha">
              Confirme a senha
            </label>
            <PasswordInput
              id="novo-usuario-confirma-senha"
              value={form.confirmPassword}
              onChange={setField("confirmPassword")}
              placeholder="Repita a senha"
            />
          </div>
        </div>

        <Feedback type={feedback.type}>{feedback.text}</Feedback>

        <div className="admin-user-actions">
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? "Cadastrando..." : "Cadastrar usuário"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default NewUserModal;
