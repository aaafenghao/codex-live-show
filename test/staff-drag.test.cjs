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
test('release coordinates finish a drag even when native move events were omitted',()=>{
 const {drag,calls}=fixture();drag.down({x:3008,y:68});drag.up({x:2948,y:118});
 assert.deepEqual(calls,[['start',{x:3008,y:68}],['move',{x:2948,y:118}],['end',true]]);
});
test('release jitter stays a click and repeated release never moves twice',()=>{
 const {drag,calls}=fixture();drag.down({x:200,y:100});drag.up({x:202,y:101});drag.up({x:300,y:200});assert.deepEqual(calls,[['start',{x:200,y:100}],['end',false]]);
});
