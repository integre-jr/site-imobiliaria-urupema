// Redefine a senha de um usuário direto no D1, para quando o próprio administrador esqueceu a dele.
// Gera o hash com o mesmo código do servidor (lib/auth.js) e escreve um .sql temporário,
// porque o hash tem "$" e o terminal estragaria o comando se ele fosse colado na linha.
//
// Uso:   node scripts/hash-senha.mjs <email> <nova senha>
// Depois rode o comando que o script imprimir. Passo a passo em docs/RECUPERAR-SENHA.md.

import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashSenha } from '../lib/auth.js';
import { validarSenha } from '../lib/validacao.js';

const [email, senha] = process.argv.slice(2);
if (!email || !senha) {
  console.error('Uso: node scripts/hash-senha.mjs <email> <nova senha>');
  process.exit(1);
}
const problema = validarSenha(senha, { email });
if (problema) {
  console.error(problema);
  process.exit(1);
}

const sql = (texto) => `'${String(texto).replaceAll("'", "''")}'`;
const emailSql = sql(email.trim().toLowerCase());
const arquivo = join(tmpdir(), 'urupema-redefinir-senha.sql');
writeFileSync(arquivo, [
  `UPDATE usuarios SET senha_hash = ${sql(await hashSenha(senha))}, ativo = 1, atualizado_em = ${sql(new Date().toISOString())} WHERE email = ${emailSql};`,
  `DELETE FROM sessoes WHERE usuario_id = (SELECT id FROM usuarios WHERE email = ${emailSql});`,
  `DELETE FROM tentativas_login;`,
  `SELECT id, nome, email, papel, ativo FROM usuarios WHERE email = ${emailSql};`,
].join('\n'));

console.log('Arquivo gerado. Confira a conta com "npx wrangler whoami" e rode:\n');
console.log(`  npx wrangler d1 execute urupema --remote --file "${arquivo}"\n`);
console.log('Se a última linha do resultado vier vazia, o e-mail não existe no banco. Apague o arquivo depois.');
