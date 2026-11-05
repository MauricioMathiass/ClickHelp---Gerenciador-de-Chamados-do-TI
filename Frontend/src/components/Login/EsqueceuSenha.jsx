import "./EsqueceuSenha.css";

function EsqueceuSenha({ onBack }) {
  return (
    <section className="forgot-password-card">
      <div className="forgot-password-mark" aria-hidden="true">
        <span className="forgot-password-mark-core"></span>
      </div>

      <span className="forgot-password-chip">Suporte de acesso</span>
      <h1>Esqueceu a senha?</h1>
      <p>Entre em contato com a Equipe de TI para que sua senha seja redefinida.</p>

      <button type="button" className="forgot-password-action" onClick={onBack}>
        Voltar para o login
      </button>
    </section>
  );
}

export default EsqueceuSenha;
