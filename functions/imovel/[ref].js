// GET /imovel/:ref — página pública do imóvel, montada no servidor (spec 7.3).
import { pagina404, paginaImovel } from '../../lib/pagina-imovel.js';

export async function onRequestGet({ request, env, params }) {
  return (await paginaImovel(env, request, params.ref)) || pagina404(env, request);
}
