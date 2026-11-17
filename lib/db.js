// Acesso ao D1. Toda SQL usa prepare().bind(), nunca valores concatenados (spec, seção 11).

export const agora = () => new Date().toISOString();

export async function todos(db, sql, ...params) {
  const { results } = await db.prepare(sql).bind(...params).all();
  return results;
}

export function um(db, sql, ...params) {
  return db.prepare(sql).bind(...params).first();
}

export function executar(db, sql, ...params) {
  return db.prepare(sql).bind(...params).run();
}

// Próximo número de um contador (ex.: 'ref_imovel' → 1101), atômico numa só instrução.
export async function proximo(db, nome) {
  const linha = await um(db, 'UPDATE contadores SET valor = valor + 1 WHERE nome = ? RETURNING valor', nome);
  return linha.valor;
}
