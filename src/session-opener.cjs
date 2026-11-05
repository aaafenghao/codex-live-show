const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {promisify}=require('node:util'),{execFile}=require('node:child_process');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class SessionOpener{
 constructor({shell,platform=process.platform,exists=fs.existsSync,run=promisify(execFile),getApplicationInfo,codexHome=null}={}){Object.assign(this,{shell,platform,exists,run,getApplicationInfo,codexHome});this.pending=new Map();}
 open(id){
  if(typeof id!=='string'||!UUID.test(id))return Promise.resolve({ok:false,error:'会话标识无效，不能打开对应对话'});
  if(this.pending.has(id))return this.pending.get(id);
  const request=this.launch(id).finally(()=>this.pending.delete(id));this.pending.set(id,request);return request;
 }
 async launch(id){
  if(this.codexHome){const db=path.join(this.codexHome,'state_5.sqlite');if(this.exists(db)){try{const result=await this.run('/usr/bin/sqlite3',['-readonly',db,"SELECT EXISTS(SELECT 1 FROM threads WHERE id='"+id+"');"],{timeout:3000,maxBuffer:4096});if(result.stdout.trim()!=='1')return{ok:false,error:'会话已被删除或不在当前本机索引中，请刷新后重试'};}catch{return{ok:false,error:'暂时无法读取本地会话索引，请稍后重试'};}}}
  const url='codex://threads/'+id;
  try{
   if(this.platform==='darwin'){
    const paths=['/Applications/ChatGPT.app','/Applications/Codex.app',path.join(os.homedir(),'Applications/ChatGPT.app'),path.join(os.homedir(),'Applications/Codex.app')];
    let target=paths.find(p=>this.exists(p));
    if(!target&&this.getApplicationInfo){const info=await this.getApplicationInfo(url);if(info?.path&&['ChatGPT.app','Codex.app'].includes(path.basename(info.path))&&this.exists(info.path))target=info.path;}
    if(!target)return{ok:false,error:'未找到 Codex/ChatGPT 桌面应用，请先安装或打开一次应用'};
    await this.run('/usr/bin/open',['-a',target,url],{timeout:10000,maxBuffer:65536});
   }else await this.shell.openExternal(url,{activate:true});
   return{ok:true};
  }catch{return{ok:false,error:'打开 Codex 失败，请确认桌面应用能正常启动后重试'};}
 }
}
module.exports={SessionOpener};
