// Instagram de verdade: "Instagram API with Instagram Login" (sem página do Facebook), spec 9.4.
// Conferido na documentação da Meta em 17/11/2026:
// developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
// Precisa dos segredos IG_APP_ID e IG_APP_SECRET (passo a passo em docs/INSTAGRAM.md).
// A publicação (publicar, limiteUso) entra no marco M6, junto com os imóveis.

const GRAPH = 'https://graph.instagram.com';
const ESCOPOS = 'instagram_business_basic,instagram_business_content_publish';

export const configurado = (env) => !!(env.IG_APP_ID && env.IG_APP_SECRET);

function exigirApp(env) {
  if (!configurado(env)) throw new Error('App da Meta não configurado (IG_APP_ID / IG_APP_SECRET)');
}

// Lê a resposta da Meta; erro vira exceção com a mensagem deles.
async function lerResposta(res, etapa) {
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.error || d.error_message) {
    throw new Error(`Instagram, ${etapa}: ${d.error?.message || d.error_message || 'HTTP ' + res.status}`);
  }
  return d;
}

export function conectarUrl(env, state, redirectUri) {
  exigirApp(env);
  const p = new URLSearchParams({
    client_id: env.IG_APP_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: ESCOPOS,
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${p}`;
}

export async function trocarCodigo(env, code, redirectUri) {
  exigirApp(env);
  // 1. código → token curto (vale 1 h)
  const r1 = await lerResposta(await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: env.IG_APP_ID,
      client_secret: env.IG_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  }), 'troca do código');
  const curto = r1.data?.[0] ?? r1;

  // 2. token curto → token longo (60 dias)
  const longo = await lerResposta(await fetch(`${GRAPH}/access_token?${new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: env.IG_APP_SECRET,
    access_token: curto.access_token,
  })}`), 'token de 60 dias');

  // 3. nome da conta (para mostrar no painel)
  const eu = await lerResposta(await fetch(`${GRAPH}/${env.IG_API_VERSION}/me?${new URLSearchParams({
    fields: 'user_id,username',
    access_token: longo.access_token,
  })}`), 'dados da conta');

  return {
    token: longo.access_token,
    userId: String(eu.user_id ?? curto.user_id),
    username: eu.username,
    expiraEm: new Date(Date.now() + Number(longo.expires_in) * 1000).toISOString(),
  };
}

// Só funciona com token de 24 h ou mais e ainda válido (quem chama confere).
export async function renovar(env, token) {
  const r = await lerResposta(await fetch(`${GRAPH}/refresh_access_token?${new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: token,
  })}`), 'renovação do token');
  return { token: r.access_token, expiraEm: new Date(Date.now() + Number(r.expires_in) * 1000).toISOString() };
}
