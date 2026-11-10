const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { database } = require('./database');
const languages = require('../shared/languages.json');
const catalog = require('./catalog');

async function migrate() {
  const pool = database();
  try {
    await pool.query(
      await readFile(
        path.join(__dirname, 'migrations/001_multilingual.sql'),
        'utf8',
      ),
    );
    await pool.query(await readFile(path.join(__dirname,'migrations/003_chat.sql'),'utf8'));
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const language of languages) {
        await client.query(
          'INSERT INTO languages(locale,code,name,native_name,script,text_direction) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(locale) DO NOTHING',
          [
            language.locale,
            language.code,
            language.name,
            language.nativeName,
            language.script,
            language.direction,
          ],
        );
      }
      const visit = async (nodes, parent) => {
        for (const node of nodes) {
          await client.query(
            'INSERT INTO categories(id,parent_id) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',
            [node.id, parent],
          );
          await visit(node.children, node.id);
        }
      };
      await visit(catalog.categories, null);
      for (const course of catalog.courses) {
        await client.query(
          'INSERT INTO courses(id,category_id,slug) VALUES($1,$2,$1) ON CONFLICT(id) DO NOTHING',
          [course.id, course.categoryId],
        );
        await client.query(
          "INSERT INTO course_translations(course_id,language_id,title,description,content_status) VALUES($1,'en-Latn-IN',$2,$3,'in_progress') ON CONFLICT(course_id,language_id) DO NOTHING",
          [course.id, course.title, course.summary],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    console.log('Multilingual schema ready; preview seeds remain unpublished.');
  } finally {
    await pool.end();
  }
}
migrate().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
