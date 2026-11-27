const path=require('node:path');
class Celebration{
 constructor({BrowserWindow,screen,targetDisplay=()=>screen.getPrimaryDisplay(),mode=()=> 'full',scope=()=> 'current',paused=()=>false}){this.BrowserWindow=BrowserWindow;this.screen=screen;this.targetDisplay=targetDisplay;this.mode=mode;this.scope=scope;this.paused=paused;this.windows=new Set();this.pending=null;this.guard=null;this.errors=[];}
 request(){if(this.mode()==='off'||this.paused()||this.pending||this.windows.size)return;this.pending=setTimeout(()=>{this.pending=null;if(!this.paused())this.play();},900);}
 play({preview=false,forceFull=false}={}){
  if(this.windows.size||(!preview&&(this.mode()==='off'||this.paused())))return false;
  clearTimeout(this.pending);this.pending=null;this.errors=[];
  const displays=this.scope()==='all'?this.screen.getAllDisplays():[this.targetDisplay()];
  for(const display of displays){
   const window=new this.BrowserWindow({...display.bounds,frame:false,transparent:true,hasShadow:false,focusable:false,skipTaskbar:true,resizable:false,movable:false,show:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'fireworks-preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
   this.windows.add(window);window.setIgnoreMouseEvents(true);window.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});window.setAlwaysOnTop(true,'screen-saver');
   window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());
   window.webContents.on('console-message',event=>{if(event.level==='error'||event.level===3)this.errors.push(event.message)});
   window.webContents.on('did-fail-load',()=>{if(!window.isDestroyed())window.close()});
   window.once('ready-to-show',()=>{if(!window.isDestroyed())window.showInactive()});
   window.once('closed',()=>{this.windows.delete(window);if(!this.windows.size){clearTimeout(this.guard);this.guard=null;}});
   window.loadFile(path.join(__dirname,'fireworks.html'),{query:{mode:forceFull||this.mode()==='full'?'full':'system'}}).catch(()=>{if(!window.isDestroyed())window.close()});
  }
  this.guard=setTimeout(()=>this.close(),6000);return true;
 }
 done(sender){for(const window of this.windows)if(window.webContents.id===sender){window.close();break;}}
 close(){clearTimeout(this.pending);clearTimeout(this.guard);this.pending=null;this.guard=null;for(const window of [...this.windows])if(!window.isDestroyed())window.close();this.windows.clear();}
}
module.exports={Celebration};
