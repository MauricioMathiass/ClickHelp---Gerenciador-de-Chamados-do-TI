// Aviso por e-mail de novos chamados, via API REST do EmailJS.
// Roda no backend para que as chaves e o destinatário nunca cheguem ao
// navegador (antes qualquer pessoa podia copiá-las do site e mandar e-mails
// em nome da empresa). Sem as variáveis EMAILJS_*, não envia nada.

const EMAILJS_URL = "https://api.emailjs.com/api/v1.0/email/send";
const TIMEOUT_MS = 10000;

// Lido a cada envio (e não na carga do módulo) para valer o que estiver no ambiente.
const readConfig = () => ({
  url: process.env.EMAILJS_API_URL?.trim() || EMAILJS_URL,
  serviceId: process.env.EMAILJS_SERVICE_ID?.trim() ?? "",
  templateId: process.env.EMAILJS_TEMPLATE_ID?.trim() ?? "",
  publicKey: process.env.EMAILJS_PUBLIC_KEY?.trim() ?? "",
  privateKey: process.env.EMAILJS_PRIVATE_KEY?.trim() ?? "",
  toEmail: process.env.NOTIFICATION_EMAIL_TO?.trim() ?? "",
});

/** Envia o aviso do chamado criado. Devolve false se o e-mail não estiver configurado. */
export const sendNewTicketEmail = async (chamado) => {
  const config = readConfig();

  if (!config.serviceId || !config.templateId || !config.publicKey || !config.privateKey || !config.toEmail) {
    return false;
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: config.serviceId,
      template_id: config.templateId,
      user_id: config.publicKey,
      accessToken: config.privateKey,
      template_params: {
        to_email: config.toEmail,
        chamado_id: chamado.id,
        assunto: chamado.assunto,
        solicitante: chamado.solicitante,
        local: chamado.local,
        categoria: chamado.categoria ?? "",
        prioridade: chamado.prioridade,
        problema: chamado.problema,
        data_abertura: chamado.dataCriacao,
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`EmailJS respondeu ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }

  return true;
};
