-- Dados de demonstração (ver docs/ESPECIFICACAO-PLATAFORMA.md, seção 6.3).
-- Os 6 imóveis fictícios da vitrine original + configurações iniciais. NÃO cria usuário.

INSERT INTO imoveis (ref, status, finalidade, tipo, titulo, descricao, preco_venda, preco_aluguel,
  bairro, area_util, area_total, quartos, banheiros, vagas, caracteristicas, destaque, origem,
  criado_em, atualizado_em, publicado_em) VALUES
('UR-1024', 'ativo', 'venda', 'casa', 'Casa de Campo com Lareira',
  'Casa de campo no Centro de Urupema, com lareira, 3 quartos e ótima iluminação natural. Imóvel fictício de demonstração.',
  850000, NULL, 'Centro', 180, NULL, 3, 2, 2, '["lareira"]', 1, 'seed',
  '2026-11-01T12:00:00Z', '2026-11-01T12:00:00Z', '2026-11-01T12:00:00Z'),
('UR-1031', 'ativo', 'venda', 'chacara', 'Chácara Vista Serra',
  'Chácara no interior de Urupema com vista para a serra, 4 quartos e 5.000 m² de terreno. Imóvel fictício de demonstração.',
  1200000, NULL, 'Interior', NULL, 5000, 4, 3, 4, '["vista_montanha"]', 1, 'seed',
  '2026-11-01T12:05:00Z', '2026-11-01T12:05:00Z', '2026-11-01T12:05:00Z'),
('UR-1042', 'ativo', 'venda', 'apartamento', 'Apartamento Aconchegante',
  'Apartamento aconchegante no Centro, com 2 quartos e vaga de garagem. Imóvel fictício de demonstração.',
  320000, NULL, 'Centro', 68, NULL, 2, 1, 1, '[]', 1, 'seed',
  '2026-11-01T12:10:00Z', '2026-11-01T12:10:00Z', '2026-11-01T12:10:00Z'),
('UR-2007', 'ativo', 'aluguel', 'cabana', 'Cabana Rústica da Montanha',
  'Cabana rústica em Rio dos Bugres, ideal para quem busca sossego na serra. Imóvel fictício de demonstração.',
  NULL, 2800, 'Rio dos Bugres', 90, NULL, 1, 1, 2, '["lareira","vista_montanha"]', 1, 'seed',
  '2026-11-01T12:15:00Z', '2026-11-01T12:15:00Z', '2026-11-01T12:15:00Z'),
('UR-1050', 'ativo', 'venda', 'terreno', 'Terreno Panorâmico',
  'Terreno escriturado em Santo Antônio, com 800 m² e vista para a serra. Imóvel fictício de demonstração.',
  190000, NULL, 'Santo Antônio', NULL, 800, NULL, NULL, NULL, '["vista_montanha"]', 1, 'seed',
  '2026-11-01T12:20:00Z', '2026-11-01T12:20:00Z', '2026-11-01T12:20:00Z'),
('UR-2015', 'ativo', 'aluguel', 'casa', 'Casa Ampla com Lareira',
  'Casa ampla no Centro, com lareira, 3 quartos e 2 vagas. Imóvel fictício de demonstração.',
  NULL, 4500, 'Centro', 150, NULL, 3, 2, 2, '["lareira"]', 1, 'seed',
  '2026-11-01T12:25:00Z', '2026-11-01T12:25:00Z', '2026-11-01T12:25:00Z');

INSERT INTO fotos (imovel_id, ordem, url_externa, legenda, criado_em) VALUES
((SELECT id FROM imoveis WHERE ref = 'UR-1024'), 0, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80', 'Casa de campo no Centro de Urupema', '2026-11-01T12:00:00Z'),
((SELECT id FROM imoveis WHERE ref = 'UR-1031'), 0, 'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=1600&q=80', 'Chácara com vista para a serra', '2026-11-01T12:00:00Z'),
((SELECT id FROM imoveis WHERE ref = 'UR-1042'), 0, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=80', 'Apartamento aconchegante no Centro', '2026-11-01T12:00:00Z'),
((SELECT id FROM imoveis WHERE ref = 'UR-2007'), 0, 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1600&q=80', 'Cabana rústica para aluguel', '2026-11-01T12:00:00Z'),
((SELECT id FROM imoveis WHERE ref = 'UR-1050'), 0, 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80', 'Terreno panorâmico', '2026-11-01T12:00:00Z'),
((SELECT id FROM imoveis WHERE ref = 'UR-2015'), 0, 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80', 'Casa com lareira para aluguel', '2026-11-01T12:00:00Z');

INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES
('contato.telefone_1', '(49) 99160-3030', '2026-11-01T12:00:00Z'),
('contato.telefone_2', '(49) 99107-5332', '2026-11-01T12:00:00Z'),
('contato.whatsapp', '5549991603030', '2026-11-01T12:00:00Z'),
('contato.email', 'contato@urupemaimoveis.com.br', '2026-11-01T12:00:00Z'),
('contato.endereco', 'Rua Artur Pagani, 08 — Sala 01, Centro, Urupema/SC, 88625-000', '2026-11-01T12:00:00Z'),
('redes.instagram', 'https://instagram.com', '2026-11-01T12:00:00Z'),
('redes.facebook', 'https://facebook.com', '2026-11-01T12:00:00Z'),
('home.stat_1_n', '+15', '2026-11-01T12:00:00Z'),
('home.stat_1_l', 'Anos de tradição', '2026-11-01T12:00:00Z'),
('home.stat_2_n', '+320', '2026-11-01T12:00:00Z'),
('home.stat_2_l', 'Imóveis negociados', '2026-11-01T12:00:00Z'),
('home.stat_3_n', '100%', '2026-11-01T12:00:00Z'),
('home.stat_3_l', 'Atendimento local', '2026-11-01T12:00:00Z'),
('instagram.modelo_legenda', '{titulo}

{finalidade_rotulo}: {preco}
📍 {bairro} · {cidade}/{uf}
{specs}

Cód. {ref} — mais fotos e detalhes no link da bio.
📲 WhatsApp: {telefone_1}

{hashtags}', '2026-11-01T12:00:00Z'),
('instagram.hashtags', '#urupema #serracatarinense #imoveis #imoveisserragaucha #casanaserra #imobiliaria', '2026-11-01T12:00:00Z'),
('leads.email_aviso', '', '2026-11-01T12:00:00Z');
