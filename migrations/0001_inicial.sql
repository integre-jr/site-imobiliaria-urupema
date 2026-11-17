-- Esquema inicial da plataforma Urupema (ver docs/ESPECIFICACAO-PLATAFORMA.md, seção 6).
-- Valores em reais inteiros; datas ISO 8601 UTC (TEXT); booleanos INTEGER 0/1.

CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  senha_hash TEXT NOT NULL,          -- "pbkdf2$100000$<salt b64>$<hash b64>"
  papel TEXT NOT NULL CHECK (papel IN ('admin','corretor')),
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL
);

CREATE TABLE sessoes (
  id_hash TEXT PRIMARY KEY,          -- SHA-256(token + SESSION_PEPPER); o token cru só vive no cookie
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em TEXT NOT NULL, criado_em TEXT NOT NULL, ip TEXT, user_agent TEXT
);

CREATE TABLE tentativas_login (ip TEXT NOT NULL, email TEXT, quando TEXT NOT NULL);
CREATE INDEX idx_tent_ip ON tentativas_login(ip, quando);

CREATE TABLE contadores (nome TEXT PRIMARY KEY, valor INTEGER NOT NULL);
INSERT INTO contadores VALUES ('ref_imovel', 1100);   -- refs novas: UR-1101, UR-1102...

CREATE TABLE imoveis (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,                                   -- "UR-1024"
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','ativo','reservado','vendido','alugado','arquivado')),
  finalidade TEXT NOT NULL CHECK (finalidade IN ('venda','aluguel','venda_aluguel')),
  tipo TEXT NOT NULL CHECK (tipo IN ('casa','apartamento','chacara','terreno','comercial','sobrado','cabana','sala','galpao')),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  preco_venda INTEGER, preco_aluguel INTEGER, condominio INTEGER, iptu_anual INTEGER,
  cep TEXT, uf TEXT NOT NULL DEFAULT 'SC', cidade TEXT NOT NULL DEFAULT 'Urupema',
  bairro TEXT, logradouro TEXT, numero TEXT, complemento TEXT,
  latitude REAL, longitude REAL,
  exibir_endereco TEXT NOT NULL DEFAULT 'bairro' CHECK (exibir_endereco IN ('completo','rua','bairro')),
  area_util REAL, area_total REAL,
  quartos INTEGER, suites INTEGER, banheiros INTEGER, vagas INTEGER,
  caracteristicas TEXT NOT NULL DEFAULT '[]',                 -- JSON array de chaves (seção 6.1)
  destaque INTEGER NOT NULL DEFAULT 0,                        -- aparece na home
  no_site INTEGER NOT NULL DEFAULT 1,
  no_grupo_olx INTEGER NOT NULL DEFAULT 1,                    -- entra no feed VRSync
  tipo_publicacao_olx TEXT NOT NULL DEFAULT 'STANDARD',
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','importado','seed')),
  id_externo TEXT,
  criado_por INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL, publicado_em TEXT
);
CREATE INDEX idx_imoveis_pub ON imoveis(status, no_site, finalidade, tipo);

CREATE TABLE fotos (
  id INTEGER PRIMARY KEY,
  imovel_id INTEGER NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,                 -- 0 = capa
  kv_chave TEXT,                                    -- "imovel/<id>/<uuid>"; versões: <chave>/g.jpg e <chave>/p.jpg
  url_externa TEXT,                                 -- só para seed/demo (Unsplash)
  largura INTEGER, altura INTEGER, bytes INTEGER NOT NULL DEFAULT 0,
  legenda TEXT, criado_em TEXT NOT NULL
);
CREATE INDEX idx_fotos_imovel ON fotos(imovel_id, ordem);

CREATE TABLE leads (
  id INTEGER PRIMARY KEY,
  origem TEXT NOT NULL CHECK (origem IN ('contato','negocie','financie','interesse_imovel')),
  nome TEXT NOT NULL, email TEXT, telefone TEXT,
  imovel_ref TEXT,                                  -- quando veio da página de um imóvel
  dados TEXT NOT NULL DEFAULT '{}',                 -- JSON com os demais campos do formulário
  consentimento_em TEXT NOT NULL,                   -- LGPD: quando aceitou
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','em_atendimento','concluido','descartado')),
  notas TEXT, ip TEXT, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL
);
CREATE INDEX idx_leads_status ON leads(status, criado_em);

CREATE TABLE lead_fotos (               -- fotos enviadas no formulário "Negocie" (máx. 5)
  id INTEGER PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  kv_chave TEXT NOT NULL, bytes INTEGER NOT NULL
);

CREATE TABLE configuracoes (chave TEXT PRIMARY KEY, valor TEXT NOT NULL, atualizado_em TEXT NOT NULL);

CREATE TABLE integracoes (              -- uma linha por integração ('instagram')
  nome TEXT PRIMARY KEY,
  dados_cripto TEXT NOT NULL,           -- JSON criptografado com AES-GCM (TOKEN_KEY)
  conta_exibicao TEXT,                  -- ex.: "@urupemaimoveis" (não sensível, para a UI)
  expira_em TEXT, atualizado_em TEXT NOT NULL
);

CREATE TABLE instagram_midias_temp (    -- JPEGs 4:5 gerados no navegador para um post; apagados após 24h
  id TEXT PRIMARY KEY,                  -- uuid; servido em /fotos/ig/<id>.jpg
  conteudo BLOB NOT NULL,               -- ≤ 1 MB (limite de linha do D1 ~2 MB)
  criado_em TEXT NOT NULL
);

CREATE TABLE instagram_posts (
  id INTEGER PRIMARY KEY,
  imovel_id INTEGER REFERENCES imoveis(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('novo','repost')),
  status TEXT NOT NULL CHECK (status IN ('publicando','publicado','erro')),
  ig_media_id TEXT, permalink TEXT, legenda TEXT NOT NULL, erro TEXT, modo TEXT NOT NULL,  -- mock|real
  criado_por INTEGER REFERENCES usuarios(id), criado_em TEXT NOT NULL
);

CREATE TABLE feed_acessos (             -- última leitura de cada feed pelos portais
  feed TEXT NOT NULL, user_agent TEXT, ip TEXT, itens INTEGER, quando TEXT NOT NULL
);
