BEGIN;
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE translation_jobs ADD COLUMN IF NOT EXISTS started_at timestamptz;
CREATE TABLE IF NOT EXISTS lesson_chunks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lesson_id text NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  language_id text NOT NULL REFERENCES languages(locale),
  position integer NOT NULL CHECK(position>=0),
  content text NOT NULL,
  source_hash text NOT NULL,
  embedding_model text NOT NULL,
  embedding vector(1536) NOT NULL,
  UNIQUE(lesson_id,language_id,position)
);
CREATE INDEX IF NOT EXISTS lesson_chunks_embedding ON lesson_chunks USING hnsw(embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS lesson_chunks_language ON lesson_chunks(language_id,lesson_id);
COMMIT;