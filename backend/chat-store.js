const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { database } = require('./database');
const { ChatError } = require('./gemini');
const hash = value =>
  createHash('sha256')
    .update(value ?? '')
    .digest('hex');

class ChatStore {
  constructor(pool = database) {
    this.pool = pool;
    this.guests = new Map();
  }
  prune() {
    for (const [id, conversation] of this.guests) {
      if (conversation.expires < Date.now() && !conversation.busy) {
        this.guests.delete(id);
      }
    }
  }
  async create(owner) {
    const id = randomUUID();
    if (owner.userId) {
      const pool = this.pool();
      await pool.query(
        'INSERT INTO users(id) VALUES($1) ON CONFLICT(id) DO NOTHING',
        [owner.userId],
      );
      const result = await pool.query(
        'INSERT INTO chat_conversations(id,user_id) SELECT $1,$2 WHERE (SELECT count(*) FROM chat_conversations WHERE user_id=$2)<100 RETURNING id,title,updated_at AS "updatedAt"',
        [id, owner.userId],
      );
      if (!result.rows.length) {
        throw new ChatError('history_limit', 429);
      }
      return result.rows[0];
    }
    this.prune();
    if (this.guests.size >= 200) {
      throw new ChatError('rate_limited', 429);
    }
    const guestToken = randomBytes(32).toString('base64url');
    this.guests.set(id, {
      id,
      title: 'New conversation',
      tokenHash: hash(guestToken),
      turns: [],
      expires: Date.now() + 3600000,
      busy: false,
    });
    return { id, title: 'New conversation', guestToken };
  }
  async list(owner) {
    if (!owner.userId) {
      throw new ChatError('unauthenticated', 401);
    }
    const result = await this.pool().query(
      'SELECT id,title,updated_at AS "updatedAt" FROM chat_conversations WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 100',
      [owner.userId],
    );
    return result.rows;
  }
  async withConversation(id, owner, action) {
    if (!owner.userId) {
      this.prune();
      const conversation = this.guests.get(id);
      if (!conversation || conversation.tokenHash !== hash(owner.guestToken)) {
        throw new ChatError('conversation_not_found', 404);
      }
      if (conversation.busy) {
        throw new ChatError('request_in_progress', 409);
      }
      conversation.busy = true;
      conversation.expires = Date.now() + 3600000;
      try {
        return await action({
          ...conversation,
          save: async turn => {
            const index = conversation.turns.findIndex(
              item => item.requestId === turn.requestId,
            );
            if (index < 0) {
              conversation.turns.push(turn);
            } else {
              conversation.turns[index] = turn;
            }
            conversation.title =
              conversation.turns[0]?.userText.slice(0, 80) ||
              'New conversation';
          },
          remove: async () => this.guests.delete(id),
        });
      } finally {
        conversation.busy = false;
      }
    }
    const client = await this.pool().connect();
    let locked = false;
    try {
      const result = await client.query(
        'SELECT id,title FROM chat_conversations WHERE id=$1 AND user_id=$2',
        [id, owner.userId],
      );
      if (!result.rows.length) {
        throw new ChatError('conversation_not_found', 404);
      }
      locked = (
        await client.query(
          'SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked',
          [id],
        )
      ).rows[0].locked;
      if (!locked) {
        throw new ChatError('request_in_progress', 409);
      }
      const turns = (
        await client.query(
          'SELECT request_id AS "requestId",user_text AS "userText",assistant_text AS "assistantText",status FROM chat_turns WHERE conversation_id=$1 ORDER BY created_at',
          [id],
        )
      ).rows;
      return await action({
        ...result.rows[0],
        turns,
        save: async turn => {
          await client.query(
            'INSERT INTO chat_turns(conversation_id,request_id,user_text,assistant_text,status) VALUES($1,$2,$3,$4,$5) ON CONFLICT(conversation_id,request_id) DO UPDATE SET assistant_text=$4,status=$5',
            [
              id,
              turn.requestId,
              turn.userText,
              turn.assistantText,
              turn.status,
            ],
          );
          await client.query(
            'UPDATE chat_conversations SET title=$2,updated_at=now() WHERE id=$1',
            [id, (turns[0]?.userText ?? turn.userText).slice(0, 80)],
          );
        },
        remove: async () => {
          await client.query(
            'DELETE FROM chat_conversations WHERE id=$1 AND user_id=$2',
            [id, owner.userId],
          );
        },
      });
    } finally {
      try {
        if (locked) {
          await client.query(
            'SELECT pg_advisory_unlock(hashtextextended($1,0))',
            [id],
          );
        }
      } finally {
        client.release();
      }
    }
  }
}
module.exports = { ChatStore };
