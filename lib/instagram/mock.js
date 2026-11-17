// Instagram simulado (INSTAGRAM_MODO=mock, spec 9.1): "conectar" volta direto ao callback com code=mock.
// Serve para a demonstração e para testar o painel sem conta real.

const DIA = 86400000;

export function conectarUrl(env, state, redirectUri) {
  return `${redirectUri}?${new URLSearchParams({ code: 'mock', state })}`;
}

export async function trocarCodigo(env, code) {
  if (code !== 'mock') throw new Error('Código de autorização inválido (modo demonstração)');
  return {
    token: 'mock_' + crypto.randomUUID(),
    userId: '0',
    username: 'urupema_demo',
    expiraEm: new Date(Date.now() + 60 * DIA).toISOString(),
  };
}

export async function renovar(env, token) {
  return { token, expiraEm: new Date(Date.now() + 60 * DIA).toISOString() };
}
