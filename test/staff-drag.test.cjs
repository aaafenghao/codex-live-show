const test=require('node:test'),assert=require('node:assert/strict');
const {StaffDrag}=require('../src/staff-drag.js');
function fixture(){const calls=[];return{calls,drag:new StaffDrag({start:p=>calls.push(['start',p]),move:p=>calls.push(['move',p]),end:moved=>calls.push(['end',moved])})};}
test('single clicks and double clicks never move or maximize the window',()=>{
 const {drag,calls}=fixture();
 for(let i=0;i<2;i++){drag.down({x:200,y:100});drag.up();}
 assert.equal(calls.filter(c=>c[0]==='move').length,0);assert.deepEqual(calls.filter(c=>c[0]==='end'),[['end',false],['end',false]]);
});
test('small pointer jitter is a click, dragging starts only past the threshold',()=>{
 const {drag,calls}=fixture();drag.down({x:200,y:100});drag.move({x:202,y:101});assert.equal(calls.filter(c=>c[0]==='move').length,0);
 drag.move({x:220,y:120});drag.move({x:245,y:130});drag.up();assert.deepEqual(calls.at(-1),['end',true]);assert.equal(calls.filter(c=>c[0]==='move').length,2);
});
