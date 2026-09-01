const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeMessages } = require('../lib/chat/validation.js');

test('sanitizeMessages rejects malformed payloads', () => {
  assert.equal(sanitizeMessages(null), null);
  assert.equal(sanitizeMessages([]), null);
  assert.equal(sanitizeMessages([{ role: 'tool', content: 'invalid' }]), null);
  assert.equal(sanitizeMessages([{ role: 'user', content: '' }]), null);
});

test('sanitizeMessages bounds history and content', () => {
  const input = Array.from({ length: 13 }, (_, index) => ({
    role: 'user',
    content: `${index}-${'x'.repeat(2100)}`,
  }));

  const result = sanitizeMessages(input);

  assert.ok(result);
  assert.equal(result.length, 12);
  assert.equal(result[0].content.startsWith('1-'), true);
  assert.equal(result[0].content.length, 2000);
});

test('sanitizeMessages accepts supported roles', () => {
  assert.deepEqual(
    sanitizeMessages([
      { role: 'system', content: 'rules' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ]),
    [
      { role: 'system', content: 'rules' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ],
  );
});
