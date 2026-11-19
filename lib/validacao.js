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

// Política de senha (endurecida antes da entrega): mínimo de 12 caracteres e nada fácil de adivinhar.
export const SENHA_MIN = 12;
const OBVIAS = ['urupema', 'imobiliaria', 'imoveis', 'imovel', 'negocios', 'senha', 'password', 'administrador', 'admin',
  'qwerty', 'asdfgh', 'mudar', 'trocar', 'brasil'];
const semAcento = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// O que sobra da senha depois de tirar palavras óbvias, o nome/e-mail da pessoa e sequências (123, abc, 987).
function nucleo(senha, palavras) {
  let r = semAcento(senha);
  for (const p of palavras) if (p.length >= 3) r = r.replaceAll(p, '');
  let sem = '';
  let i = 0;
  while (i < r.length) {
    let j = i + 1;
    const passo = r.charCodeAt(j) - r.charCodeAt(i);
    if (Math.abs(passo) === 1 || passo === 0) while (j < r.length && r.charCodeAt(j) - r.charCodeAt(j - 1) === passo) j += 1;
    if (j - i >= 3) i = j;               // sequência ou repetição de 3+ → fora
    else { sem += r[i]; i += 1; }
  }
  return sem;
}

// contexto: { nome, email } da pessoa, que também não podem ser a base da senha.
export function validarSenha(senha, { nome = '', email = '' } = {}) {
  if (typeof senha !== 'string' || senha.length < SENHA_MIN) return `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
  if (senha.length > 200) return 'Senha longa demais (máx. 200 caracteres).';
  const pessoais = [semAcento(String(email).split('@')[0]), ...semAcento(String(nome)).split(/\s+/)];
  const resto = nucleo(senha, [...OBVIAS, ...pessoais]);
  if (new Set(resto).size < 6) {
    return 'Senha fácil de adivinhar. Evite o nome da imobiliária, "senha", "admin", sequências como 123456, e o seu nome ou e-mail. Uma frase de 3 ou 4 palavras funciona bem.';
  }
}

export const PAPEIS = ['admin', 'corretor'];
