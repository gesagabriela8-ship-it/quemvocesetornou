// Funções compartilhadas para montar e enviar o e-mail com o entregável
// personalizado de "Quem Você Se Tornou?" (usadas por hotmart-webhook.js
// e send-deliverable.js).

const SITE_BASE_URL = process.env.SITE_BASE_URL || 'https://quemvocesetornou.vercel.app';

// Mesma URL do Apps Script já usada no site (função saveToSheets no index.html)
// para registrar cada pessoa que termina o quiz. Reaproveitada aqui só para
// leitura (?action=lookup), sem mexer na parte que já grava os dados.
const SHEETS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxeomSlOGYsaQBSUI99czweYoNCAsCDYJ-V2Ju5gTvb12IBY3JYX9_PSvvRgyi3OTbm/exec';

const PROFILES = {
  ansioso: { file: 'resultado-ansioso.html', label: 'Apego Ansioso' },
  evitativo: { file: 'resultado-evitativo.html', label: 'Apego Evitativo' },
  seguro: { file: 'resultado-seguro.html', label: 'Apego Seguro' },
  dependente: { file: 'resultado-dependente.html', label: 'Dependência Emocional' },
  hiperindependente: { file: 'resultado-hiperindependente.html', label: 'Hiperindependência Emocional' },
};

function firstName(nome) {
  return String(nome || '').trim().split(' ')[0] || 'Olá';
}

function profileLink(perfilKey, nome) {
  const p = PROFILES[perfilKey];
  if (!p) return null;
  const url = new URL(p.file, SITE_BASE_URL);
  if (nome) url.searchParams.set('nome', nome);
  return url.toString();
}

// Busca o perfil mais recente registrado para esse e-mail na planilha
// (via a Apps Script já existente, ação nova "lookup" — ver instruções
// de instalação enviadas à Gesa).
async function lookupProfileByEmail(email) {
  if (!email) return null;
  try {
    const url = SHEETS_SCRIPT_URL + '?' + new URLSearchParams({ action: 'lookup', email }).toString();
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data && data.found) return data; // { nome, email, perfil, ... }
    return null;
  } catch (e) {
    return null;
  }
}

function buildEmailHtml({ nome, perfilKey }) {
  const p = PROFILES[perfilKey];
  const nomeCurto = firstName(nome);
  const link = profileLink(perfilKey, nome);
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f1ec;font-family:Georgia, 'Times New Roman', serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1ec;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background-color:#ffffff;border-radius:6px;overflow:hidden;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background-color:#1c1c1c;padding:28px 32px;text-align:center;">
              <p style="margin:0;color:#e9c46a;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-family:Arial, sans-serif;">Quem Você Se Tornou</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 36px 24px;">
              <p style="margin:0 0 18px;font-size:22px;line-height:1.4;color:#1c1c1c;">${nomeCurto}, seu perfil emocional completo está pronto.</p>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#3d3d3d;font-family:Arial, sans-serif;">Obrigada por confiar nesse processo de autoconhecimento. Preparei uma análise completa sobre o seu resultado (${p ? p.label : ''}), explicando de onde ele vem, como aparece no seu dia a dia e qual o caminho possível a partir daqui.</p>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#3d3d3d;font-family:Arial, sans-serif;">É só clicar no botão abaixo para acessar.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                <tr>
                  <td style="border-radius:4px;background-color:#1c1c1c;">
                    <a href="${link}" style="display:inline-block;padding:16px 36px;color:#e9c46a;text-decoration:none;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial, sans-serif;">Ver meu resultado completo</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#1c1c1c;font-style:italic;">Dra. Aline Zanette</p>
              <p style="margin:0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#8a8a8a;font-family:Arial, sans-serif;">Médica · Saúde Mental · CRM 36587</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 36px 32px;border-top:1px solid #eee;">
              <p style="margin:0;font-size:11px;line-height:1.6;color:#9a9a9a;font-family:Arial, sans-serif;">Ferramenta de autoconhecimento. Não é diagnóstico médico ou psicológico e não substitui avaliação individual realizada por profissional habilitado. Se o botão não funcionar, copie e cole este link no navegador: ${link}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: 'RESEND_API_KEY not set' };
  }
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Dra. Aline Zanette <${from}>`,
      to: [to],
      subject,
      html,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

async function sendDeliverableEmail({ email, nome, perfilKey }) {
  if (!email || !PROFILES[perfilKey]) {
    return { ok: false, error: 'missing_email_or_invalid_perfil' };
  }
  const html = buildEmailHtml({ nome, perfilKey });
  const nomeCurto = firstName(nome);
  return sendEmail({
    to: email,
    subject: `${nomeCurto}, seu Perfil Emocional completo chegou`,
    html,
  });
}

async function notifyAdminNoMatch({ email, name, raw }) {
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
  if (!adminEmail) return { skipped: true };
  const html = `<p>Uma compra foi confirmada na Hotmart mas não encontrei o perfil dessa pessoa na planilha (e-mail pode ter sido digitado diferente no quiz e no checkout).</p>
  <p><b>E-mail do comprador:</b> ${email || '(não veio no payload)'}<br/>
  <b>Nome do comprador:</b> ${name || '(não veio no payload)'}</p>
  <p>Payload recebido: <pre>${JSON.stringify(raw, null, 2).slice(0, 3000)}</pre></p>`;
  return sendEmail({ to: adminEmail, subject: 'Compra sem perfil encontrado — Quem Você Se Tornou', html });
}

module.exports = {
  PROFILES,
  profileLink,
  lookupProfileByEmail,
  buildEmailHtml,
  sendEmail,
  sendDeliverableEmail,
  notifyAdminNoMatch,
  firstName,
};
