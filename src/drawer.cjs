function drawerBounds({area,origin,collapsed,side='right',layout='crystal',scale=1,crystalColumns=2}){
  const width=Math.min(area.width,Math.round((collapsed?48:layout==='board'?900:crystalColumns>=3?1040:720)*scale));
  const height=Math.min(area.height,Math.round(collapsed?216*scale:Math.max(180,origin.height||500)));
  const clamp=(value,min,max)=>Math.round(Math.max(min,Math.min(value,max)));
  return {x:collapsed?(side==='left'?area.x:area.x+area.width-width):clamp(origin.x,area.x,area.x+area.width-width),y:clamp(origin.y,area.y,area.y+area.height-height),width,height};
}
class Drawer{
  constructor({window,screen,preferences,save,onChange}){this.window=window;this.screen=screen;this.preferences=preferences;this.save=save;this.onChange=onChange;}
  state(){return{collapsed:this.preferences.drawerCollapsed===true,side:this.preferences.drawerSide==='left'?'left':'right',layout:this.preferences.layout==='board'?'board':'crystal'};}
  apply(){
    if(this.dragging)return this.state();
    const p=this.preferences,origin={...this.window.getBounds(),...p.expandedBounds,...p.position};
    const area=this.screen.getDisplayMatching(origin).workArea;
    const bounds=drawerBounds({area,origin,...this.state(),scale:p.scale||1,crystalColumns:this.columns||2});
    this.window.setBounds(bounds,false);
    const state=this.state(),key=JSON.stringify(state);
    if(key!==this.lastView){this.lastView=key;this.window.webContents.send('window:view',state);this.onChange?.(state);}
    this.save();return this.state();
  }
  collapse(value){
    if(typeof value!=='boolean')return this.state();
    if(value&&!this.state().collapsed){this.preferences.expandedBounds=this.window.getBounds();this.preferences.position=this.window.getPosition().reduce((p,v,i)=>(p[i?'y':'x']=v,p),{});}
    this.preferences.drawerCollapsed=value;return this.apply();
  }
  layout(value){if(['board','crystal'].includes(value))this.preferences.layout=value;return this.apply();}
  side(value){if(['left','right'].includes(value))this.preferences.drawerSide=value;return this.apply();}
  beginDrag(){this.dragging=true;}
  endDrag(){
    this.dragging=false;
    const bounds=this.window.getBounds();this.preferences.position={x:bounds.x,y:bounds.y};this.preferences.expandedBounds=bounds;
    const pending=this.pendingResize;this.pendingResize=null;
    if(pending)this.resize(...pending);else this.save();
  }
  resize(height,columns){
    if(this.state().collapsed||!Number.isFinite(height))return;
    if(this.dragging){this.pendingResize=[height,columns];return;}
    this.columns=Number.isInteger(columns)&&columns>=3?3:2;
    this.preferences.expandedBounds={...this.window.getBounds(),height:Math.max(180,Math.ceil(height*(this.preferences.scale||1)))};
    this.apply();
  }
}
module.exports={drawerBounds,Drawer};
