// Situação da conexão com o Instagram. Todos os papéis veem; só o admin conecta, desconecta e
// configura o app da Meta (por isso só ele recebe o endereço de retorno e o ID do app).
import { json } from '../../../../lib/http.js';
import { appConfigurado, limiteUso, redirectUri } from '../../../../lib/instagram/index.js';

export async function onRequestGet({ request, env, data }) {
  const app = data.igApp;
  const c = data.instagram;
  const expirado = !!c && Date.parse(c.expiraEm) <= Date.now();
  const admin = data.usuario.papel === 'admin';
  let limite = null;
  if (c && !expirado) {
    try {
      limite = await limiteUso(env, app, c);
    } catch (e) {
      console.error(e);
    }
  }
  return json({
    modo: app.modo,
    app_configurado: appConfigurado(app),
    app_origem: app.origem,
    app_id: admin && app.modo === 'real' ? app.appId || null : null,
    redirect_uri: admin ? redirectUri(new URL(request.url).origin) : null,
    conectado: !!c && !expirado,
    expirado,
    conta: c?.conta ?? null,
    expira_em: c?.expiraEm ?? null,
    limite,
    pode_gerenciar: admin,
  });
}
