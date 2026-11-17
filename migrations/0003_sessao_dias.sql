-- Duração da sessão em dias (7, ou 30 com "manter conectado"). A renovação (spec 8.1) precisa
-- saber o prazo original para decidir se já passou da metade e para quanto estender.
ALTER TABLE sessoes ADD COLUMN dias INTEGER NOT NULL DEFAULT 7;
