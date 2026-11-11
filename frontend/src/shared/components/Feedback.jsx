/** Aviso de erro ou de sucesso. Não renderiza nada quando não há mensagem. */
function Feedback({ type = "error", className = "", children }) {
  if (!children) {
    return null;
  }

  return (
    <div
      className={`feedback feedback-${type} ${className}`.trim()}
      role={type === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export default Feedback;
