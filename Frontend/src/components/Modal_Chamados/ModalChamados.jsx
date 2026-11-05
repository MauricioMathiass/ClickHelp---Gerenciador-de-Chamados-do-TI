import ModalBase from "./ModalBase";

function formatDate(dateValue) {
  return new Date(dateValue).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ModalChamados({ isOpen, onClose, solicitacoes }) {
  return (
    <ModalBase isOpen={isOpen} onClose={onClose} title="Minhas solicitações" size="wide">
      <div className="tickets-stack">
        {solicitacoes.length ? (
          solicitacoes.map((item) => (
            <article key={item.id} className="ticket-card">
              <div className="ticket-card-top">
                <div>
                  <h3>{item.assunto}</h3>
                  <p>{item.problema}</p>
                </div>
                <span className={`ticket-status status-${item.status.toLowerCase().replace(/\s+/g, "-")}`}>
                  {item.status}
                </span>
              </div>

              <div className="ticket-meta">
                <span>Solicitante: {item.solicitante}</span>
                <span>Local: {item.local}</span>
                <span>Prioridade: {item.prioridade}</span>
                <span>Abertura: {formatDate(item.dataCriacao)}</span>
              </div>

              {item.resposta ? (
                <div className="ticket-response">
                  <strong>Resposta  TI</strong>
                  <p>{item.resposta}</p>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h3>Nenhuma solicitação cadastrada</h3>
            <p>Assim que você abrir um chamado, ele aparecerá aqui.</p>
          </div>
        )}
      </div>
    </ModalBase>
  );
}

export default ModalChamados;
