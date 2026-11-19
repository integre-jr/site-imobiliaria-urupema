// Fotos dos anúncios (spec 8.3): o navegador redimensiona e o servidor só guarda.
// Cada foto vira duas: g (lado maior 1600 px, JPEG) e p (640 px, para cards e miniaturas).
import { ErroApi, irParaLogin } from './api.js';

const MAX_G = 1.45 * 1024 * 1024;   // o servidor aceita até 1,5 MB
const MAX_P = 290 * 1024;           // e até 300 KB

function reduzir(bmp, lado, qualidade) {
  const f = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * f);
  const h = Math.round(bmp.height * f);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';            // PNG transparente não vira fundo preto no JPEG
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  return new Promise((ok, falha) => canvas.toBlob((blob) => (blob ? ok({ blob, w, h }) : falha(new Error('toBlob'))), 'image/jpeg', qualidade));
}

async function abrir(arquivo) {
  try {
    return await createImageBitmap(arquivo, { imageOrientation: 'from-image' });   // respeita a rotação da câmera
  } catch {
    throw new Error(`"${arquivo.name}": formato não suportado. Envie JPG ou PNG.`);
  }
}

// Arquivo escolhido (câmera ou galeria) → { g, p, largura, altura }.
export async function prepararFoto(arquivo) {
  const bmp = await abrir(arquivo);
  try {
    let g = await reduzir(bmp, 1600, 0.82);
    if (g.blob.size > MAX_G) g = await reduzir(bmp, 1600, 0.66);
    let p = await reduzir(bmp, 640, 0.78);
    if (p.blob.size > MAX_P) p = await reduzir(bmp, 640, 0.6);
    return { g: g.blob, p: p.blob, largura: g.w, altura: g.h };
  } finally {
    bmp.close?.();
  }
}

// Foto fixa do site (fundo do topo): uma versão só, larga, para telas grandes. O servidor aceita até 2 MB.
export async function prepararImagem(arquivo) {
  const bmp = await abrir(arquivo);
  try {
    let r = await reduzir(bmp, 1920, 0.82);
    if (r.blob.size > 1.9 * 1024 * 1024) r = await reduzir(bmp, 1920, 0.66);
    return r.blob;
  } finally {
    bmp.close?.();
  }
}

// Devolve o pacote de /api/admin/config já com a foto nova.
export async function enviarImagemSite(chave, blob) {
  const dados = new FormData();
  dados.append('chave', chave);
  dados.append('foto', blob, 'foto.jpg');
  return postar('/api/admin/imagens', dados);
}

async function postar(caminho, dados) {
  let r;
  try {
    r = await fetch(caminho, { method: 'POST', headers: { 'X-Urupema': '1' }, body: dados, credentials: 'same-origin' });
  } catch {
    throw new ErroApi('Sem conexão. Confira a internet e tente de novo.', 0);
  }
  const corpo = await r.json().catch(() => ({}));
  if (r.status === 401) irParaLogin();
  if (!r.ok) throw new ErroApi(corpo.erro || 'Não foi possível enviar a foto.', r.status);
  return corpo;
}

export async function enviarFoto(imovelId, foto) {
  const dados = new FormData();
  dados.append('g', foto.g, 'g.jpg');
  dados.append('p', foto.p, 'p.jpg');
  dados.append('largura', String(foto.largura));
  dados.append('altura', String(foto.altura));
  return postar(`/api/admin/imoveis/${imovelId}/fotos`, dados);
}
