const { database } = require('./database');
const {
  provider,
  embed,
  chunkLesson,
  sourceHash,
  embeddingModel,
} = require('./tutor');
const pgvector = require('pgvector');

async function run() {
  const pool = database();
  try {
    if (process.argv.includes('--migrate')) {
      const { readFile } = require('node:fs/promises');
      await pool.query(
        await readFile(
          require('node:path').join(__dirname, 'migrations/002_tutor.sql'),
          'utf8',
        ),
      );
      return;
    }
    const ai = provider();
    for (let count = 0; count < 10; count += 1) {
      const claimed = await pool.query(
        `UPDATE translation_jobs SET status='running',attempts=attempts+1,started_at=now() WHERE id=(SELECT id FROM translation_jobs WHERE job_type='embedding' AND attempts<3 AND (status='queued' OR (status='running' AND started_at<now()-interval '10 minutes')) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
      );
      const job = claimed.rows[0];
      if (!job) {
        break;
      }
      try {
        const result = await pool.query(
          "SELECT title,content FROM lesson_translations WHERE lesson_id=$1 AND language_id=$2 AND content_status='published'",
          [job.entity_id, job.language_id],
        );
        if (!result.rows.length) {
          await pool.query(
            "UPDATE translation_jobs SET status='completed' WHERE id=$1",
            [job.id],
          );
          continue;
        }
        const { title, content } = result.rows[0];
        const hash = sourceHash(title, content);
        const chunks = chunkLesson(title, content, job.language_id);
        const vectors = [];
        for (let offset = 0; offset < chunks.length; offset += 32) {
          vectors.push(...(await embed(ai, chunks.slice(offset, offset + 32))));
        }
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const current = await client.query(
            'SELECT title,content,content_status FROM lesson_translations WHERE lesson_id=$1 AND language_id=$2 FOR UPDATE',
            [job.entity_id, job.language_id],
          );
          if (
            !current.rows.length ||
            current.rows[0].content_status !== 'published' ||
            sourceHash(current.rows[0].title, current.rows[0].content) !== hash
          ) {
            await client.query(
              "UPDATE translation_jobs SET status='completed' WHERE id=$1",
              [job.id],
            );
            await client.query('COMMIT');
            continue;
          }
          await client.query(
            'DELETE FROM lesson_chunks WHERE lesson_id=$1 AND language_id=$2',
            [job.entity_id, job.language_id],
          );
          for (let position = 0; position < chunks.length; position += 1) {
            await client.query(
              'INSERT INTO lesson_chunks(lesson_id,language_id,position,content,source_hash,embedding_model,embedding) VALUES($1,$2,$3,$4,$5,$6,$7::vector)',
              [
                job.entity_id,
                job.language_id,
                position,
                chunks[position],
                hash,
                embeddingModel(),
                pgvector.toSql(vectors[position]),
              ],
            );
          }
          await client.query(
            "UPDATE translation_jobs SET status='completed',error=NULL WHERE id=$1",
            [job.id],
          );
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      } catch {
        await pool.query(
          "UPDATE translation_jobs SET status=CASE WHEN attempts<3 THEN 'queued' ELSE 'failed' END,error='Embedding failed; inspect provider and database configuration' WHERE id=$1",
          [job.id],
        );
      }
    }
  } finally {
    await pool.end();
  }
}
run().catch(() => {
  console.error(
    'Embedding worker failed; check database, vector migration, and provider configuration.',
  );
  process.exitCode = 1;
});
