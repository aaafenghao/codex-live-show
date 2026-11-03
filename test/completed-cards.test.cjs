const test=require('node:test');
const assert=require('node:assert/strict');
const {dayKey,completionStamp,visibleCompleted}=require('../src/completed-cards.js');
const now=Date.parse('2026-10-31T15:59:59Z');
const completed=(id,at)=>({id,state:'completed',completedAt:Date.parse(at),updatedAt:Date.parse(at)});
test('today means Shanghai calendar day, including UTC boundary',()=>{
 const rows=[completed('today','2026-10-30T16:00:00Z'),completed('yesterday','2026-10-30T15:59:59Z'),completed('tomorrow','2026-10-31T16:00:00Z')];
 assert.deepEqual(visibleCompleted(rows,{},now).map(s=>s.id),['today']);
 assert.equal(dayKey(Date.parse('2026-10-31T16:00:00Z')),'2026-11-01');
});
test('dismissal hides one completion without deleting history or a later turn',()=>{
 const s=completed('same','2026-10-31T02:00:00Z'),rows=[s],hidden={same:completionStamp(s)};
 assert.equal(visibleCompleted(rows,hidden,now).length,0);
 assert.equal(rows.length,1);
 const later=completed('same','2026-10-31T03:00:00Z');
 assert.equal(visibleCompleted([later],hidden,now).length,1);
 assert.equal(visibleCompleted(rows,JSON.parse(JSON.stringify(hidden)),now).length,0);
});
test('running, interrupted and invalid timestamps are not completed cards',()=>{
 const rows=[{id:'run',state:'running',updatedAt:now},{id:'stop',state:'interrupted',completedAt:now},{id:'bad',state:'completed',completedAt:'invalid'}];
 assert.deepEqual(visibleCompleted(rows,{},now),[]);
});
