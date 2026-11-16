import AuthTicket from "./AuthTicket";

function ForgotPasswordPage({ onBack }) {
  return (
    <AuthTicket>
      <section className="login-body">
        <h2 className="login-title">Esqueceu a senha?</h2>
        <p className="login-text">
          Peça à equipe de TI para redefinir sua senha. Depois, entre com a senha nova.
        </p>

        <button type="button" className="login-submit" onClick={onBack}>
          Voltar para o login
        </button>
      </section>
    </AuthTicket>
  );
}

export default ForgotPasswordPage;
