const test=require('node:test'),assert=require('node:assert/strict');
const {CompletionDetector}=require('../src/completion-detector.cjs');
const start=Date.parse('2026-10-31T05:00:00Z');
const session=(id,state,at)=>({id,state,updatedAt:at,completedAt:state==='completed'?at:null});
test('startup history and duplicate snapshots never celebrate',()=>{
 const d=new CompletionDetector(start),rows=[session('old','completed',start-20000)];
 assert.deepEqual(d.update(rows,start),[]);
 assert.deepEqual(d.update(rows,start+1000),[]);
 assert.deepEqual(d.update([...rows,session('older','completed',start-10000)],start+2000),[]);
});
test('a precise new completion fires once, including fast repeated turns',()=>{
 const d=new CompletionDetector(start);d.update([session('a','running',start)],start);
 assert.deepEqual(d.update([session('a','completed',start+1000)],start+1000),['a']);
 assert.deepEqual(d.update([session('a','completed',start+1000)],start+2000),[]);
 assert.deepEqual(d.update([session('a','completed',start+4000)],start+4000),['a']);
});
test('interrupted, unknown, stale and future events never celebrate',()=>{
 const d=new CompletionDetector(start);d.update([],start);
 assert.deepEqual(d.update([session('i','interrupted',start+2000),session('u','unknown',start+2000),session('stale','completed',start+1000),session('future','completed',start+90000)],start+40000),[]);
});
test('multiple completions are delivered together for one celebration',()=>{
 const d=new CompletionDetector(start);d.update([],start);
 assert.deepEqual(d.update([session('a','completed',start+1000),session('b','completed',start+1100)],start+2000),['a','b']);
});
