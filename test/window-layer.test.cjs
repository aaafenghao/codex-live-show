const test=require('node:test'),assert=require('node:assert/strict');
const {setWindowLayer}=require('../src/window-layer.cjs');
test('macOS desktop -> pinned -> desktop restores the below-app layer',()=>{
 const calls=[];const window={setAlwaysOnTop:(...args)=>calls.push(args)};
 setWindowLayer(window,false,'darwin');setWindowLayer(window,true,'darwin');setWindowLayer(window,false,'darwin');
 assert.deepEqual(calls,[[true,'normal',-1],[true,'floating'],[true,'normal',-1]]);
});
test('other platforms disable pinning and lower the window',()=>{
 const calls=[];setWindowLayer({setAlwaysOnTop:(...v)=>calls.push(v),moveBottom:()=>calls.push('bottom')},false,'win32');
 assert.deepEqual(calls,[[false],'bottom']);
});
