-- Publicação no Instagram em duas etapas (marco M6): /publicar cria o contêiner na Meta e
-- /concluir publica quando ele fica pronto. O ID do contêiner fica guardado entre as duas chamadas.
ALTER TABLE instagram_posts ADD COLUMN ig_container_id TEXT;
CREATE INDEX idx_ig_posts_data ON instagram_posts(criado_em);
CREATE INDEX idx_feed_acessos ON feed_acessos(feed, quando);
