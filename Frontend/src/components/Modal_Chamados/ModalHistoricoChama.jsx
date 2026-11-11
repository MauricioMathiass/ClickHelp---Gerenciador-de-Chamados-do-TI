import ModalBase from "./ModalBase";

function formatDate(dateValue) {
  if (!dateValue) {
    return "Não informado";
  }

  return new Date(dateValue).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ModalHistoricoChama({ isOpen, onClose, solicitacoes }) {
  return (
    <ModalBase isOpen={isOpen} onClose={onClose} title="Histórico de chamados fechados" size="wide">
      <div className="tickets-stack">
        {solicitacoes.length ? (
          solicitacoes.map((item) => (
            <article key={item.id} className="ticket-card">
              <div className="ticket-card-top">
                <div>
                  <h3>{item.assunto}</h3>
                  <p>{item.problema}</p>
                </div>
                <span className="ticket-status status-fechado">{item.status}</span>
              </div>

              <div className="ticket-meta">
                <span>Solicitante: {item.solicitante}</span>
                <span>Local: {item.local}</span>
                <span>Prioridade: {item.prioridade}</span>
                <span>Abertura: {formatDate(item.dataCriacao)}</span>
                <span>Fechado em: {formatDate(item.dataFechamento ?? item.dataAtualizacao)}</span>
              </div>

              {item.resposta ? (
                <div className="ticket-response">
                  <strong>Resposta da TI</strong>
                  <p>{item.resposta}</p>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h3>Nenhum chamado fechado</h3>
            <p>Os chamados que você finalizar aparecerão aqui.</p>
          </div>
        )}
      </div>
    </ModalBase>
  );
}

export default ModalHistoricoChama;
