// Endpoint manual, para a Gesa reenviar o entregável pra alguém "na mão"
// (ex: cliente avisou que não recebeu, ou compra feita antes de tudo isso
// estar configurado).
//
// Uso: POST /api/send-deliverable
// Body JSON: { "email": "...", "nome": "...", "perfil": "ansioso", "key": "..." }
// "perfil" precisa ser um destes: ansioso, evitativo, seguro, dependente, hiperindependente
// "key" precisa bater com a variável de ambiente ADMIN_KEY na Vercel (proteção
// simples pra ninguém mais disparar e-mails por essa URL).

const { sendDeliverableEmail, PROFILES } = require('./_lib/deliverable');

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

  const adminKey = process.env.ADMIN_KEY;
  if (adminKey && body.key !== adminKey) {
    res.status(401).json({ error: 'invalid_key' });
    return;
  }

  const { email, nome, perfil } = body;
  if (!email || !perfil || !PROFILES[perfil]) {
    res.status(400).json({ error: 'missing_or_invalid_fields', validPerfis: Object.keys(PROFILES) });
    return;
  }

  const result = await sendDeliverableEmail({ email, nome, perfilKey: perfil });
  res.status(200).json({ ok: true, sent: result });
};
