const fs = require('node:fs');
const path = require('node:path');

class SessionStore {
  constructor(dataDir) { this.file = path.join(dataDir, 'sessions.json'); this.error = null; }
  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (parsed.version !== 1 || !Array.isArray(parsed.sessions) || parsed.sessions.some(s => !s || typeof s.id !== 'string')) throw new Error('invalid session store');
      return parsed.sessions;
    } catch (error) {
      if (error.code !== 'ENOENT') this.error = '会话记录损坏，已保留原文件；请备份后修复 sessions.json。';
      return [];
    }
  }
  save(sessions) {
    if (this.error) throw new Error(this.error);
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const temporary = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({ version: 1, sessions }), { mode: 0o600 });
    fs.renameSync(temporary, this.file);
  }
}
module.exports = { SessionStore };
