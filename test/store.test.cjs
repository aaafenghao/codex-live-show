const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SessionStore } = require('../src/store.cjs');

test('completed records persist across restarts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clothesline-store-'));
  const store = new SessionStore(dir); assert.deepEqual(store.load(), []);
  store.save([{ id: 'one', state: 'completed', title: '完成记录' }]);
  assert.equal(new SessionStore(dir).load()[0].state, 'completed');
  assert.equal(fs.statSync(path.join(dir, 'sessions.json')).mode & 0o777, 0o600);
});
test('corrupted persistence is preserved and blocks overwrite', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clothesline-corrupt-'));
  const file = path.join(dir, 'sessions.json'); fs.writeFileSync(file, '{broken');
  const store = new SessionStore(dir); assert.deepEqual(store.load(), []);
  assert.throws(() => store.save([])); assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});
