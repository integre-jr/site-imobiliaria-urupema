// POST /api/admin/instagram/publicar { imovel_id, legenda, midias: [uuid] } — 1ª etapa (spec 9.2):
// registra o post como "publicando" e cria o contêiner na Meta com as imagens de /fotos/ig/<uuid>.jpg.
// O navegador chama /concluir em seguida (e de novo enquanto a Meta processa).
// Repost = um post novo com o mesmo imóvel (a API não "republica" um post antigo).
import { carregarImovel } from '../../../../lib/anuncios.js';
import { agora, executar, um } from '../../../../lib/db.js';
import { erro, json, lerJson } from '../../../../lib/http.js';
import { criarPost, limiteUso } from '../../../../lib/instagram/index.js';
import { contarHashtags, MAX_HASHTAGS, MAX_LEGENDA } from '../../../../lib/instagram/legenda.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function onRequestPost({ request, env, data }) {
  const app = data.igApp;
  const c = data.instagram;
  if (!c || Date.parse(c.expiraEm) <= Date.now()) {
    return erro('O Instagram não está conectado. O administrador conecta a conta na gaveta Instagram.', 409);
  }
  const b = (await lerJson(request)) || {};
  const im = await carregarImovel(env, b.imovel_id);
  if (!im) return erro('Anúncio não encontrado.', 404);
  if (!['ativo', 'reservado'].includes(im.status)) return erro('Publique o anúncio no site antes de postar: o post leva as pessoas para a página dele.', 409);

  const legenda = String(b.legenda ?? '').replace(/\r/g, '').trim();
  if (!legenda) return erro('Escreva a legenda do post.', 400, 'legenda');
  if (legenda.length > MAX_LEGENDA) return erro(`A legenda pode ter até ${MAX_LEGENDA} caracteres.`, 400, 'legenda');
  if (contarHashtags(legenda) > MAX_HASHTAGS) return erro(`O Instagram aceita no máximo ${MAX_HASHTAGS} hashtags por post.`, 400, 'legenda');

  const midias = Array.isArray(b.midias) ? b.midias.map(String) : [];
  if (!midias.length || midias.length > 10 || !midias.every((m) => UUID.test(m)) || new Set(midias).size !== midias.length) {
    return erro('Escolha de 1 a 10 fotos para o post.');
  }

  try {
    const { usados, limite } = await limiteUso(env, app, c);
    if (usados >= limite) return erro(`O Instagram permite ${limite} posts por dia pela integração, e esse limite foi atingido. Tente de novo amanhã.`, 429);
  } catch (e) {
    console.error(e);   // sem a consulta do limite, tenta publicar assim mesmo: a Meta recusa se passar
  }

  const anterior = await um(env.DB, "SELECT id FROM instagram_posts WHERE imovel_id = ? AND status = 'publicado' LIMIT 1", im.id);
  const r = await executar(env.DB,
    `INSERT INTO instagram_posts (imovel_id, tipo, status, legenda, modo, criado_por, criado_em)
     VALUES (?, ?, 'publicando', ?, ?, ?, ?)`, im.id, anterior ? 'repost' : 'novo', legenda, app.modo, data.usuario.id, agora());
  const postId = r.meta.last_row_id;

  const origem = new URL(request.url).origin;
  try {
    const { container } = await criarPost(env, app, c, { urls: midias.map((id) => `${origem}/fotos/ig/${id}.jpg`), midias, legenda });
    await executar(env.DB, 'UPDATE instagram_posts SET ig_container_id = ? WHERE id = ?', container, postId);
    return json({ post_id: postId, status: 'publicando' }, 201);
  } catch (e) {
    console.error(e);
    await executar(env.DB, "UPDATE instagram_posts SET status = 'erro', erro = ? WHERE id = ?", String(e.message).slice(0, 500), postId);
    return erro(String(e.message), 502);
  }
}
