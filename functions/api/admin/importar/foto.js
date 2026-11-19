// GET /api/admin/importar/foto?url= — repassa os bytes de uma foto do feed antigo (só admin; máx. 15 MB).
// O navegador não pode ler fotos de outro domínio sem CORS; daqui ela é reduzida no navegador e
// enviada como uma foto nova do anúncio (mesmo fluxo da spec 8.3).
import { soAdmin } from '../../../../lib/auth.js';
import { erro } from '../../../../lib/http.js';
import { baixar, validarUrl } from '../../../../lib/importar.js';

export async function onRequestGet({ request, data }) {
  const negado = soAdmin(data.usuario);
  if (negado) return negado;
  const url = validarUrl(new URL(request.url).searchParams.get('url'));
  if (!url) return erro('Endereço de foto inválido.');
  try {
    const { bytes, tipo } = await baixar(url, 15 * 1024 * 1024);
    if (tipo && !tipo.startsWith('image/') && !tipo.includes('octet-stream')) return erro('O endereço não é uma foto.');
    return new Response(bytes, { headers: { 'Content-Type': tipo.startsWith('image/') ? tipo : 'image/jpeg', 'Cache-Control': 'no-store' } });
  } catch (e) {
    return erro(e.message);
  }
}
