class WindowInput{
 constructor({window,screen}){this.window=window;this.screen=screen;this.regions=[];this.ignored=null;this.timer=null;this.held=false;}
 setHeld(value){this.held=value===true;this.tick();}
 setRegions(regions){this.regions=Array.isArray(regions)?regions.slice(0,300).filter(r=>r&&['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0&&r.width<=5000&&r.height<=20000):[];}
 tick(){
  if(this.window.isDestroyed()){this.stop();return;}
  if(this.window.isVisible?.()===false)return;
  if(this.held){if(this.ignored!==false){this.window.setIgnoreMouseEvents(false,{forward:true});this.ignored=false;}return;}
  const point=this.screen.getCursorScreenPoint(),bounds=this.window.getContentBounds(),zoom=this.window.webContents.getZoomFactor()||1;
  const x=(point.x-bounds.x)/zoom,y=(point.y-bounds.y)/zoom;
  const insideWindow=point.x>=bounds.x&&point.x<bounds.x+bounds.width&&point.y>=bounds.y&&point.y<bounds.y+bounds.height;
  const hit=insideWindow&&this.regions.some(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height);
  const ignored=!hit;
  if(this.ignored!==ignored){this.window.setIgnoreMouseEvents(ignored,{forward:true});this.ignored=ignored;}
 }
 start(){if(this.timer)return;this.tick();this.timer=setInterval(()=>this.tick(),33);this.timer.unref?.();}
 stop(){clearInterval(this.timer);this.timer=null;}
}
module.exports={WindowInput};
