// Instagram de verdade: "Instagram API with Instagram Login" (sem página do Facebook), spec 9.4.
// Conexão conferida na documentação da Meta em 17/11/2026; publicação em 18/11/2026:
// developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
// developers.facebook.com/docs/instagram-platform/content-publishing
// O app (ID e chave secreta) vem do painel ou dos segredos do servidor (lib/instagram/index.js).

const GRAPH = 'https://graph.instagram.com';
const ESCOPOS = 'instagram_business_basic,instagram_business_content_publish';

function exigirApp(app) {
  if (!app.appId || !app.appSecret) throw new Error('App da Meta não configurado (ID e chave secreta do app)');
}

// Lê a resposta da Meta; erro vira exceção com a mensagem deles.
async function lerResposta(res, etapa) {
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.error || d.error_message) {
    const msg = d.error?.error_user_msg || d.error?.message || d.error_message || 'HTTP ' + res.status;
    throw new Error(`Instagram, ${etapa}: ${msg}`);
  }
  return d;
}

const get = async (caminho, params, etapa) =>
  lerResposta(await fetch(`${GRAPH}/${caminho}?${new URLSearchParams(params)}`), etapa);

const post = async (caminho, params, etapa) =>
  lerResposta(await fetch(`${GRAPH}/${caminho}`, { method: 'POST', body: new URLSearchParams(params) }), etapa);

export function conectarUrl(app, state, redirectUri) {
  exigirApp(app);
  const p = new URLSearchParams({
    client_id: app.appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: ESCOPOS,
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${p}`;
}

export async function trocarCodigo(app, code, redirectUri) {
  exigirApp(app);
  // 1. código → token curto (vale 1 h)
  const r1 = await lerResposta(await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: app.appId,
      client_secret: app.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code: code.replace(/#_$/, ''),
    }),
  }), 'troca do código');
  const curto = r1.data?.[0] ?? r1;

  // 2. token curto → token longo (60 dias)
  const longo = await get('access_token', {
    grant_type: 'ig_exchange_token',
    client_secret: app.appSecret,
    access_token: curto.access_token,
  }, 'token de 60 dias');

  // 3. nome da conta (para mostrar no painel)
  const eu = await get(`${app.versao}/me`, { fields: 'user_id,username', access_token: longo.access_token }, 'dados da conta');

  return {
    token: longo.access_token,
    userId: String(eu.user_id ?? curto.user_id),
    username: eu.username,
    expiraEm: new Date(Date.now() + Number(longo.expires_in) * 1000).toISOString(),
  };
}

// Só funciona com token de 24 h ou mais e ainda válido (quem chama confere).
export async function renovar(app, token) {
  const r = await get('refresh_access_token', { grant_type: 'ig_refresh_token', access_token: token }, 'renovação do token');
  return { token: r.access_token, expiraEm: new Date(Date.now() + Number(r.expires_in) * 1000).toISOString() };
}

// 1 imagem → contêiner simples; 2 a 10 → um contêiner por imagem + o carrossel.
// A Meta baixa as imagens pelas URLs nesta etapa, por isso elas precisam ser públicas (HTTPS).
export async function criarPost(env, app, c, { urls, legenda }) {
  const base = `${app.versao}/${c.userId}/media`;
  if (urls.length === 1) {
    const r = await post(base, { image_url: urls[0], caption: legenda, access_token: c.token }, 'criação do post');
    return { container: r.id };
  }
  const filhos = [];
  for (const [i, url] of urls.entries()) {
    const r = await post(base, { image_url: url, is_carousel_item: 'true', access_token: c.token }, `foto ${i + 1} do carrossel`);
    filhos.push(r.id);
  }
  const r = await post(base, { media_type: 'CAROUSEL', children: filhos.join(','), caption: legenda, access_token: c.token }, 'criação do carrossel');
  return { container: r.id };
}

// Consulta o contêiner uma vez; se estiver pronto, publica. O navegador chama de novo enquanto não estiver.
export async function concluirPost(env, app, c, container) {
  const st = await get(`${app.versao}/${container}`, { fields: 'status_code', access_token: c.token }, 'situação do post');
  if (st.status_code === 'IN_PROGRESS') return { pronto: false };
  if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') {
    throw new Error(st.status_code === 'EXPIRED'
      ? 'O Instagram descartou o post porque ele demorou demais para ser publicado. Tente de novo.'
      : 'O Instagram não aceitou as imagens do post. Tente de novo; se continuar, escolha outras fotos.');
  }
  // FINISHED (ou PUBLISHED, se uma tentativa anterior publicou e a resposta se perdeu)
  let mediaId = container;
  if (st.status_code !== 'PUBLISHED') {
    const pub = await post(`${app.versao}/${c.userId}/media_publish`, { creation_id: container, access_token: c.token }, 'publicação');
    mediaId = pub.id;
  }
  let permalink = null;
  try {
    permalink = (await get(`${app.versao}/${mediaId}`, { fields: 'permalink', access_token: c.token }, 'link do post')).permalink;
  } catch (e) {
    console.error(e);   // o post já saiu; sem o link, o histórico mostra só "publicado"
  }
  return { pronto: true, mediaId, permalink };
}

// Limite da Meta: posts publicados pela API nas últimas 24 h (o carrossel conta 1).
export async function limiteUso(env, app, c) {
  const r = await get(`${app.versao}/${c.userId}/content_publishing_limit`, { fields: 'quota_usage,config', access_token: c.token }, 'limite de posts');
  const d = r.data?.[0] || {};
  return { usados: Number(d.quota_usage) || 0, limite: Number(d.config?.quota_total) || 100 };
}
