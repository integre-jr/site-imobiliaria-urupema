// /api/admin/instagram/*: limpa as imagens temporárias e renova o token quando preciso (spec 9.4).
// A conexão (já renovada) fica em context.data.instagram.
import { limparMidiasTemp, renovarSeNecessario } from '../../../../lib/instagram/index.js';

export async function onRequest(context) {
  await limparMidiasTemp(context.env);
  context.data.instagram = await renovarSeNecessario(context.env);
  return context.next();
}
