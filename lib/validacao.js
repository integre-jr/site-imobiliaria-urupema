// Validações comuns. Cada função devolve a mensagem de erro (para o usuário) ou undefined.

export const limpar = (v) => (typeof v === 'string' ? v.trim() : '');

export function validarNome(nome) {
  if (!nome) return 'Informe o nome.';
  if (nome.length > 100) return 'Nome longo demais (máx. 100 caracteres).';
}

export function validarEmail(email) {
  if (!email) return 'Informe o e-mail.';
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'E-mail inválido.';
}

export function validarSenha(senha) {
  if (typeof senha !== 'string' || senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (senha.length > 200) return 'Senha longa demais (máx. 200 caracteres).';
}

export const PAPEIS = ['admin', 'corretor'];
