/* eslint-disable react/prop-types */
import '../../css/Chamados_css/ModalChamados_css/ModalChamaTi.css';
import { useState, useEffect } from 'react';
import apilista from '../../../services/ApiLista.js'; // ajuste o caminho se necessário
export default function ModalHistoricoUsuario({ isOpen, onClose }) {
     const [historico, setHistorico] = useState([]);
  const usuarioLogado = sessionStorage.getItem("usuario-logado");

useEffect(() => {
  if (isOpen && usuarioLogado) {
    let nomeUsuario = "";

    try {
      const usuarioObj = JSON.parse(usuarioLogado);
      nomeUsuario = usuarioObj.nome_usuario?.toLowerCase().trim();
    } catch (err) {
      console.error("Erro ao interpretar usuario-logado no histórico:", err);
    }

    apilista.get('/chamados')
      .then(res => {
        const fechadosDoUsuario = res.data.filter(item =>
          item.status?.toLowerCase().trim() === "fechado" &&
          item.solicitante?.toLowerCase().trim() === nomeUsuario
        );

        setHistorico(fechadosDoUsuario);
        console.log("Usuário logado:", nomeUsuario);
        console.log("Chamados recebidos:", res.data.map(i => ({ solicitante: i.solicitante, status: i.status })));
      })
      .catch(err => console.error("Erro ao buscar chamados:", err));
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [isOpen]);

  

  return (
    <div className={`sub-modalchamados ${isOpen ? "open" : ""}`} onClick={onClose}>
      <div className={`modal-real-chamados ${isOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className='titulo-fechamento-chamados'>
          <button onClick={onClose}><i className="bi bi-x"></i></button>
        </div>
        <h2 className='painel-titulo'>Meus Chamados Fechados</h2>
        <div className="conteudo-scroll-TI">
           {historico.length === 0 ? (
            <p>Nenhum chamado fechado encontrado.</p>
          ) : (
            historico.map(item => (
              <div className="cartao-solicitacao-ti" key={item.id}>
                <div className="info-principal">
                  <h3 className='assunto'>{item.assunto}</h3>
                  <div className="linha-info">
                    <p><strong>Solicitante: </strong> {item.solicitante}</p>
                    <p><strong>Local:</strong> {item.local}</p>
                    <p><strong>Prioridade:</strong> {item.prioridade}</p>
                  </div>
                  <p className="problema-detalhe"><strong>Problema:</strong> <span>{item.problema}</span></p>
                </div>
                <p className="resposta-detalhe"><strong>Resposta:</strong> <span>{item.resposta}</span></p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
