// Recebe a notificação de compra aprovada da Hotmart (Ferramentas > Webhook,
// no painel do produto) e dispara o e-mail com o entregável personalizado.
//
// Configuração necessária no painel da Hotmart (só a Gesa pode fazer):
//   Ferramentas > Webhook > adicionar
//   URL: https://quemvocesetornou.vercel.app/api/hotmart-webhook
//   Evento: Compra Aprovada (ou "Compra Completa" — escolher só UM, para não
//   disparar o e-mail duas vezes pela mesma compra)
//   Hottok: gerar um token ali e colar na Vercel como HOTMART_HOTTOK
//
// Variáveis de ambiente (Vercel > Settings > Environment Variables):
//   HOTMART_HOTTOK       — token de validação gerado no painel da Hotmart
//   RESEND_API_KEY        — chave de API do Resend
//   RESEND_FROM_EMAIL     — endereço verificado no Resend (ex: resultado@alinezanette.com)
//   ADMIN_NOTIFY_EMAIL    — (opcional) e-mail da Gesa, para avisos quando não
//                           for possível encontrar o perfil de um comprador

const { lookupProfileByEmail, sendDeliverableEmail, notifyAdminNoMatch, firstName } = require('./_lib/deliverable');

function extractBuyer(body) {
  const data = body.data || {};
  const buyer = data.buyer || body.buyer || {};
  const email = buyer.email || data.email || body.email;
  const name = buyer.name || data.name || body.name;
  return { email, name };
}

function extractStatus(body) {
  const event = (body.event || '').toString().toUpperCase();
  const status = (body.data?.purchase?.status || body.status || '').toString().toUpperCase();
  return event + ' ' + status;
}

function extractHottok(body, req) {
  return (
    body.hottok ||
    body.data?.hottok ||
    req.headers['x-hotmart-hottok'] ||
    (req.query && req.query.hottok) ||
    ''
  );
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  // Validação do Hottok (só é aplicada depois que HOTMART_HOTTOK for configurado
  // na Vercel — antes disso, segue sem validar, para dar pra testar a integração).
  const expectedHottok = process.env.HOTMART_HOTTOK;
  if (expectedHottok) {
    const receivedHottok = extractHottok(body, req);
    if (receivedHottok !== expectedHottok) {
      res.status(401).json({ error: 'invalid_hottok' });
      return;
    }
  }

  const statusText = extractStatus(body);
  const looksApproved =
    !statusText.trim() || // se não veio status nenhum, segue (webhook configurado só pra esse evento)
    statusText.includes('APPROV') ||
    statusText.includes('COMPLET');

  if (!looksApproved) {
    res.status(200).json({ skipped: true, reason: 'evento não é de compra aprovada', statusText });
    return;
  }

  const { email, name: hotmartName } = extractBuyer(body);
  if (!email) {
    res.status(200).json({ skipped: true, reason: 'sem e-mail do comprador no payload' });
    return;
  }

  const match = await lookupProfileByEmail(email);

  if (!match || !match.perfil) {
    await notifyAdminNoMatch({ email, name: hotmartName, raw: body });
    res.status(200).json({ ok: false, reason: 'perfil não encontrado para esse e-mail', email });
    return;
  }

  const nome = match.nome || hotmartName || firstName(email);
  const result = await sendDeliverableEmail({ email, nome, perfilKey: match.perfil });

  res.status(200).json({ ok: true, sent: result, email, perfil: match.perfil });
};
