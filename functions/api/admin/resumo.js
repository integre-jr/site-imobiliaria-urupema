// GET /api/admin/resumo — alertas mostrados ao entrar no painel (spec 8.2, marco M8):
// leads novos (todos os papéis) e, para o administrador, Instagram, armazenamento, feed e
// pendências de entrega (e-mail de demonstração, anúncios fictícios).
// Cada alerta: { id, nivel: 'info'|'aviso'|'erro', texto, acao? } — acao = gaveta que resolve.
import { lerConfig } from '../../../lib/config.js';
import { um } from '../../../lib/db.js';
import { json } from '../../../lib/http.js';
import { carregarApp, lerConexao } from '../../../lib/instagram/index.js';
import { candidatos, FEED_GRUPO_OLX } from '../../../lib/portais.js';
import { avisosGerais } from '../../../lib/vrsync.js';

// Limites do plano grátis (spec, seção 3)
const LIMITE_KV = 1024 ** 3;            // ~1 GB de fotos no KV
const LIMITE_D1 = 500 * 1024 ** 2;      // 500 MB por banco
const DIA = 86400000;

const pct = (n, total) => Math.round((n / total) * 100);

export async function onRequestGet({ env, data }) {
  const alertas = [];
  const { n: novos } = await um(env.DB, "SELECT count(*) AS n FROM leads WHERE status = 'novo'");
  if (novos) alertas.push({ id: 'leads', nivel: 'info', acao: 'leads', texto: `${novos} ${novos === 1 ? 'lead novo' : 'leads novos'} esperando atendimento.` });

  const admin = data.usuario.papel === 'admin';
  let armazenamento = null;
  if (admin) {
    // Instagram
    const app = await carregarApp(env);
    const c = await lerConexao(env, app).catch(() => null);
    if (!c) {
      alertas.push({ id: 'ig', nivel: 'aviso', acao: 'instagram', texto: 'Instagram desconectado: os anúncios não podem ser postados.' });
    } else {
      const resta = Date.parse(c.expiraEm) - Date.now();
      if (resta <= 0) alertas.push({ id: 'ig', nivel: 'erro', acao: 'instagram', texto: 'A conexão com o Instagram expirou. Conecte de novo.' });
      else if (resta < 7 * DIA) alertas.push({ id: 'ig', nivel: 'aviso', acao: 'instagram', texto: `A conexão com o Instagram expira em ${Math.ceil(resta / DIA)} dia(s). Abra a gaveta Instagram para renovar.` });
    }

    // Armazenamento: fotos no KV (somadas no D1) e tamanho do próprio banco
    const fotos = await env.DB.prepare(
      'SELECT (SELECT coalesce(sum(bytes), 0) FROM fotos) + (SELECT coalesce(sum(bytes), 0) FROM lead_fotos) AS b',
    ).all();
    const bytesKv = fotos.results[0].b;
    const bytesD1 = fotos.meta?.size_after ?? 0;
    armazenamento = { fotos_bytes: bytesKv, fotos_pct: pct(bytesKv, LIMITE_KV), banco_bytes: bytesD1, banco_pct: pct(bytesD1, LIMITE_D1) };
    for (const [nome, p] of [['das fotos', armazenamento.fotos_pct], ['do banco de dados', armazenamento.banco_pct]]) {
      if (p >= 80) alertas.push({ id: 'armazenamento', nivel: p >= 95 ? 'erro' : 'aviso', texto: `O espaço ${nome} está ${p}% cheio (plano grátis). Exclua anúncios antigos ou fale com a INTEGRE.` });
    }

    // Feed dos portais: há anúncio pronto, mas o Canal Pro nunca leu
    const prontos = (await candidatos(env)).filter((x) => x.imovel.status === 'ativo' && !x.pendencias.length).length;
    const leitura = await um(env.DB, 'SELECT max(quando) AS q FROM feed_acessos WHERE feed = ?', FEED_GRUPO_OLX);
    if (prontos && !leitura.q) {
      alertas.push({ id: 'feed', nivel: 'aviso', acao: 'portais', texto: `${prontos} ${prontos === 1 ? 'anúncio pronto' : 'anúncios prontos'} para OLX/ZAP/Viva Real, mas o Canal Pro ainda não leu o feed. Cole o link da gaveta Portais no Canal Pro.` });
    } else if (leitura.q && Date.now() - Date.parse(leitura.q) > 3 * DIA) {
      alertas.push({ id: 'feed', nivel: 'aviso', acao: 'portais', texto: 'O Canal Pro não lê o feed há mais de 3 dias. Confira o link na gaveta Portais.' });
    }

    // Antes da entrega
    for (const texto of avisosGerais(await lerConfig(env))) alertas.push({ id: 'email', nivel: 'aviso', acao: 'dados', texto });
    const { n: demo } = await um(env.DB, "SELECT count(*) AS n FROM imoveis WHERE origem = 'seed' AND status IN ('ativo','reservado')");
    if (demo) alertas.push({ id: 'demo', nivel: 'aviso', acao: 'anuncios', texto: `${demo} ${demo === 1 ? 'anúncio de demonstração (fictício) ainda aparece' : 'anúncios de demonstração (fictícios) ainda aparecem'} no site.` });
  }
  return json({ alertas, leads_novos: novos, armazenamento });
}
