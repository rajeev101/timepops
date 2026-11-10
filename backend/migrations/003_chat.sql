BEGIN;
CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_conversations_owner ON chat_conversations(user_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS chat_turns (
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  user_text text NOT NULL CHECK(length(user_text)<=6000),
  assistant_text text NOT NULL DEFAULT '' CHECK(length(assistant_text)<=32000),
  status text NOT NULL CHECK(status IN ('pending','completed','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(conversation_id,request_id)
);
CREATE INDEX IF NOT EXISTS chat_turns_timeline ON chat_turns(conversation_id,created_at);
COMMIT;