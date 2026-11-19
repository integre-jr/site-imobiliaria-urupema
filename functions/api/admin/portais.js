// Gaveta "Portais" (só admin, spec 8.2/10): endereço do feed, o que vai e o que falta em cada anúncio,
// e as últimas leituras do Canal Pro. POST { acao: 'novo_endereco' } troca o trecho secreto da URL
// (o endereço antigo para de funcionar e precisa ser trocado no Canal Pro).
import { soAdmin } from '../../../lib/auth.js';
import { lerConfig } from '../../../lib/config.js';
import { todos } from '../../../lib/db.js';
import { erro, json, lerJson } from '../../../lib/http.js';
import { candidatos, FEED_GRUPO_OLX, novoToken, tokenFeed, urlFeed } from '../../../lib/portais.js';
import { avisosGerais, MIN_FOTOS } from '../../../lib/vrsync.js';

export async function onRequestGet({ request, env, data }) {
  const negado = soAdmin(data.usuario);
  if (negado) return negado;
  const origem = new URL(request.url).origin;
  const lista = await candidatos(env, { incluirInativos: true });
  const acessos = await todos(env.DB, 'SELECT user_agent, itens, quando FROM feed_acessos WHERE feed = ? ORDER BY quando DESC LIMIT 5', FEED_GRUPO_OLX);
  const demo = await todos(env.DB, "SELECT count(*) AS n FROM imoveis WHERE origem = 'seed' AND status != 'arquivado'");
  return json({
    url: urlFeed(origem, await tokenFeed(env)),
    no_feed: lista.filter((c) => c.imovel.status === 'ativo' && !c.pendencias.length).length,
    min_fotos: MIN_FOTOS,
    avisos: avisosGerais(await lerConfig(env)),
    demonstracao: demo[0].n,
    imoveis: lista.map(({ imovel: i, fotos, pendencias }) => ({
      id: i.id, ref: i.ref, titulo: i.titulo, status: i.status, n_fotos: fotos.length, pendencias,
      no_feed: i.status === 'ativo' && !pendencias.length,
    })),
    acessos,
  });
}

export async function onRequestPost({ request, env, data }) {
  const negado = soAdmin(data.usuario);
  if (negado) return negado;
  const b = (await lerJson(request)) || {};
  if (b.acao !== 'novo_endereco') return erro('Ação desconhecida.');
  const token = await novoToken(env);
  return json({ url: urlFeed(new URL(request.url).origin, token) });
}
