// App da Meta usado na conta real (só admin): PUT { app_id, app_secret } liga o modo real;
// DELETE volta ao modo demonstração. As duas ações derrubam a conexão atual (ela é de outro app).
// A chave secreta é guardada criptografada (TOKEN_KEY) e nunca volta para o navegador.
import { soAdmin } from '../../../../lib/auth.js';
import { erro, json, lerJson } from '../../../../lib/http.js';
import { apagarApp, salvarApp } from '../../../../lib/instagram/index.js';

export async function onRequestPut({ request, env, data }) {
  const negado = soAdmin(data.usuario);
  if (negado) return negado;
  const b = (await lerJson(request)) || {};
  const appId = String(b.app_id ?? '').trim();
  const appSecret = String(b.app_secret ?? '').trim();
  if (!/^\d{6,25}$/.test(appId)) return erro('O ID do app do Instagram tem só números (copie de "Instagram app ID" no painel da Meta).', 400, 'app_id');
  if (!/^[0-9a-f]{32}$/i.test(appSecret)) return erro('A chave secreta tem 32 letras e números (copie de "Instagram app secret", botão "Mostrar").', 400, 'app_secret');
  await salvarApp(env, { appId, appSecret });
  return json({ ok: true });
}

export async function onRequestDelete({ env, data }) {
  const negado = soAdmin(data.usuario);
  if (negado) return negado;
  await apagarApp(env);
  return json({ ok: true });
}
