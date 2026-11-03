const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { SessionMonitor } = require('../src/monitor.cjs');
const { writeEvent } = require('../scripts/hook-bridge.cjs');
const { updateHooks } = require('../scripts/install-hooks.cjs');
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clothesline-monitor-'));
  return { dir, monitor: new SessionMonitor({ codexHome: path.join(dir, 'codex'), dataDir: path.join(dir, 'data') }) };
}
const event = (type, at) => JSON.stringify({ type: 'event_msg', timestamp: new Date(at).toISOString(), payload: { type } }) + '\n';

test('session lifecycle does not conflate a live session with a running turn', () => {
  const { monitor } = fixture(); const at = Date.now();
  monitor.apply('one', 'SessionStart', at); assert.equal(monitor.snapshot().sessions[0].state, 'unknown');
  monitor.apply('one', 'UserPromptSubmit', at + 1); assert.equal(monitor.snapshot().sessions[0].state, 'running');
  monitor.apply('one', 'PermissionRequest', at + 2); assert.equal(monitor.snapshot().sessions[0].phase, '等待审批');
  monitor.apply('one', 'Stop', at + 3); assert.equal(monitor.snapshot().sessions[0].state, 'completed');
  monitor.apply('one', 'SessionEnd', at + 4); assert.equal(monitor.snapshot().sessions[0].state, 'completed');
  monitor.apply('one', 'UserPromptSubmit', at + 5); monitor.apply('one', 'Interrupt', at + 6);
  assert.equal(monitor.snapshot().sessions[0].state, 'interrupted');
});
test('incremental JSONL buffers incomplete UTF-8 lines, then recovers on truncate', () => {
  const { dir, monitor } = fixture(); const file = path.join(dir, 'rollout.jsonl'), at = Date.now();
  const started = event('task_started', at); fs.writeFileSync(file, started.slice(0, -8));
  monitor.readRollout(file, 'one'); assert.equal(monitor.snapshot().sessions.length, 0);
  fs.appendFileSync(file, started.slice(-8)); monitor.readRollout(file, 'one'); assert.equal(monitor.snapshot().sessions[0].state, 'running');
  fs.appendFileSync(file, event('task_complete', at + 10)); monitor.readRollout(file, 'one'); assert.equal(monitor.snapshot().sessions[0].state, 'completed');
  fs.writeFileSync(file, event('task_started', at + 20)); monitor.readRollout(file, 'one'); assert.equal(monitor.snapshot().sessions[0].state, 'running');
});
test('out of order events never turn a completed task back into running', () => {
  const { monitor } = fixture(); const at = Date.now();
  monitor.apply('one', 'task_complete', at + 5); monitor.apply('one', 'task_started', at);
  assert.equal(monitor.snapshot().sessions[0].state, 'completed');
  monitor.apply('one', 'task_started', at + 5);
  assert.equal(monitor.snapshot().sessions[0].state, 'completed');
});
test('recent unknown rollouts recover a precise start before the initial tail without guessing from tools', () => {
  const { dir, monitor } = fixture(), at = Date.now(), file = path.join(dir, 'long.jsonl');
  const header = JSON.stringify({ type: 'session_meta', payload: { id: 'one', cwd: '/tmp' } }) + '\n';
  const noise = JSON.stringify({ type: 'response_item', payload: { type: 'function_call', arguments: 'x'.repeat(16384) } }) + '\n';
  fs.writeFileSync(file, header + event('task_started', at) + noise.repeat(75));
  monitor.readRollout(file, 'one');
  assert.equal(monitor.snapshot().sessions[0].state, 'running');
  assert.equal(monitor.snapshot().sessions[0].startedAt, at);
  monitor.recordLine(JSON.stringify({ type: 'response_item', timestamp: new Date(at).toISOString(), payload: { type: 'function_call' } }), 'two');
  assert.equal(monitor.sessions.has('two'), false);
});
test('subagent session metadata excludes its rollout from main-session cards', () => {
  const { dir, monitor } = fixture(), file = path.join(dir, 'child.jsonl');
  fs.writeFileSync(file, JSON.stringify({ type: 'session_meta', payload: { id: 'child', source: { subagent: { parent: 'root' } }, cwd: '/tmp' } }) + '\n' + event('task_started', Date.now()));
  monitor.readRollout(file, 'child');
  assert.equal(monitor.snapshot().sessions.length, 0);
});
test('hook inbox minimizes data and end-to-end scan persists completion', async () => {
  const { dir, monitor } = fixture(); const dataDir = path.join(dir, 'data');
  writeEvent({ session_id: 'one', hook_event_name: 'Stop', cwd: '/tmp/project', prompt: 'private text', last_assistant_message: 'private reply' }, dataDir);
  const file = path.join(dataDir, 'inbox', fs.readdirSync(path.join(dataDir, 'inbox'))[0]);
  const content = fs.readFileSync(file, 'utf8'); assert.ok(!content.includes('private'));
  await monitor.scan(); assert.equal(monitor.snapshot().sessions[0].state, 'completed');
  assert.equal(new SessionMonitor({ dataDir }).snapshot().sessions[0].state, 'completed');
});
test('hooks installer preserves unrelated groups, deduplicates, backs up and uninstalls only owned groups', () => {
  const { dir } = fixture(); const codexHome = path.join(dir, 'codex'); fs.mkdirSync(codexHome);
  const file = path.join(codexHome, 'hooks.json'), other = { hooks: [{ type: 'command', command: 'echo keep' }] };
  fs.writeFileSync(file, JSON.stringify({ custom: 'keep', hooks: { Stop: [other] } }));
  const first = updateHooks({ codexHome }); assert.ok(fs.existsSync(first.backup));
  updateHooks({ codexHome }); const config = JSON.parse(fs.readFileSync(file));
  assert.equal(config.custom, 'keep'); assert.equal(config.hooks.Stop.length, 2);
  updateHooks({ codexHome, uninstall: true }); assert.deepEqual(JSON.parse(fs.readFileSync(file)).hooks.Stop, [other]);
});
test('invalid hook config is not overwritten', () => {
  const { dir } = fixture(); fs.mkdirSync(path.join(dir, 'codex'));
  const file = path.join(dir, 'codex', 'hooks.json'); fs.writeFileSync(file, '{broken');
  assert.throws(() => updateHooks({ codexHome: path.join(dir, 'codex') })); assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});
test('failed persistence retains hook inbox for a later retry', async () => {
  const { dir, monitor } = fixture(), dataDir = path.join(dir, 'data');
  writeEvent({ session_id: 'one', hook_event_name: 'Stop' }, dataDir);
  const save = monitor.store.save.bind(monitor.store);
  monitor.store.save = () => { throw new Error('disk temporarily unavailable'); };
  await monitor.scan();
  assert.equal(fs.readdirSync(path.join(dataDir, 'inbox')).length, 1);
  assert.equal(monitor.snapshot().health.status, 'degraded');
  monitor.store.save = save;
  await monitor.scan();
  assert.equal(fs.readdirSync(path.join(dataDir, 'inbox')).length, 0);
  assert.equal(new SessionMonitor({ dataDir }).snapshot().sessions[0].state, 'completed');
});
test('desktop originator takes priority and name is used instead of initial prompt', async () => {
  const { dir, monitor } = fixture(), home = path.join(dir, 'codex'); fs.mkdirSync(home);
  execFileSync('/usr/bin/sqlite3', [path.join(home, 'state_5.sqlite'), `CREATE TABLE threads(id TEXT,title TEXT,name TEXT,cwd TEXT,rollout_path TEXT,source TEXT,updated_at INTEGER,archived INTEGER,originator TEXT,agent_path TEXT);
    INSERT INTO threads VALUES('desktop','initial prompt','会话名称','/tmp/project','/missing','exec',10,0,'Codex Desktop',NULL);
    INSERT INTO threads VALUES('automation','automation prompt',NULL,'/tmp/project','/missing2','exec',20,0,'codex_exec',NULL);
    INSERT INTO threads VALUES('legacy','legacy prompt',NULL,'/tmp/project','/missing3','exec',30,0,NULL,NULL);`]);
  monitor.ensure('automation').state = 'completed';
  await monitor.readMetadata();
  const sessions = monitor.snapshot().sessions;
  assert.equal(sessions.length, 1); assert.equal(sessions[0].title, '会话名称');
  assert.equal(monitor.files.size, 1); assert.equal(monitor.desktopOnly, true);
});
test('legacy database without name or originator falls back to title, index supplies latest name', async () => {
  const { dir, monitor } = fixture(), home = path.join(dir, 'codex'); fs.mkdirSync(home);
  execFileSync('/usr/bin/sqlite3', [path.join(home, 'state_5.sqlite'), `CREATE TABLE threads(id TEXT,title TEXT,cwd TEXT,rollout_path TEXT,source TEXT,updated_at INTEGER,archived INTEGER);
    INSERT INTO threads VALUES('legacy','initial prompt','/tmp/project','/missing','exec',10,0);`]);
  await monitor.readMetadata(); assert.equal(monitor.snapshot().sessions[0].title, 'initial prompt');
  fs.writeFileSync(path.join(home, 'session_index.jsonl'), [
    { id: 'legacy', thread_name: '旧名称' }, { id: 'legacy', thread_name: '最新会话名称' }
  ].map(row => JSON.stringify(row)).join('\n'));
  monitor.readNameIndex(); assert.equal(monitor.snapshot().sessions[0].title, '最新会话名称');
});
test('explicit database name wins over stale name index', async () => {
  const { dir, monitor } = fixture(); monitor.ensure('one').title = '当前名称'; monitor.explicitNames.add('one');
  fs.mkdirSync(path.join(dir, 'codex')); fs.writeFileSync(path.join(dir, 'codex', 'session_index.jsonl'), JSON.stringify({ id: 'one', thread_name: '旧名称' }));
  monitor.readNameIndex(); assert.equal(monitor.snapshot().sessions[0].title, '当前名称');
});
