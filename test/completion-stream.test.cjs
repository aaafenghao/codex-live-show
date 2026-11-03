const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {SessionMonitor}=require('../src/monitor.cjs');
const {CompletionDetector}=require('../src/completion-detector.cjs');
test('a completion followed immediately by a new task still celebrates once',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'clothesline-stream-'));
 const monitor=new SessionMonitor({codexHome:path.join(dir,'codex'),dataDir:dir});
 const at=Date.now(),detector=new CompletionDetector(at);
 detector.update([],at);let count=0;
 monitor.on('completed',s=>{if(detector.completion(s,at+1000))count++;});
 monitor.apply('stream-session','task_started',at+100);
 monitor.apply('stream-session','task_complete',at+500);
 monitor.apply('stream-session','task_started',at+501);
 assert.equal(monitor.snapshot().sessions[0].state,'running');
 assert.equal(count,1);
 detector.update(monitor.snapshot().sessions,at+1000);
 assert.equal(count,1);
});
