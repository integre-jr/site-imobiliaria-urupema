// POST /api/leads — formulários do site (spec 7.5): contato, negocie (com fotos), financie e
// "tenho interesse" da página do imóvel. Público, mas com proteções contra robôs:
// header X-Urupema (formulário de outro site não consegue mandar), honeypot "website",
// tempo mínimo na página ("t" = milissegundos desde que a página abriu) e 10 envios por IP por hora.
import { agora, um } from '../../lib/db.js';
import { erro, ipDe, json, lerJson } from '../../lib/http.js';
import { lerConfig } from '../../lib/config.js';
import { MAX_BYTES_FOTO_LEAD, MAX_FOTOS_LEAD, MAX_LEADS_POR_HORA, ORIGENS, TEMPO_MINIMO_MS, validarLead } from '../../lib/leads.js';

const ehJpeg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

async function lerCorpo(request) {
  const tipo = request.headers.get('Content-Type') || '';
  if (!tipo.includes('multipart/form-data')) return { corpo: (await lerJson(request)) || {}, fotos: [] };
  const form = await request.formData();
  const corpo = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') corpo[k] = v;
  return { corpo, fotos: form.getAll('fotos').filter((f) => typeof f !== 'string') };
}

// Aviso ao dono. O envio real (Email Routing) só existe depois que o domínio estiver na Cloudflare (M10).
async function avisar(env, lead, id) {
  const cfg = await lerConfig(env).catch(() => ({}));
  const destino = cfg['leads.email_aviso'];
  if (!destino) return;
  console.log(`[lead ${id}] aviso para ${destino} (EMAIL_MODO=${env.EMAIL_MODO || 'mock'}): ${ORIGENS[lead.origem]} de ${lead.nome}`);
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (request.headers.get('X-Urupema') !== '1') return erro('Requisição inválida.', 403);
  const { corpo, fotos } = await lerCorpo(request);

  // Robô: preencheu o campo escondido. Responde "ok" para ele não tentar de novo, mas não grava.
  if (typeof corpo.website === 'string' && corpo.website.trim()) return json({ ok: true });
  const t = Number(corpo.t);
  if (!Number.isFinite(t) || t < TEMPO_MINIMO_MS) return erro('Aguarde alguns segundos e envie de novo.', 400);

  const { lead, erro: msg, campo } = validarLead(corpo);
  if (msg) return erro(msg, 400, campo);

  if (fotos.length && lead.origem !== 'negocie') return erro('Este formulário não aceita fotos.', 400);
  if (fotos.length > MAX_FOTOS_LEAD) return erro(`Envie no máximo ${MAX_FOTOS_LEAD} fotos.`, 400, 'fotos');
  const binarios = [];
  for (const f of fotos) {
    const b = new Uint8Array(await f.arrayBuffer());
    if (b.length > MAX_BYTES_FOTO_LEAD || !ehJpeg(b)) return erro('Fotos em JPG de até 2 MB cada.', 400, 'fotos');
    binarios.push(b);
  }

  const ip = ipDe(request);
  const umaHora = new Date(Date.now() - 3600000).toISOString();
  const { n } = await um(env.DB, 'SELECT count(*) AS n FROM leads WHERE ip = ? AND criado_em > ?', ip, umaHora);
  if (n >= MAX_LEADS_POR_HORA) return erro('Muitos envios seguidos. Tente de novo mais tarde ou chame no WhatsApp.', 429);

  const quando = agora();
  const r = await env.DB.prepare(
    `INSERT INTO leads (origem, nome, email, telefone, imovel_ref, dados, consentimento_em, status, ip, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'novo', ?, ?, ?)`,
  ).bind(lead.origem, lead.nome, lead.email, lead.telefone, lead.imovel_ref, JSON.stringify(lead.dados), quando, ip, quando, quando).run();
  const id = r.meta.last_row_id;

  if (binarios.length) {
    const linhas = [];
    for (const [i, b] of binarios.entries()) {
      const chave = `lead/${id}/${i + 1}.jpg`;
      await env.FOTOS.put(chave, b);
      linhas.push(env.DB.prepare('INSERT INTO lead_fotos (lead_id, kv_chave, bytes) VALUES (?, ?, ?)').bind(id, chave, b.length));
    }
    await env.DB.batch(linhas);
  }

  waitUntil(avisar(env, lead, id));
  return json({ ok: true }, 201);
}
