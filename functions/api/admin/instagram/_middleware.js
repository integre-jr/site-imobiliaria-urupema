// /api/admin/instagram/*: limpa as imagens temporárias e renova o token quando preciso (spec 9.4).
// O app da Meta (modo, credenciais) fica em context.data.igApp e a conexão (já renovada) em context.data.instagram.
import { carregarApp, limparMidiasTemp, renovarSeNecessario } from '../../../../lib/instagram/index.js';

export async function onRequest(context) {
  await limparMidiasTemp(context.env);
  context.data.igApp = await carregarApp(context.env);
  context.data.instagram = await renovarSeNecessario(context.env, context.data.igApp);
  return context.next();
}
