const test=require('node:test'),assert=require('node:assert/strict');
const {WindowInput}=require('../src/window-input.cjs');
function fixture(){const calls=[];let point={x:1510,y:100};const window={isDestroyed:()=>false,getContentBounds:()=>({x:1500,y:80,width:720,height:600}),webContents:{getZoomFactor:()=>1.5},setIgnoreMouseEvents:value=>calls.push(value)};const screen={getCursorScreenPoint:()=>point};return{calls,input:new WindowInput({window,screen}),move:p=>point=p};}
test('clickable region restores ignored input without any renderer mouse event',()=>{
 const {calls,input,move}=fixture();input.tick();assert.deepEqual(calls,[true]);
 input.setRegions([{x:10,y:10,width:70,height:30}]);move({x:1530,y:110});input.tick();assert.equal(calls.at(-1),false);
 move({x:1800,y:400});input.tick();assert.equal(calls.at(-1),true);input.stop();
});
test('native screen coordinates honor zoom and negative display origins',()=>{
 const calls=[];let p={x:-970,y:130};const input=new WindowInput({window:{isDestroyed:()=>false,getContentBounds:()=>({x:-1000,y:100,width:720,height:600}),webContents:{getZoomFactor:()=>1.5},setIgnoreMouseEvents:v=>calls.push(v)},screen:{getCursorScreenPoint:()=>p}});
 input.setRegions([{x:10,y:10,width:20,height:20}]);input.tick();assert.equal(calls.at(-1),false);p={x:-900,y:130};input.tick();assert.equal(calls.at(-1),true);
});
test('invalid hit regions cannot force a whole screen input capture',()=>{
 const {input,calls}=fixture();input.setRegions([{x:NaN,y:0,width:100,height:100},{x:0,y:0,width:-1,height:20}]);input.tick();assert.equal(calls.at(-1),true);
});
test('pointer capture keeps mouse input enabled until the drag ends',()=>{
 const {input,calls,move}=fixture();input.setHeld(true);move({x:9999,y:9999});input.tick();assert.equal(calls.at(-1),false);input.setHeld(false);assert.equal(calls.at(-1),true);
});
test('solid board captures blank areas and restores transparent hit testing when disabled',()=>{
 const {input,calls,move}=fixture();input.setRegions([{x:10,y:10,width:70,height:30}]);move({x:1800,y:400});input.tick();assert.equal(calls.at(-1),true);
 assert.equal(typeof input.setCaptureAll,'function');input.setCaptureAll(true);assert.equal(calls.at(-1),false);
 move({x:3000,y:400});input.tick();assert.equal(calls.at(-1),false);
 move({x:1800,y:400});input.tick();assert.equal(calls.at(-1),false);
 input.setCaptureAll(false);assert.equal(calls.at(-1),true);
});
