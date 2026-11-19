// Busca de arquivos externos para a importação do feed antigo (spec 10.4). Só o admin usa.
// O Workers não tem parser de XML: o servidor só baixa; quem lê o XML é o navegador.

export function validarUrl(bruto) {
  try {
    const u = new URL(String(bruto || '').trim());
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
    return u;
  } catch {
    return null;
  }
}

// fetch com tempo máximo e limite de tamanho → { bytes, tipo } ou lança Error com mensagem para o usuário.
export async function baixar(url, maxBytes, tempoMs = 20000) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(tempoMs), headers: { 'User-Agent': 'UrupemaImoveis-Importacao/1.0' }, redirect: 'follow' });
  } catch {
    throw new Error('Não foi possível acessar o endereço (sem resposta).');
  }
  if (!res.ok) throw new Error(`O endereço respondeu com erro (HTTP ${res.status}).`);
  if (Number(res.headers.get('Content-Length')) > maxBytes) throw new Error('Arquivo grande demais.');
  const leitor = res.body.getReader();
  const partes = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      leitor.cancel();
      throw new Error('Arquivo grande demais.');
    }
    partes.push(value);
  }
  const bytes = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) { bytes.set(p, pos); pos += p.length; }
  return { bytes, tipo: res.headers.get('Content-Type') || '' };
}
