const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {Celebration}=require('../src/celebration.cjs');
class Window extends EventEmitter{
 constructor(options){super();this.options=options;this.closed=false;this.webContents=new EventEmitter();this.webContents.id=++Window.ids;this.webContents.setWindowOpenHandler=()=>{};}
 setIgnoreMouseEvents(value){this.passThrough=value;}setVisibleOnAllWorkspaces(){}setAlwaysOnTop(){}showInactive(){this.shownWithoutFocus=true;}
 loadFile(){return Promise.resolve();}isDestroyed(){return this.closed;}close(){this.closed=true;this.emit('closed');}
}Window.ids=0;
const displays=[{bounds:{x:0,y:0,width:1512,height:982}},{bounds:{x:1512,y:0,width:1920,height:1080}}];
const screen={getAllDisplays:()=>displays,getPrimaryDisplay:()=>displays[0]};
test('full-screen overlays are transparent, click-through and never focusable',()=>{
 const c=new Celebration({BrowserWindow:Window,screen});assert.equal(c.play(),true);assert.equal(c.windows.size,1);
 for(const w of c.windows){assert.equal(w.options.focusable,false);assert.equal(w.options.transparent,true);assert.equal(w.passThrough,true);w.emit('ready-to-show');assert.equal(w.shownWithoutFocus,true);}
 assert.equal(c.play(),false);c.close();assert.equal(c.windows.size,0);
});
test('only the current target display is covered, including after moving the widget',()=>{
 let target=displays[1];const c=new Celebration({BrowserWindow:Window,screen,targetDisplay:()=>target});
 c.play();assert.equal(c.windows.size,1);assert.equal([...c.windows][0].options.x,1512);assert.equal([...c.windows][0].options.width,1920);c.close();
 target=displays[0];c.play();assert.equal(c.windows.size,1);assert.equal([...c.windows][0].options.x,0);assert.equal([...c.windows][0].options.width,1512);c.close();
});
test('disabled and paused effects do not schedule celebrations',()=>{
 for(const options of [{mode:()=> 'off'},{paused:()=>true}]){const c=new Celebration({BrowserWindow:Window,screen,...options});c.request();assert.equal(c.pending,null);assert.equal(c.play(),false);c.close();}
});
test('multiple requests coalesce and only their own completion can close an overlay',()=>{
 const c=new Celebration({BrowserWindow:Window,screen});c.request();const pending=c.pending;c.request();assert.equal(c.pending,pending);c.close();c.play();const before=c.windows.size;c.done(-1);assert.equal(c.windows.size,before);c.done([...c.windows][0].webContents.id);assert.equal(c.windows.size,before-1);c.close();
});
