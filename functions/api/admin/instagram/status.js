// Situação da conexão com o Instagram. Todos os papéis veem; só o admin conecta e desconecta.
import { json } from '../../../../lib/http.js';
import { appConfigurado, modo } from '../../../../lib/instagram/index.js';

export function onRequestGet({ env, data }) {
  const c = data.instagram;
  const expirado = !!c && Date.parse(c.expiraEm) <= Date.now();
  return json({
    modo: modo(env),
    app_configurado: appConfigurado(env),
    conectado: !!c && !expirado,
    expirado,
    conta: c?.conta ?? null,
    expira_em: c?.expiraEm ?? null,
    pode_gerenciar: data.usuario.papel === 'admin',
  });
}
