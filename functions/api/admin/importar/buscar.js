// GET /api/admin/importar/buscar?url= — baixa o feed XML do fornecedor antigo (só admin; máx. 10 MB).
// Devolve o texto; o navegador lê com DOMParser e mostra a prévia (spec 10.4).
import { soAdmin } from '../../../../lib/auth.js';
import { erro, json } from '../../../../lib/http.js';
import { baixar, validarUrl } from '../../../../lib/importar.js';

export async function onRequestGet({ request, data }) {
  const negado = soAdmin(data.usuario);
  if (negado) return negado;
  const url = validarUrl(new URL(request.url).searchParams.get('url'));
  if (!url) return erro('Endereço inválido. Cole o link completo do XML, começando com https://', 400, 'url');
  try {
    const { bytes } = await baixar(url, 10 * 1024 * 1024, 25000);
    const xml = new TextDecoder('utf-8').decode(bytes);
    if (!xml.includes('<')) return erro('O endereço não devolveu um arquivo XML.', 400, 'url');
    return json({ xml });
  } catch (e) {
    return erro(e.message, 400, 'url');
  }
}
