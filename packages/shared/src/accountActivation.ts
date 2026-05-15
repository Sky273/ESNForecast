export type AccountActivationEmailInput = {
  appName: string;
  baseUrl: string;
  token: string;
  userName: string;
};

export type AccountActivationEmail = {
  subject: string;
  text: string;
  html: string;
  activationUrl: string;
};

export function buildAccountActivationEmail(input: AccountActivationEmailInput): AccountActivationEmail {
  const baseUrl = input.baseUrl.replace(/\/$/, "");
  const activationUrl = `${baseUrl}/#/first-login?token=${encodeURIComponent(input.token)}`;
  const subject = `${input.appName} - activation de votre compte`;
  const text = [
    `Bonjour ${input.userName},`,
    "",
    `Un compte ${input.appName} a ete cree pour vous.`,
    "Definissez votre mot de passe avec le lien suivant :",
    activationUrl,
    "",
    "Si vous n'etes pas a l'origine de cette demande, ignorez ce message."
  ].join("\n");
  const html = [
    `<p>Bonjour ${escapeHtml(input.userName)},</p>`,
    `<p>Un compte <strong>${escapeHtml(input.appName)}</strong> a ete cree pour vous.</p>`,
    `<p><a href="${activationUrl}">Definir mon mot de passe</a></p>`,
    `<p style="color:#64748b;font-size:13px">Si vous n'etes pas a l'origine de cette demande, ignorez ce message.</p>`
  ].join("");

  return { subject, text, html, activationUrl };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
