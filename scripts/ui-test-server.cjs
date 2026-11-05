const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..','src');
let dismissed={};const now=Date.now();let calls={moves:[],opens:[],height:0};let data={sessions:[
{id:'test-running-1',title:'修复任务回调状态',cwd:'/Users/demo/projects/backend/task-service',state:'running',phase:'执行工具',startedAt:now-95000,updatedAt:now},
{id:'test-complete-1',title:'优化工作台筛选交互',cwd:'/Users/demo/idea_workspace/fde/workbench',state:'completed',completedAt:now-60000,updatedAt:now-60000},
{id:'test-unknown-1',title:'待确认会话',cwd:'/Users/demo/idea_workspace/tools/mapper',state:'unknown',updatedAt:now-200000}
],health:{status:'degraded',message:'界面测试数据，非实际会话'}};
const bridge=`window.clothesline={snapshot:async()=>fetch('/snapshot').then(r=>r.json()),getPreferences:async()=>({dismissedCompletions:JSON.parse(localStorage.getItem('dismissed')||'{}')}),savePreferences:async v=>v,setScale:async v=>v,setPinned:async v=>v,home:()=>{},quit:()=>{},setMousePassthrough:()=>{},resize:h=>fetch('/call',{method:'POST',body:JSON.stringify({height:h})}),move:d=>fetch('/call',{method:'POST',body:JSON.stringify({move:d})}),dismissCompleted:async id=>{const s=(await fetch('/snapshot').then(r=>r.json())).sessions.find(s=>s.id===id);if(!s||s.state!=='completed')return{ok:false};dismissedFixture=JSON.parse(localStorage.getItem('dismissed')||'{}');dismissedFixture[id]=new Date(s.completedAt).toISOString();localStorage.setItem('dismissed',JSON.stringify(dismissedFixture));return{ok:true,dismissed:dismissedFixture}},openSession:async id=>{await fetch('/call',{method:'POST',body:JSON.stringify({open:id})});return{ok:true}},onChange:cb=>{let last='';setInterval(async()=>{const r=await fetch('/snapshot');const v=await r.text();if(v!==last){last=v;cb(JSON.parse(v))}},350)}};`;
const server=http.createServer((req,res)=>{
res.setHeader('Cache-Control','no-store');
if(req.url==='/snapshot'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(data))}
if(req.url==='/advance'&&req.method==='POST'){data.sessions[0]={...data.sessions[0],state:'completed',phase:'已完成',completedAt:Date.now(),updatedAt:Date.now()};return res.end('ok')}
if(req.url==='/calls'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(calls))}
if(req.url==='/call'&&req.method==='POST'){let b='';req.on('data',d=>b+=d);req.on('end',()=>{const v=JSON.parse(b);if(v.move)calls.moves.push(v.move);if(v.open)calls.opens.push(v.open);if(v.height)calls.height=v.height;res.end('ok')});return}
if(req.url==='/bridge.js'){res.setHeader('Content-Type','application/javascript');return res.end(bridge)}
if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end(fs.readFileSync(path.join(root,'index.html'),'utf8').replace("connect-src 'none'","connect-src 'self'").replace('<script src="renderer.js">','<script src="bridge.js"></script><script src="renderer.js">'))}
if(['/style.css','/renderer.js','/completed-cards.js'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'application/javascript');return res.end(fs.readFileSync(path.join(root,req.url.slice(1))))}
res.statusCode=404;res.end();
});server.listen(0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port));
