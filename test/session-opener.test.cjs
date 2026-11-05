const test=require('node:test'),assert=require('node:assert/strict');
const {SessionOpener}=require('../src/session-opener.cjs');
const id='00000000-0000-4000-8000-000000000001';
test('macOS targets the Codex app explicitly instead of an arbitrary URL handler',async()=>{
 const calls=[];const opener=new SessionOpener({platform:'darwin',exists:p=>p==='/Applications/ChatGPT.app',run:async(...args)=>calls.push(args),shell:{openExternal:async()=>assert.fail('must explicitly activate installed app')}});
 assert.equal((await opener.open(id)).ok,true);
 assert.deepEqual(calls[0].slice(0,2),['/usr/bin/open',['-a','/Applications/ChatGPT.app','codex://threads/'+id]]);
});
test('invalid IDs do not launch an app or execute a command',async()=>{
 const opener=new SessionOpener({run:()=>assert.fail('no command'),shell:{openExternal:()=>assert.fail('no URL')}});
 assert.equal((await opener.open('new')).ok,false);assert.equal((await opener.open('../settings')).ok,false);
});
test('deleted cached sessions are reported before launching Codex',async()=>{
 let calls=0;const opener=new SessionOpener({platform:'darwin',codexHome:'/test/codex',exists:()=>true,run:async(command)=>{calls++;assert.equal(command,'/usr/bin/sqlite3');return{stdout:'0\n'}}});
 const result=await opener.open(id);assert.equal(result.ok,false);assert.match(result.error,/删除/);assert.equal(calls,1);
});
test('rapid duplicate opens share one launch and failures are reported',async()=>{
 let finish,calls=0;const opener=new SessionOpener({platform:'darwin',exists:()=>true,run:()=>{calls++;return new Promise(r=>finish=r)}});
 const a=opener.open(id),b=opener.open(id);assert.equal(calls,1);finish();assert.equal((await a).ok,true);assert.equal((await b).ok,true);
 const failed=new SessionOpener({platform:'darwin',exists:()=>true,run:async()=>{throw Error('launch failed')}});
 assert.equal((await failed.open(id)).ok,false);
});
