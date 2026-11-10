BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE IF NOT EXISTS languages (
  locale text PRIMARY KEY, code text NOT NULL, name text NOT NULL, native_name text NOT NULL,
  script text NOT NULL, text_direction text NOT NULL CHECK (text_direction IN ('ltr','rtl')),
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY, name text, email text,
  preferred_language text REFERENCES languages(locale), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS categories (id text PRIMARY KEY, parent_id text REFERENCES categories(id));
CREATE TABLE IF NOT EXISTS courses (
  id text PRIMARY KEY, category_id text NOT NULL REFERENCES categories(id), slug text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived'))
);
CREATE TABLE IF NOT EXISTS course_translations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id text NOT NULL REFERENCES courses(id), language_id text NOT NULL REFERENCES languages(locale),
  title text NOT NULL, description text NOT NULL DEFAULT '',
  content_status text NOT NULL DEFAULT 'not_started' CHECK (content_status IN ('not_started','in_progress','ai_translated','under_review','approved','published','rejected')),
  reviewed_by text REFERENCES users(id), reviewed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
  search_document tsvector GENERATED ALWAYS AS (to_tsvector('simple', title || ' ' || description)) STORED,
  UNIQUE(course_id,language_id)
);
CREATE INDEX IF NOT EXISTS course_translation_fts ON course_translations USING gin(search_document) WHERE content_status='published';
CREATE INDEX IF NOT EXISTS course_translation_trgm ON course_translations USING gin(title gin_trgm_ops) WHERE content_status='published';
CREATE TABLE IF NOT EXISTS lessons (
  id text PRIMARY KEY, course_id text NOT NULL REFERENCES courses(id), position integer NOT NULL CHECK(position>=0), UNIQUE(course_id,position)
);
CREATE TABLE IF NOT EXISTS lesson_translations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, lesson_id text NOT NULL REFERENCES lessons(id),
  language_id text NOT NULL REFERENCES languages(locale), title text NOT NULL, description text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '', video_url text, document_url text, subtitle_url text,
  content_status text NOT NULL DEFAULT 'not_started' CHECK (content_status IN ('not_started','in_progress','ai_translated','under_review','approved','published','rejected')),
  reviewed_by text REFERENCES users(id), reviewed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(lesson_id,language_id)
);
CREATE TABLE IF NOT EXISTS questions (
  id text PRIMARY KEY, course_id text NOT NULL REFERENCES courses(id), subject_id text,
  correct_option integer NOT NULL CHECK(correct_option>=0)
);
CREATE TABLE IF NOT EXISTS question_translations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, question_id text NOT NULL REFERENCES questions(id),
  language_id text NOT NULL REFERENCES languages(locale), question_text text NOT NULL,
  explanation text NOT NULL DEFAULT '', options jsonb NOT NULL CHECK(jsonb_typeof(options)='array'),
  content_status text NOT NULL DEFAULT 'not_started' CHECK (content_status IN ('not_started','in_progress','ai_translated','under_review','approved','published','rejected')),
  reviewed_by text REFERENCES users(id), reviewed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(question_id,language_id)
);
CREATE TABLE IF NOT EXISTS category_translations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, category_id text NOT NULL REFERENCES categories(id),
  language_id text NOT NULL REFERENCES languages(locale), title text NOT NULL, description text NOT NULL DEFAULT '',
  content_status text NOT NULL DEFAULT 'not_started' CHECK (content_status IN ('not_started','in_progress','ai_translated','under_review','approved','published','rejected')),
  reviewed_by text REFERENCES users(id), reviewed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(category_id,language_id)
);
CREATE TABLE IF NOT EXISTS search_aliases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, course_id text NOT NULL REFERENCES courses(id),
  language_id text NOT NULL REFERENCES languages(locale), alias text NOT NULL,
  UNIQUE(course_id,language_id,alias)
);
CREATE INDEX IF NOT EXISTS search_alias_trgm ON search_aliases USING gin(alias gin_trgm_ops);
CREATE TABLE IF NOT EXISTS translation_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, entity_type text NOT NULL, entity_id text NOT NULL,
  language_id text NOT NULL REFERENCES languages(locale), actor_id text NOT NULL REFERENCES users(id),
  previous_status text, next_status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS translation_jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, entity_type text NOT NULL, entity_id text NOT NULL,
  language_id text NOT NULL REFERENCES languages(locale), job_type text NOT NULL CHECK(job_type IN ('translation_draft','embedding','asset_validation')),
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed')),
  attempts integer NOT NULL DEFAULT 0, error text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION guard_translation_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' AND NEW.content_status IN ('approved','published') THEN
    RAISE EXCEPTION 'New translations must pass the review workflow';
  END IF;
  IF NEW.content_status='approved' AND (OLD.content_status<>'under_review' OR NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL) THEN
    RAISE EXCEPTION 'Approval requires human review';
  END IF;
  IF NEW.content_status='published' AND OLD.content_status<>'approved' THEN
    RAISE EXCEPTION 'Only approved translations can be published';
  END IF;
  IF OLD.content_status IN ('approved','published') AND NEW.content_status IN ('approved','published') THEN
    IF (to_jsonb(NEW)-ARRAY['content_status','updated_at','reviewed_by','reviewed_at','search_document']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['content_status','updated_at','reviewed_by','reviewed_at','search_document']) THEN
      RAISE EXCEPTION 'Published content edits must restart review';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS course_translation_guard ON course_translations;
CREATE TRIGGER course_translation_guard BEFORE INSERT OR UPDATE ON course_translations FOR EACH ROW EXECUTE FUNCTION guard_translation_publication();
DROP TRIGGER IF EXISTS lesson_translation_guard ON lesson_translations;
CREATE TRIGGER lesson_translation_guard BEFORE INSERT OR UPDATE ON lesson_translations FOR EACH ROW EXECUTE FUNCTION guard_translation_publication();
DROP TRIGGER IF EXISTS question_translation_guard ON question_translations;
CREATE TRIGGER question_translation_guard BEFORE INSERT OR UPDATE ON question_translations FOR EACH ROW EXECUTE FUNCTION guard_translation_publication();
DROP TRIGGER IF EXISTS category_translation_guard ON category_translations;
CREATE TRIGGER category_translation_guard BEFORE INSERT OR UPDATE ON category_translations FOR EACH ROW EXECUTE FUNCTION guard_translation_publication();
COMMIT;