// Envio opcional de e-mail a cada novo chamado, via EmailJS (configurado no .env do frontend).
const emailConfig = {
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID ?? "",
  templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? "",
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY ?? "",
  toEmail: import.meta.env.VITE_NOTIFICATION_EMAIL_TO ?? "",
};

const isEmailConfigured = () =>
  Boolean(emailConfig.serviceId && emailConfig.templateId && emailConfig.publicKey && emailConfig.toEmail);

/** Envia o aviso do chamado criado. Sem configuração, não faz nada. */
export const notifyNewTicketByEmail = async (chamado) => {
  if (!isEmailConfigured() || !chamado) {
    return { delivered: false, skipped: true };
  }

  const { default: emailjs } = await import("@emailjs/browser");

  await emailjs.send(
    emailConfig.serviceId,
    emailConfig.templateId,
    {
      to_email: emailConfig.toEmail,
      chamado_id: String(chamado.id ?? ""),
      assunto: chamado.assunto,
      solicitante: chamado.solicitante,
      local: chamado.local,
      categoria: chamado.categoria ?? "",
      prioridade: chamado.prioridade,
      problema: chamado.problema,
      data_abertura: chamado.dataCriacao ?? new Date().toISOString(),
    },
    { publicKey: emailConfig.publicKey }
  );

  return { delivered: true, skipped: false };
};
