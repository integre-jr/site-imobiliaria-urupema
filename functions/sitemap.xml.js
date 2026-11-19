// GET /sitemap.xml — páginas fixas + a página de cada imóvel público (spec 7.6).
// Usa o domínio da requisição: vale igual em urupema-imoveis.pages.dev e no domínio final.
import { todos } from '../lib/db.js';
import { escapeXml } from '../lib/html.js';
import { SQL_PUBLICO } from '../lib/imoveis.js';

const FIXAS = [['/', '1.0'], ['/imoveis', '0.9'], ['/sobre', '0.5'], ['/financie', '0.6'], ['/negocie', '0.6'], ['/contato', '0.6'], ['/privacidade', '0.2']];

export async function onRequestGet({ request, env }) {
  const origem = new URL(request.url).origin;
  const imoveis = await todos(env.DB, `SELECT ref, atualizado_em FROM imoveis i WHERE ${SQL_PUBLICO} ORDER BY atualizado_em DESC`);
  const url = (loc, extra) => `  <url><loc>${escapeXml(origem + loc)}</loc>${extra}</url>`;
  const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...FIXAS.map(([loc, p]) => url(loc, `<priority>${p}</priority>`)),
    ...imoveis.map((i) => url(`/imovel/${i.ref}`, `<lastmod>${escapeXml(i.atualizado_em.slice(0, 10))}</lastmod><priority>0.8</priority>`)),
    '</urlset>', ''].join('\n');
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
