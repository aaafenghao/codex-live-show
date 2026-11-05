const test=require('node:test'),assert=require('node:assert/strict');
const {InteractionGate}=require('../src/interaction-gate.js');
test('session updates cannot replace a pressed card before its click is dispatched',()=>{
 const events=[],gate=new InteractionGate();
 gate.begin();gate.request(()=>events.push('old-render'));gate.request(()=>events.push('latest-render'));
 events.push('open-session-click');assert.deepEqual(events,['open-session-click']);
 gate.end();assert.deepEqual(events,['open-session-click','latest-render']);
});
