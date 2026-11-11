import Modal from "../../shared/components/Modal";
import { formatDateTime as formatDate, formatPrioridade, statusClassName } from "../../shared/utils/format";
import "./tickets.css";

function MyTicketsModal({ isOpen, onClose, solicitacoes }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Minhas solicitações" size="wide">
      <div className="tickets-stack">
        {solicitacoes.length ? (
          solicitacoes.map((item) => (
            <article key={item.id} className="ticket-card">
              <div className="ticket-card-top">
                <div>
                  <h3>{item.assunto}</h3>
                  <p>{item.problema}</p>
                </div>
                <span className={`ticket-status ${statusClassName(item.status)}`}>{item.status}</span>
              </div>

              <div className="ticket-meta">
                <span>Solicitante: {item.solicitante}</span>
                <span>Local: {item.local}</span>
                {item.categoria ? <span>Categoria: {item.categoria}</span> : null}
                <span>Prioridade: {formatPrioridade(item.prioridade)}</span>
                <span>Abertura: {formatDate(item.dataCriacao)}</span>
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
            <h3>Nenhuma solicitação cadastrada</h3>
            <p>Assim que você abrir um chamado, ele aparecerá aqui.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default MyTicketsModal;
