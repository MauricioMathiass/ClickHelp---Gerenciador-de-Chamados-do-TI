const emailConfig = {
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID ?? "",
  templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? "",
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY ?? "",
  toEmail: import.meta.env.VITE_NOTIFICATION_EMAIL_TO ?? "",
};

const isEmailConfigured = () =>
  Boolean(emailConfig.serviceId && emailConfig.templateId && emailConfig.publicKey && emailConfig.toEmail);

export const notifyNewTicketByEmail = async ({
  assunto,
  solicitante,
  local,
  prioridade,
  problema,
  chamadoId,
  createdAt,
}) => {
  if (!isEmailConfigured()) {
    return {
      delivered: false,
      skipped: true,
      reason: "email-config-missing",
    };
  }

  const { default: emailjs } = await import("@emailjs/browser");

  await emailjs.send(
    emailConfig.serviceId,
    emailConfig.templateId,
    {
      to_email: emailConfig.toEmail,
      chamado_id: String(chamadoId ?? ""),
      assunto,
      solicitante,
      local,
      prioridade,
      problema,
      data_abertura: createdAt ?? new Date().toISOString(),
    },
    {
      publicKey: emailConfig.publicKey,
    }
  );

  return {
    delivered: true,
    skipped: false,
  };
};
