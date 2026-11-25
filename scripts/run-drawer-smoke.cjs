const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'live-show-drawer-'));
const data=path.join(temporary,'data'),codex=path.join(temporary,'codex'),now=Date.now();
fs.mkdirSync(data);fs.mkdirSync(codex);
const sessions=[
{id:'run',title:'检查接口响应与任务回调',cwd:'/Users/demo/projects/api-service',state:'running',startedAt:now-90000,updatedAt:now},
{id:'run-two',title:'核对分页与排序',cwd:'/Users/demo/projects/api-service',state:'running',startedAt:now-120000,updatedAt:now-500},
{id:'input',title:'选择发布方案后继续执行',cwd:'/Users/demo/projects/release',state:'waiting',waitReason:'input',phase:'需要输入',updatedAt:now-1000},
{id:'approve',title:'审批命令执行权限',cwd:'/Users/demo/projects/app',state:'waiting',waitReason:'approval',phase:'等待审批',updatedAt:now-2000},
{id:'done',title:'完成列表与筛选功能',cwd:'/Users/demo/projects/web',state:'completed',completedAt:now-60000,updatedAt:now-60000}];
fs.writeFileSync(path.join(data,'sessions.json'),JSON.stringify({version:1,sessions}));
fs.writeFileSync(path.join(data,'preferences.json'),JSON.stringify({layout:'board',drawerCollapsed:true,scale:.8,paused:true,fireworksMode:'off'}));
try{
  const result=spawnSync(require('electron'),[root,'--drawer-smoke'],{cwd:root,env:{...process.env,CLOTHESLINE_DATA_DIR:data,CODEX_HOME:codex},stdio:'inherit',timeout:45000});
  if(result.error)console.error(result.error.message);
  process.exitCode=result.status??1;
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
