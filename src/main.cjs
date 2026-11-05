const {app,BrowserWindow,Menu,Tray,nativeImage,ipcMain,shell,screen}=require('electron');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const {SessionMonitor}=require('./monitor.cjs');
const {completionStamp}=require('./completed-cards.js');
const {CompletionDetector}=require('./completion-detector.cjs');
const {Celebration}=require('./celebration.cjs');
const {setWindowLayer}=require('./window-layer.cjs');
const dataDir=process.env.CLOTHESLINE_DATA_DIR||path.join(os.homedir(),'Library','Application Support','Codex Session Clothesline');
const diagnosticsDir=app.isPackaged?path.join(dataDir,'diagnostics'):path.join(__dirname,'..','test-artifacts');
app.setPath('userData',dataDir);
app.setName('codex-live-show');
let win,tray,monitor,preferences={},saveTimer,celebration,completionDetector;
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{fs.mkdirSync(dataDir,{recursive:true});const file=path.join(dataDir,'preferences.json');fs.writeFileSync(file+'.tmp',JSON.stringify(preferences,null,2),{mode:0o600});fs.renameSync(file+'.tmp',file);}catch(e){console.error('preferences:',e.code||e.message)}},200)}
function fit(bounds){const displays=screen.getAllDisplays();const area=(displays.find(d=>{const a=d.workArea;return bounds.x<a.x+a.width&&bounds.x+bounds.width>a.x&&bounds.y<a.y+a.height&&bounds.y+bounds.height>a.y})||screen.getPrimaryDisplay()).workArea;return{x:Math.max(area.x,Math.min(bounds.x,area.x+area.width-bounds.width)),y:Math.max(area.y,Math.min(bounds.y,area.y+area.height-bounds.height))};}
function home(){const a=screen.getPrimaryDisplay().workArea;win.setPosition(a.x+a.width-win.getBounds().width-18,a.y+18)}
function applyWindowLevel(){setWindowLayer(win,preferences.pinned===true)}
function show(){win.showInactive();applyWindowLevel()}
function register(){ipcMain.handle('sessions:snapshot',()=>monitor.snapshot());
ipcMain.handle('fireworks:preview',()=>({ok:celebration.play({preview:true,forceFull:true})}));
ipcMain.on('fireworks:done',event=>celebration?.done(event.sender.id));
ipcMain.handle('preferences:get',()=>preferences);
ipcMain.handle('window:pinned',(_e,value)=>{if(typeof value==='boolean'){preferences.pinned=value;applyWindowLevel();save()}return preferences.pinned===true;});
ipcMain.handle('session:dismiss-completed',(_e,id)=>{const session=monitor.snapshot().sessions.find(s=>s.id===id);if(!session||session.state!=='completed')return{ok:false,error:'只能移除已完成会话'};preferences.dismissedCompletions={...preferences.dismissedCompletions,[id]:completionStamp(session)};save();return{ok:true,dismissed:preferences.dismissedCompletions};});
ipcMain.handle('preferences:save',(_e,value)=>{if(value&&typeof value==='object'){for(const key of ['paused','historyOpen'])if(typeof value[key]==='boolean')preferences[key]=value[key];if(preferences.paused)celebration?.close();save()}return preferences});
ipcMain.handle('window:scale',(_e,value)=>{if(!Number.isFinite(value))return preferences.scale||1;preferences.scale=Math.min(1.25,Math.max(.65,value));win.webContents.setZoomFactor(preferences.scale);win.setSize(Math.round(720*preferences.scale),win.getBounds().height);win.setPosition(...Object.values(fit(win.getBounds())));save();return preferences.scale});
ipcMain.handle('session:open',async(_e,id)=>{if(typeof id!=='string'||!/^([a-zA-Z0-9_-]{6,100})$/.test(id))return{ok:false,error:'会话标识无效'};if(!monitor.snapshot().sessions.some(s=>s.id===id))return{ok:false,error:'会话不存在'};try{await shell.openExternal('codex://threads/'+encodeURIComponent(id));return{ok:true}}catch{return{ok:false,error:'无法打开 Codex，请确认桌面应用已安装'}}});
ipcMain.on('window:move',(_e,d)=>{if(!d||!Number.isFinite(d.x)||!Number.isFinite(d.y))return;const b=win.getBounds(),p=fit({...b,x:b.x+Math.max(-100,Math.min(100,d.x)),y:b.y+Math.max(-100,Math.min(100,d.y))});win.setPosition(Math.round(p.x),Math.round(p.y))});
ipcMain.on('window:home',home);
ipcMain.on('window:resize',(_e,h)=>{if(!Number.isFinite(h))return;const area=screen.getDisplayMatching(win.getBounds()).workArea;win.setSize(win.getBounds().width,Math.min(area.height,Math.max(180,Math.ceil(h*(preferences.scale||1)))));const p=fit(win.getBounds());win.setPosition(Math.round(p.x),Math.round(p.y));});
ipcMain.on('window:passthrough',(_e,value)=>{if(typeof value==='boolean')win.setIgnoreMouseEvents(value,{forward:true})});
ipcMain.on('app:quit',()=>app.quit());}
async function start(){fs.mkdirSync(dataDir,{recursive:true});try{preferences=JSON.parse(fs.readFileSync(path.join(dataDir,'preferences.json'),'utf8'))}catch{}
completionDetector=new CompletionDetector();
monitor=new SessionMonitor({codexHome:process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),dataDir});await monitor.start();
completionDetector.update(monitor.snapshot().sessions);
celebration=new Celebration({BrowserWindow,screen,targetDisplay:()=>win&&!win.isDestroyed()?screen.getDisplayMatching(win.getBounds()):screen.getPrimaryDisplay(),mode:()=>preferences.fireworksMode||'full',paused:()=>preferences.paused===true});
monitor.on('completed',session=>{if(completionDetector.completion(session))celebration.request()});
const scale=Number.isFinite(preferences.scale)?Math.max(.65,Math.min(1.25,preferences.scale)):1;
win=new BrowserWindow({width:Math.round(720*scale),height:550,transparent:true,frame:false,resizable:false,hasShadow:false,alwaysOnTop:false,skipTaskbar:true,show:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
const rendererErrors=[];win.webContents.on('console-message',event=>{if(event.level==='error'||event.level===3)rendererErrors.push(String(event.message).slice(0,300))});win.webContents.on('did-fail-load',(_event,code,description)=>rendererErrors.push(String(code)+':'+description));win.webContents.on('render-process-gone',(_event,details)=>rendererErrors.push('renderer:'+details.reason));
win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:false});applyWindowLevel();win.on('focus',applyWindowLevel);win.webContents.setZoomFactor(scale);
if(preferences.position&&Number.isFinite(preferences.position.x)&&Number.isFinite(preferences.position.y)){const p=fit({...win.getBounds(),...preferences.position});win.setPosition(p.x,p.y)}else home();
win.on('moved',()=>{preferences.position=win.getPosition().reduce((a,v,i)=>(a[i?'y':'x']=v,a),{});save()});
win.on('close',e=>{if(!app.isQuitting){e.preventDefault();win.hide()}});
win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('file://'))e.preventDefault()});
let lastSent='';monitor.on('change',snapshot=>{if(completionDetector.update(snapshot.sessions).length)celebration.request();const key=JSON.stringify({sessions:snapshot.sessions,health:{status:snapshot.health.status,message:snapshot.health.message}});if(key!==lastSent&&win&&!win.isDestroyed()){lastSent=key;win.webContents.send('sessions:change',snapshot)}});
register();await win.loadFile(path.join(__dirname,'index.html'));show();
if(process.argv.includes('--fireworks-smoke')||process.argv.includes('--completion-smoke')){if(process.argv.includes('--completion-smoke'))monitor.emit('completed',{id:'diagnostic-completion',state:'completed',completedAt:Date.now(),updatedAt:Date.now()});else celebration.play({preview:true,forceFull:true});setTimeout(async()=>{try{const output=process.env.CLOTHESLINE_SMOKE_DIR||path.join(diagnosticsDir,'fireworks');fs.mkdirSync(output,{recursive:true});let i=0;for(const overlay of celebration.windows){fs.writeFileSync(path.join(output,'fireworks-'+i+'.png'),(await overlay.webContents.capturePage()).toPNG());i++;}console.log(JSON.stringify({fireworksScreens:i,errors:celebration.errors}));}catch(e){console.error(e)}},2350);setTimeout(()=>{console.log(JSON.stringify({remainingOverlays:celebration.windows.size}));app.quit()},7500);return;}
if(process.argv.includes('--smoke')){setTimeout(async()=>{try{const output=process.env.CLOTHESLINE_SMOKE_DIR||diagnosticsDir;fs.mkdirSync(output,{recursive:true});const metrics=await win.webContents.executeJavaScript("({cards:document.querySelectorAll('.crystal').length,groups:[...document.querySelectorAll('.group-head')].map(e=>e.textContent),health:document.querySelector('#health').textContent,bodyWidth:document.body.scrollWidth,windowWidth:innerWidth,transparent:getComputedStyle(document.body).backgroundColor})");metrics.errors=rendererErrors;metrics.bounds=win.getBounds();metrics.workArea=screen.getDisplayMatching(win.getBounds()).workArea;fs.writeFileSync(path.join(output,'smoke.json'),JSON.stringify(metrics,null,2));fs.writeFileSync(path.join(output,'smoke.png'),(await win.webContents.capturePage()).toPNG());console.log(JSON.stringify({smoke:true,cards:metrics.cards,overflow:metrics.bodyWidth>metrics.windowWidth,errors:metrics.errors}));if(metrics.errors.length)app.exit(1);else app.quit();}catch(e){console.error(e);app.exit(1)}},1200);return;}
const pixels=Buffer.alloc(22*22*4);for(let y=0;y<22;y++)for(let x=0;x<22;x++){if((y>=3&&y<=5&&x>=1&&x<=20)||(y>=6&&y<=10&&(x===6||x===16))||((Math.abs(x-6)+Math.abs(y-15)===4)||(Math.abs(x-16)+Math.abs(y-15)===4))){const i=(y*22+x)*4;pixels[i+3]=255;}}const icon=nativeImage.createFromBitmap(pixels,{width:22,height:22});icon.setTemplateImage(true);tray=new Tray(icon);tray.setToolTip('codex-live-show');tray.setContextMenu(Menu.buildFromTemplate([{label:'显示挂件',click:show},{label:'隐藏挂件',click:()=>win.hide()},{label:'回到右上角',click:()=>{home();show()}},{type:'separator'},{label:'庆祝动效',submenu:[['跟随系统（减少动态效果时柔和播放）','system'],['完整烟花','full'],['关闭完成动效','off']].map(([label,value])=>({label,type:'radio',checked:(preferences.fireworksMode||'full')===value,click:()=>{preferences.fireworksMode=value;if(value==='off')celebration.close();save()}}))},{label:'预览完成动效',click:()=>celebration.play({preview:true})},{type:'separator'},{label:'打开数据目录',click:()=>shell.openPath(dataDir)},{label:'退出',click:()=>app.quit()}]));tray.on('click',()=>win.isVisible()?win.hide():show());if(process.platform==='darwin')app.dock.hide();
}
if(!app.requestSingleInstanceLock())app.quit();else{app.on('second-instance',()=>win&&show());app.whenReady().then(start).catch(error=>{console.error(error);app.quit()});}
app.on('before-quit',()=>{app.isQuitting=true;celebration?.close();monitor?.stop();clearTimeout(saveTimer);try{fs.writeFileSync(path.join(dataDir,'preferences.json'),JSON.stringify(preferences),{mode:0o600})}catch{}});
app.on('window-all-closed',()=>{});app.on('activate',()=>win&&show());
