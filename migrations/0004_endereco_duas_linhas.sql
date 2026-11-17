-- O site mostra o endereço em duas linhas (rua/sala e bairro/cidade/CEP). Com uma chave só, o
-- modo de edição não teria como manter a quebra de linha. Troca "contato.endereco" por duas chaves.
INSERT OR IGNORE INTO configuracoes (chave, valor, atualizado_em) VALUES
('contato.endereco_1', 'Rua Artur Pagani, 08 — Sala 01', '2026-11-17T12:00:00Z'),
('contato.endereco_2', 'Centro, Urupema/SC · 88625-000', '2026-11-17T12:00:00Z');
DELETE FROM configuracoes WHERE chave = 'contato.endereco';
