import { FaCircleInfo } from "react-icons/fa6";

/** Texto curto mostrado quando alguém tenta salvar algo na demonstração. */
export const DEMO_BLOCKED_MESSAGE =
  "Na demonstração, esta alteração não é salva, para o sistema continuar igual para quem vem depois.";

/**
 * Aviso informativo no topo das telas de administração da demonstração:
 * diz antes do clique o que dá e o que não dá para fazer. Não é um erro.
 */
function DemoNotice({ children }) {
  return (
    <div className="demo-notice" role="note">
      <FaCircleInfo className="demo-notice-icon" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

export default DemoNotice;
