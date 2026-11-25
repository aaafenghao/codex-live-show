const test=require('node:test'),assert=require('node:assert/strict');const {drawerBounds}=require('../src/drawer.cjs');
test('drawer docks within negative-coordinate monitor and expansion fits area',()=>{const area={x:-1440,y:25,width:1440,height:875};const origin={x:-900,y:300,width:900,height:500};assert.deepEqual(drawerBounds({area,origin,collapsed:true,side:'right',scale:1}),{x:-48,y:300,width:48,height:216});assert.equal(drawerBounds({area,origin,collapsed:true,side:'left',scale:1}).x,-1440);const b=drawerBounds({area,origin,collapsed:false,layout:'board',scale:1.25});assert.ok(b.x>=area.x&&b.x+b.width<=0&&b.y+b.height<=900);});
test('small display clamps both layout dimensions and drawer zoom',()=>{const b=drawerBounds({area:{x:0,y:0,width:640,height:400},origin:{x:400,y:350,height:700},collapsed:false,layout:'board',scale:1.25});assert.equal(b.width,640);assert.equal(b.height,400);assert.equal(b.x,0);assert.equal(b.y,0);});
test('layout refresh during dragging cannot pull the window back; release remembers its new position',()=>{
 const {Drawer}=require('../src/drawer.cjs');let bounds={x:100,y:100,width:720,height:500};const preferences={position:{x:100,y:100},expandedBounds:{...bounds}};
 const window={getBounds:()=>({...bounds}),getPosition:()=>[bounds.x,bounds.y],setBounds:b=>{bounds={...b}},webContents:{send:()=>{}}};
 const drawer=new Drawer({window,screen:{getDisplayMatching:()=>({workArea:{x:0,y:0,width:1440,height:900}})},preferences,save:()=>{}});
 assert.equal(typeof drawer.beginDrag,'function');drawer.beginDrag();bounds.x=300;bounds.y=200;drawer.resize(400,2);assert.equal(bounds.x,300);assert.equal(bounds.height,500);
 drawer.endDrag();assert.deepEqual(preferences.position,{x:300,y:200});assert.equal(bounds.height,400);drawer.resize(450,2);assert.equal(bounds.x,300);assert.equal(bounds.y,200);
});
