const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { StringDecoder } = require('node:string_decoder');
const { SessionStore } = require('./store.cjs');
const run = promisify(execFile);
const DEFAULT_DATA_DIR = path.join(os.homedir(), 'Library/Application Support/Codex Session Clothesline');
const STATES = new Set(['running', 'completed', 'interrupted', 'unknown']);

class SessionMonitor extends EventEmitter {
  constructor({ codexHome = path.join(os.homedir(), '.codex'), dataDir = DEFAULT_DATA_DIR, interval = 2000 } = {}) {
    super(); this.codexHome = codexHome; this.dataDir = dataDir; this.interval = interval;
    this.store = new SessionStore(dataDir);
    this.sessions = new Map(this.store.load().filter(s => STATES.has(s.state)).map(s => [s.id, s]));
    this.cursors = new Map(); this.files = new Map(); this.excluded = new Set(); this.busy = false; this.pendingInbox = []; this.needsSave = false;
    this.desktopOnly = false; this.desktopIds = new Set(); this.explicitNames = new Set();
    this.health = { status: 'starting', source: 'local', lastScanAt: null, message: this.store.error || '' };
  }
  snapshot() {
    return { sessions: [...this.sessions.values()].filter(s => !this.desktopOnly || this.desktopIds.has(s.id) || s.originator === 'Codex Desktop').map(s => ({ ...s })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)), health: { ...this.health } };
  }
  async start() {
    if (this.timer) return this.snapshot();
    fs.mkdirSync(path.join(this.dataDir, 'inbox'), { recursive: true, mode: 0o700 });
    await this.scan();
    this.timer = setInterval(() => this.scan(), this.interval); this.timer.unref?.();
    return this.snapshot();
  }
  stop() { clearInterval(this.timer); this.timer = null; }
  ensure(id, cwd = '') {
    if (typeof id !== 'string' || !id || id.length > 200) return null;
    let s = this.sessions.get(id);
    if (!s) { s = { id, title: '未命名会话', cwd, state: 'unknown', phase: '等待状态', startedAt: null, completedAt: null, updatedAt: 0 }; this.sessions.set(id, s); }
    if (cwd) s.cwd = cwd;
    return s;
  }
  apply(id, kind, at, fields = {}) {
    if (this.excluded.has(id)) return;
    if (this.desktopOnly && !this.desktopIds.has(id) && this.sessions.get(id)?.originator !== 'Codex Desktop') return;
    const s = this.ensure(id, fields.cwd); if (!s) return;
    const time = Number.isFinite(at) && at > 0 ? at : Date.now();
    if (time < (s.updatedAt || 0)) return;
    if (time === s.updatedAt && ['completed', 'interrupted'].includes(s.state) && ['task_started', 'UserPromptSubmit', 'PermissionRequest', 'PreToolUse', 'PostToolUse'].includes(kind) && (!fields.turnId || fields.turnId === s.turnId)) return;
    switch (kind) {
      case 'task_started': case 'UserPromptSubmit':
        s.state = 'running'; s.phase = '思考中'; s.startedAt = time; s.completedAt = null; break;
      case 'task_complete': case 'Stop':
        s.state = 'completed'; s.phase = '已完成'; s.completedAt = time; break;
      case 'turn_aborted': case 'Interrupt':
        s.state = 'interrupted'; s.phase = '已中断'; s.completedAt = time; break;
      case 'PermissionRequest':
        s.state = 'running'; s.phase = '等待审批'; break;
      case 'PreToolUse':
        if (s.state !== 'running') return;
        s.phase = '执行工具'; break;
      case 'PostToolUse':
        if (s.state !== 'running') return;
        s.phase = '处理中'; break;
      case 'SessionStart': return;
      case 'SessionEnd':
        if (s.state === 'running') { s.state = 'unknown'; s.phase = '会话已关闭'; }
        else return;
        break;
      default: return;
    }
    s.updatedAt = time;
    if (typeof fields.turnId === 'string') s.turnId = fields.turnId;
    if (kind === 'task_complete' || kind === 'Stop') this.emit('completed', { ...s });
  }
  recordLine(line, fallbackId) {
    let row; try { row = JSON.parse(line); } catch { return; }
    if (row.type === 'session_meta' && row.payload) {
      const meta = row.payload, id = meta.id || fallbackId;
      const source = typeof meta.source === 'string' ? meta.source : JSON.stringify(meta.source || '');
      if (source.includes('subagent') || source.includes('sub_agent') || (meta.agent_path && meta.agent_path !== '/root')) {
        this.excluded.add(id); this.sessions.delete(id); return;
      }
      const s = this.ensure(id, meta.cwd);
      if (s && !this.explicitNames.has(id) && typeof meta.title === 'string') s.title = meta.title;
      return;
    }
    if (row.type !== 'event_msg' || !row.payload) return;
    this.apply(fallbackId, row.payload.type, Date.parse(row.timestamp), { turnId: row.payload.turn_id });
  }
  readRollout(file, id) {
    if (this.excluded.has(id)) return;
    const stat = fs.statSync(file); let cursor = this.cursors.get(file);
    if (!cursor || stat.size < cursor.offset || stat.ino !== cursor.ino) {
      const headerFd = fs.openSync(file, 'r');
      try {
        const header = Buffer.alloc(Math.min(65536, stat.size));
        const bytes = fs.readSync(headerFd, header, 0, header.length, 0);
        const text = header.subarray(0, bytes).toString('utf8');
        const firstNewline = text.indexOf('\n');
        if (firstNewline >= 0) this.recordLine(text.slice(0, firstNewline), id);
      } finally { fs.closeSync(headerFd); }
      if (this.excluded.has(id)) return;
      // shortcut: initial history reads the last 1 MiB; very old starts outside that tail stay unknown.
      cursor = { offset: Math.max(0, stat.size - 1024 * 1024), ino: stat.ino, tail: '', decoder: new StringDecoder('utf8'), skipFirst: stat.size > 1024 * 1024, initialOffset: Math.max(0, stat.size - 1024 * 1024), recovered: false };
    }
    if (stat.size === cursor.offset) return;
    const fd = fs.openSync(file, 'r');
    try {
      const size = Math.min(stat.size - cursor.offset, 2 * 1024 * 1024), buffer = Buffer.alloc(size);
      const bytes = fs.readSync(fd, buffer, 0, size, cursor.offset); cursor.offset += bytes;
      const lines = (cursor.tail + cursor.decoder.write(buffer.subarray(0, bytes))).split('\n');
      cursor.tail = lines.pop();
      if (cursor.skipFirst) { lines.shift(); cursor.skipFirst = false; }
      for (const line of lines) this.recordLine(line, id);
      if (cursor.tail.length > 4 * 1024 * 1024) cursor.tail = '';
      if (!cursor.recovered && cursor.offset >= stat.size) {
        cursor.recovered = true;
        if (this.sessions.get(id)?.state === 'unknown' && stat.mtimeMs > Date.now() - 10 * 60000 && cursor.initialOffset > 0) this.recoverRecentState(fd, id, cursor.initialOffset);
      }
      this.cursors.set(file, cursor);
    } finally { fs.closeSync(fd); }
  }
  recoverRecentState(fd, id, end) {
    const floor = Math.max(0, end - 16 * 1024 * 1024); let position = end, carry = '';
    while (position > floor) {
      const start = Math.max(floor, position - 128 * 1024), buffer = Buffer.alloc(position - start);
      fs.readSync(fd, buffer, 0, buffer.length, start);
      const lines = (buffer.toString('utf8') + carry).split('\n');
      carry = start > 0 ? lines.shift() : '';
      for (let index = lines.length - 1; index >= 0; index--) {
        let row; try { row = JSON.parse(lines[index]); } catch { continue; }
        if (row.type === 'event_msg' && ['task_started', 'task_complete', 'turn_aborted'].includes(row.payload?.type)) {
          this.apply(id, row.payload.type, Date.parse(row.timestamp), { turnId: row.payload.turn_id }); return;
        }
      }
      position = start;
    }
  }
  async readMetadata() {
    const db = path.join(this.codexHome, 'state_5.sqlite');
    if (!fs.existsSync(db)) return false;
    if (!this.columns) {
      const result = await run('/usr/bin/sqlite3', ['-readonly', '-json', db, 'PRAGMA table_info(threads)'], { timeout: 5000 });
      this.columns = new Set(JSON.parse(result.stdout || '[]').map(column => column.name));
    }
    const hasName = this.columns.has('name'), hasOriginator = this.columns.has('originator');
    const topLevel = "source NOT LIKE '%subagent%' AND source NOT LIKE '%sub_agent%'" + (this.columns.has('agent_path') ? " AND (agent_path IS NULL OR agent_path='' OR agent_path='/root')" : '');
    let desktopOnly = false;
    if (hasOriginator) {
      const count = await run('/usr/bin/sqlite3', ['-readonly', '-json', db, `SELECT COUNT(*) AS n FROM threads WHERE originator='Codex Desktop' AND ${topLevel}`], { timeout: 5000 });
      desktopOnly = JSON.parse(count.stdout || '[]')[0]?.n > 0;
    }
    this.desktopOnly = desktopOnly;
    const where = desktopOnly ? `originator='Codex Desktop' AND ${topLevel}` : `archived=0 AND ${topLevel}`;
    const selection = `id,${hasName ? "COALESCE(NULLIF(name,''),title)" : 'title'} AS title,${hasName ? "NULLIF(name,'')" : 'NULL'} AS explicit_name,cwd,rollout_path,source,updated_at,archived,${hasOriginator ? 'originator' : 'NULL AS originator'}`;
    const { stdout } = await run('/usr/bin/sqlite3', ['-readonly', '-json', db,
      `SELECT ${selection} FROM threads WHERE ${where} ORDER BY updated_at DESC LIMIT 200`], { maxBuffer: 8 * 1024 * 1024, timeout: 5000 });
    const rows = stdout.trim() ? JSON.parse(stdout) : [];
    this.desktopIds = new Set(desktopOnly ? rows.map(row => row.id) : []);
    this.files.clear();
    for (const row of rows) {
      // Subagent sessions do not become duplicate top-level cards.
      if (String(row.source).includes('subagent') || String(row.source).includes('sub_agent')) { this.excluded.add(row.id); this.sessions.delete(row.id); continue; }
      const s = this.ensure(row.id, row.cwd); if (!s) continue;
      if (typeof row.title === 'string' && row.title.trim()) s.title = row.title;
      if (row.explicit_name) this.explicitNames.add(row.id); else this.explicitNames.delete(row.id);
      s.source = row.source; s.originator = row.originator;
      if (typeof row.rollout_path === 'string') this.files.set(row.rollout_path, row.id);
    }
    return true;
  }
  readNameIndex() {
    const file = path.join(this.codexHome, 'session_index.jsonl');
    if (!fs.existsSync(file)) return;
    const fd = fs.openSync(file, 'r');
    try {
      const size = fs.fstatSync(fd).size, offset = Math.max(0, size - 4 * 1024 * 1024), buffer = Buffer.alloc(size - offset);
      fs.readSync(fd, buffer, 0, buffer.length, offset);
      const lines = buffer.toString('utf8').split('\n'); if (offset) lines.shift();
      for (const line of lines) {
        let record; try { record = JSON.parse(line); } catch { continue; }
        const session = this.sessions.get(record.id);
        if (session && !this.explicitNames.has(record.id) && typeof record.thread_name === 'string' && record.thread_name.trim()) session.title = record.thread_name;
      }
    } finally { fs.closeSync(fd); }
  }
  discover(directory) {
    const candidates = [];
    const visit = (folder, depth = 0) => {
      if (!fs.existsSync(folder) || depth > 5) return;
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        const file = path.join(folder, entry.name);
        if (entry.isDirectory()) visit(file, depth + 1);
        else if (entry.name.endsWith('.jsonl')) {
          const modified = fs.statSync(file).mtimeMs;
          const match = entry.name.match(/([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})\.jsonl$/i);
          if (match && modified > Date.now() - 7 * 86400000) candidates.push({ file, id: match[1], modified });
        }
      }
    };
    visit(directory);
    for (const item of candidates.sort((a, b) => b.modified - a.modified).slice(0, 200)) if (!this.files.has(item.file)) this.files.set(item.file, item.id);
  }
  consumeInbox() {
    const inbox = path.join(this.dataDir, 'inbox');
    for (const name of fs.readdirSync(inbox).filter(n => n.endsWith('.json'))) {
      const file = path.join(inbox, name); let event;
      try { if (fs.statSync(file).size > 16384) continue; event = JSON.parse(fs.readFileSync(file, 'utf8')); }
      catch { continue; }
      this.apply(event.session_id, event.hook_event_name, Date.parse(event.timestamp), { cwd: event.cwd, turnId: event.turn_id });
      if (typeof event.transcript_path === 'string') this.files.set(event.transcript_path, event.session_id);
      this.pendingInbox.push(file);
    }
  }
  async scan() {
    if (this.busy) return; this.busy = true;
    const before = JSON.stringify(this.snapshot().sessions);
    try {
      let indexed = false, indexError = false;
      try { indexed = await this.readMetadata(); } catch { indexError = true; }
      if (!indexed && (!this.discoveredAt || Date.now() - this.discoveredAt > 60000)) { this.discover(path.join(this.codexHome, 'sessions')); this.discoveredAt = Date.now(); }
      for (const [file, id] of this.files) {
        try { this.readRollout(file, id); } catch (e) { if (e.code !== 'ENOENT') indexError = true; }
      }
      this.readNameIndex();
      this.consumeInbox();
      this.health = { status: this.store.error || indexError ? 'degraded' : 'ok', source: indexed ? 'sqlite + jsonl + hooks' : 'jsonl + hooks', lastScanAt: Date.now(), message: this.store.error || (indexError ? '部分本地索引暂不可读，正在使用事件文件。' : '') };
      const changed = before !== JSON.stringify(this.snapshot().sessions);
      let saved = !this.store.error;
      if (changed || this.needsSave) {
        try { this.store.save([...this.sessions.values()]); this.needsSave = false; }
        catch (e) { saved = false; this.needsSave = true; this.health.status = 'degraded'; this.health.message = e.message; }
      }
      if (saved) for (const file of new Set(this.pendingInbox)) { try { fs.unlinkSync(file); } catch {} }
      this.pendingInbox = [];
      this.emit('change', this.snapshot());
    } catch { this.health.status = 'degraded'; this.health.message = '本地会话读取失败，稍后自动重试。'; this.emit('change', this.snapshot()); }
    finally { this.busy = false; }
  }
}
module.exports = { SessionMonitor, DEFAULT_DATA_DIR };
