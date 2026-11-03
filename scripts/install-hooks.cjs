const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const EVENTS = ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Stop', 'Interrupt'];
const MARKER = 'Codex Session Clothesline';
const quote = text => "'" + String(text).replaceAll("'", "'\\''") + "'";

function updateHooks({ codexHome = path.join(os.homedir(), '.codex'), dataDir, uninstall = false, nodePath = process.execPath } = {}) {
  const file = path.join(codexHome, 'hooks.json');
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const config = existing ? JSON.parse(existing) : {};
  if (!config || Array.isArray(config) || typeof config !== 'object') throw new Error('hooks.json 必须是 JSON 对象');
  if (config.hooks !== undefined && (!config.hooks || Array.isArray(config.hooks) || typeof config.hooks !== 'object')) throw new Error('hooks 字段格式不正确，未修改配置');
  config.hooks ||= {};
  const script = path.join(__dirname, 'hook-bridge.cjs');
  const command = `${quote(nodePath)} ${quote(script)}${dataDir ? ' ' + quote(dataDir) : ''}`;
  for (const event of EVENTS) {
    const groups = config.hooks[event] || [];
    if (!Array.isArray(groups)) throw new Error(`${event} 配置不是数组，未修改配置`);
    config.hooks[event] = groups.flatMap(group => {
      if (group && group.description === MARKER) return [];
      if (!group || !Array.isArray(group.hooks)) return [group];
      const hooks = group.hooks.filter(hook => !(hook.statusMessage === MARKER && typeof hook.command === 'string' && hook.command.includes('hook-bridge.cjs')));
      return hooks.length ? [{ ...group, hooks }] : [];
    });
    if (!uninstall) config.hooks[event].push({ hooks: [{ type: 'command', command, timeout: 3, statusMessage: MARKER }] });
    if (!config.hooks[event].length) delete config.hooks[event];
  }
  const next = JSON.stringify(config, null, 2) + '\n';
  if (existing === next) return { changed: false, file };
  fs.mkdirSync(codexHome, { recursive: true, mode: 0o700 });
  const backup = existing === null ? null : `${file}.clothesline-${Date.now()}-${randomUUID()}.bak`;
  if (backup) fs.writeFileSync(backup, existing, { mode: 0o600, flag: 'wx' });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, next, { mode: 0o600 }); fs.renameSync(temporary, file);
  return { changed: true, file, backup };
}
if (require.main === module) {
  try { console.log(JSON.stringify(updateHooks({ uninstall: process.argv.includes('--uninstall') }), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { updateHooks };
