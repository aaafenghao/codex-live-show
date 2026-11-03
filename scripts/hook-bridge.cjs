const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const DATA_DIR = path.join(os.homedir(), 'Library/Application Support/Codex Session Clothesline');
const ALLOWED = new Set(['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Stop', 'Interrupt']);

function writeEvent(input, dataDir = DATA_DIR) {
  if (!input || !ALLOWED.has(input.hook_event_name) || typeof input.session_id !== 'string' || !input.session_id || input.session_id.length > 200) return false;
  const event = { session_id: input.session_id, hook_event_name: input.hook_event_name, timestamp: new Date().toISOString() };
  for (const key of ['cwd', 'turn_id', 'transcript_path']) if (typeof input[key] === 'string' && input[key].length < 8192) event[key] = input[key];
  const inbox = path.join(dataDir, 'inbox'); fs.mkdirSync(inbox, { recursive: true, mode: 0o700 });
  const temporary = path.join(inbox, `${randomUUID()}.tmp`);
  fs.writeFileSync(temporary, JSON.stringify(event), { mode: 0o600 }); fs.renameSync(temporary, temporary.replace(/\.tmp$/, '.json'));
  return true;
}
if (require.main === module) {
  let input = '', tooLarge = false;
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { if (input.length + chunk.length > 1024 * 1024) tooLarge = true; else input += chunk; });
  process.stdin.on('end', () => {
    try { if (!tooLarge) writeEvent(JSON.parse(input), process.argv[2] || DATA_DIR); } catch { /* Hooks remain advisory if disk or input is unavailable. */ }
    process.stdout.write('{}');
  });
}
module.exports = { writeEvent };
