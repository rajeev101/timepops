const { test } = require('node:test');
const assert = require('node:assert/strict');
const { answerQuestion, chunkLesson, sourceHash } = require('./tutor');
const language = require('../shared/languages.json').find(
  entry => entry.code === 'hi',
);
const input = {
  question: 'गणित समझाइए',
  language,
  courseId: 'math',
  mode: 'teach',
  allowEnglishSources: false,
};
const source = {
  id: '1',
  lessonId: 'lesson',
  title: 'गणित',
  content: 'Reviewed content',
  language: language.locale,
};
const makeClient = reply => ({
  embeddings: {
    create: async () => ({
      data: [{ index: 0, embedding: Array(1536).fill(0.1) }],
    }),
  },
  responses: { create: async () => ({ output_text: JSON.stringify(reply) }) },
});
test('tutor abstains without reviewed retrieval context', async () => {
  const client = makeClient({ answer: 'Unsupported', sourceIds: ['1'] });
  client.responses.create = () => {
    throw new Error('Must not generate without context');
  };
  const result = await answerQuestion(input, {
    client,
    findSources: async () => [],
  });
  assert.equal(result.available, false);
  assert.equal(result.code, 'no_reviewed_context');
});
test('tutor returns only validated source references and requested locale', async () => {
  const client = makeClient({
    answer: 'संदर्भ पर आधारित उत्तर',
    sourceIds: ['1'],
    insufficientContext: false,
  });
  const result = await answerQuestion(input, {
    client,
    findSources: async () => [source],
  });
  assert.equal(result.available, true);
  assert.equal(result.language, language.locale);
  assert.equal(result.citations[0].lessonId, 'lesson');
});
test('fabricated citations and uncertain model answers are rejected', async () => {
  for (const reply of [
    { answer: 'Invented', sourceIds: ['999'], insufficientContext: false },
    { answer: 'Guess', sourceIds: ['1'], insufficientContext: true },
  ]) {
    const result = await answerQuestion(input, {
      client: makeClient(reply),
      findSources: async () => [source],
    });
    assert.equal(result.available, false);
  }
});

test('English source material requires explicit consent under another language',async()=>{
  const client=makeClient({answer:'संदर्भ पर आधारित उत्तर',sourceIds:['1'],insufficientContext:false});
  const findSources=async()=>[{...source,language:'en-Latn-IN'}];
  assert.equal((await answerQuestion(input,{client,findSources})).available,false);
  const result=await answerQuestion({...input,allowEnglishSources:true},{client,findSources});
  assert.equal(result.available,true);assert.equal(result.usedEnglishSources,true);
});
test('chunking preserves Indic text and source hashes change with content', () => {
  const content = 'यह एक पाठ है। '.repeat(400);
  const chunks = chunkLesson('गणित', content, language.locale);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every(chunk => chunk.length <= 2000));
  assert.equal(
    chunks.join('').replace(/\s/g, ''),
    `गणित${content}`.replace(/\s/g, ''),
  );
  assert.notEqual(sourceHash('Title', 'Old'), sourceHash('Title', 'New'));
});
