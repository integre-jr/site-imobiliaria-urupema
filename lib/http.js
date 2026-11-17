// Respostas padrão da API (spec, seção 11): sucesso { ...dados }, erro { erro, campo? }.

export function json(dados, status = 200, headers = {}) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function erro(mensagem, status = 400, campo) {
  return json(campo ? { erro: mensagem, campo } : { erro: mensagem }, status);
}

// Erro inesperado: loga o detalhe e devolve mensagem genérica.
export function erroInterno(e) {
  console.error(e);
  return erro('Erro interno. Tente novamente em instantes.', 500);
}

export async function lerJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function ipDe(request) {
  return request.headers.get('CF-Connecting-IP') || '';
}
