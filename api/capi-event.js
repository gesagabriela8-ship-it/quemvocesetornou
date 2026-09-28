// Meta Conversions API (CAPI) — envia eventos server-side para o Meta,
// espelhando o Pixel client-side (mesmo event_id para dedupe).
//
// Requer a variável de ambiente META_CAPI_TOKEN configurada no projeto na Vercel
// (Settings > Environment Variables). O valor é o token de acesso gerado em:
// Meta Events Manager > sua fonte de dados (Pixel) > Configurações > Conversions API.
//
// Nunca expõe o token ao cliente: ele só é lido aqui, no servidor.

const crypto = require('crypto');

const PIXEL_ID = '1078277001574200';
const GRAPH_API_VERSION = 'v21.0';

function sha256(value) {
    if (!value) return undefined;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return undefined;
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
          res.status(405).json({ error: 'method_not_allowed' });
          return;
    }

    const token = process.env.META_CAPI_TOKEN;
    if (!token) {
          // Ainda não configurado — não derruba o site, só não envia o evento.
      res.status(200).json({ skipped: true, reason: 'META_CAPI_TOKEN not set' });
          return;
    }

    let body = req.body;
    if (typeof body === 'string') {
          try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const {
          event_name,
          event_id,
          event_source_url,
          value,
          currency,
          content_name,
          user_data = {},
    } = body;

    if (!event_name || !event_id) {
          res.status(400).json({ error: 'missing_event_name_or_event_id' });
          return;
    }

    const forwardedFor = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const clientIp = forwardedFor || req.socket?.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'];

    const payload = {
          data: [
            {
                      event_name,
                      event_time: Math.floor(Date.now() / 1000),
                      event_id,
                      event_source_url,
                      action_source: 'website',
                      user_data: {
                                  em: sha256(user_data.email),
                                  fn: sha256(user_data.first_name),
                                  client_ip_address: clientIp,
                                  client_user_agent: userAgent,
                                  fbp: user_data.fbp || undefined,
                                  fbc: user_data.fbc || undefined,
                      },
                      custom_data: {
                                  currency: currency || 'BRL',
                                  value: typeof value === 'number' ? value : undefined,
                                  content_name: content_name || undefined,
                      },
            },
                ],
    };

    try {
          const resp = await fetch(
                  `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
            {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
            }
                );
          const data = await resp.json();
          res.status(resp.ok ? 200 : 502).json({ ok: resp.ok, meta: data });
    } catch (err) {
          res.status(502).json({ ok: false, error: String(err) });
    }
};
