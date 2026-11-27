const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path');
module.exports=async function({win,screen,drawer,windowInput,monitor,celebration,dataDir,rendererErrors,output}){
  fs.mkdirSync(output,{recursive:true});
  const js=source=>win.webContents.executeJavaScript(source);
  async function until(source){for(let i=0;i<50;i++){if(await js(source))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+source);}
  const checks=[];
  await until("document.querySelector('#drawerTab')&&!document.querySelector('#drawerTab').hidden");
  assert.ok(Math.abs(win.webContents.getZoomFactor()-(await js('window.clothesline.getPreferences().then(p=>p.scale||1)')))<.001,'startup restores page zoom');
  assert.equal(windowInput.captureAll,true,'solid edge drawer never passes clicks to the desktop');assert.ok(win.getBounds().width<=60);assert.ok(win.isAlwaysOnTop());checks.push('collapsed drawer is narrow and above normal windows');
  await js("document.querySelector('#expandDrawer').click()");await until("!document.body.classList.contains('drawer-collapsed')");
  await js("window.clothesline.setPinned(true)");await js("window.clothesline.setLayout('board')");await until("document.body.classList.contains('layout-board')");
  await until("document.querySelectorAll('.board-list .crystal').length>0");
  const board=await js("({overflow:document.body.scrollWidth>innerWidth,groups:[...document.querySelectorAll('.group-head')].map(e=>e.textContent),waiting:[...document.querySelectorAll('.waiting .card-status')].map(e=>e.textContent)})");
  assert.equal(windowInput.captureAll,true,'solid board never passes blank-area clicks to the desktop');assert.equal(board.overflow,false);assert.ok(board.waiting.includes('需要输入'));assert.ok(board.waiting.includes('需要审批'));
  await new Promise(r=>setTimeout(r,200));
  const headerDrag=await js(`(()=>{const title=document.querySelector('#moveWindow span').getBoundingClientRect(),handle=document.querySelector('#moveWindow').getBoundingClientRect(),controls=document.querySelector('.controls').getBoundingClientRect();const x=(title.right+controls.left)/2,y=handle.y+handle.height/2;return {x,y,target:document.elementFromPoint(x,y)?.closest('button')?.id,handleRight:handle.right,controlsLeft:controls.left}})()`);
  assert.equal(headerDrag.target,'moveWindow','blank board header should belong to the drag handle');
  assert.ok(windowInput.regions.some(r=>headerDrag.x>=r.x&&headerDrag.x<r.x+r.width&&headerDrag.y>=r.y&&headerDrag.y<r.y+r.height),'header drag space must not pass mouse input through');
  assert.ok(headerDrag.handleRight<=headerDrag.controlsLeft,'drag handle never overlaps toolbar buttons');checks.push('blank board header is draggable without covering controls');
  fs.writeFileSync(path.join(output,'board.png'),(await win.webContents.capturePage()).toPNG());checks.push('board renders three real renderer groups without overflow');
  for(const scale of [.65,1,1.25]){
    await js(`window.clothesline.setScale(${scale})`);await until("document.body.scrollWidth<=innerWidth");
    await js("document.querySelector('#collapseDrawer').click()");await until("document.body.classList.contains('drawer-collapsed')");
    assert.equal(win.getBounds().width,Math.round(48*scale));
    for(const side of ['left','right']){drawer.side(side);const b=win.getBounds(),a=screen.getDisplayMatching(b).workArea;assert.equal(b.x,side==='left'?a.x:a.x+a.width-b.width);assert.ok(b.y>=a.y&&b.y+b.height<=a.y+a.height);}
    await until("Math.abs(document.querySelector('#drawerTab').getBoundingClientRect().width-48)<1");
    fs.writeFileSync(path.join(output,'drawer-'+scale+'.png'),(await win.webContents.capturePage()).toPNG());
    await js("document.querySelector('#expandDrawer').click()");await until("!document.body.classList.contains('drawer-collapsed')");assert.ok(win.getBounds().width>400);
  }
  checks.push('both screen edges and restore work at 65%, 100%, 125%');
  await js("window.clothesline.setScale(1)");await js("document.querySelector('#layoutToggle').click()");await until("!document.body.classList.contains('layout-board')");
  assert.equal(windowInput.captureAll,false,'crystal layout keeps transparent-area passthrough');
  const positions=await js("[...document.querySelectorAll('.running .crystal')].map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y}))");assert.equal(positions.length,2);assert.ok(Math.abs(positions[0].x-positions[1].x)>80,'running cards use two separate columns');checks.push('crystal running cards remain in two columns');
  await new Promise(r=>setTimeout(r,400));await until("getComputedStyle(document.querySelector('.glass')).display!=='none'");fs.writeFileSync(path.join(output,'crystal.png'),(await win.webContents.capturePage()).toPNG());
  await js("document.querySelector('#layoutToggle').click()");await until("document.body.classList.contains('layout-board')");assert.equal(windowInput.captureAll,true,'returning to board restores full mouse capture');checks.push('layout round trip and layout-specific mouse capture');
  await until("document.querySelectorAll('.dismiss-completed').length>0");await js("document.querySelector('.dismiss-completed').click()");await until("document.querySelectorAll('.dismiss-completed').length===0");checks.push('completion dismissal');
  monitor.stop();
  monitor.sessions=new Map([['single-done',{id:'single-done',title:'仅一条完成记录',state:'completed',completedAt:Date.now(),updatedAt:Date.now()}]]);
  monitor.emit('change',monitor.snapshot());
  await until("document.querySelector('[data-id=single-done]')");
  await new Promise(r=>setTimeout(r,700));
  const spacing=await js(`(()=>{const group=document.querySelector('.group.completed'),last=group.querySelector('.crystal'),r=group.getBoundingClientRect(),c=last.getBoundingClientRect();return {height:r.height,cardHeight:c.height,bottomGap:r.bottom-c.bottom,page:document.querySelector('.page').scrollHeight,viewport:innerHeight,columns:[...document.querySelectorAll('.group')].map(g=>({state:g.dataset.group,height:g.getBoundingClientRect().height,header:g.querySelector('.group-head').getBoundingClientRect().height,content:g.querySelector('.column-content').getBoundingClientRect().height}))}})()`);
  console.log(JSON.stringify({spacing}));
  assert.ok(spacing.bottomGap<32,'single completed card should not leave a large blank area');
  checks.push('single-card board fits its content');
  assert.equal(await js("document.querySelector('[data-column=waiting]').disabled"),false,'empty status remains clickable');
  await js("document.querySelector('[data-column=waiting]').click()");await until("document.querySelector('#health').textContent.includes('暂无待确认任务')");
  assert.equal(await js("document.querySelector('[data-column=waiting]').getAttribute('aria-expanded')"),'false','empty status explanation must not expand the column');checks.push('empty status click explains without expanding');

  fs.writeFileSync(path.join(output,'board-compact.png'),(await win.webContents.capturePage()).toPNG());
  const now=Date.now(),many=Array.from({length:12},(_,i)=>({id:'done-'+i,title:'已完成任务 '+(i+1),state:'completed',completedAt:now-i*1000,updatedAt:now-i*1000}));
  const short={id:'short-running',title:'只有一条执行任务',state:'running',startedAt:now,updatedAt:now};
  monitor.sessions=new Map([...many,short].map(s=>[s.id,s]));monitor.emit('change',monitor.snapshot());
  await until("document.querySelectorAll('.completed .crystal').length===12");
  await new Promise(r=>setTimeout(r,300));
  const unequal=await js(`(()=>{const running=document.querySelector('.group.running'),card=running.querySelector('.crystal'),complete=document.querySelector('.completed .column-content');return {shortGap:running.getBoundingClientRect().bottom-card.getBoundingClientRect().bottom,longHeight:complete.clientHeight,longScroll:complete.scrollHeight,foldedHeight:document.querySelector('.group.waiting').getBoundingClientRect().height}})()`);
  assert.ok(unequal.shortGap<32,'short column must not stretch to match a long column');assert.ok(unequal.longHeight<=461&&unequal.longScroll>unequal.longHeight,'long columns scroll within their height limit');assert.ok(unequal.foldedHeight<=152,'folded column stays compact next to long content');
  await js("document.querySelector('.completed .column-content').scrollTop=100000");
  const tailGap=await js("(()=>{const c=document.querySelector('.completed .column-content');return c.getBoundingClientRect().bottom-c.querySelector('.crystal-holder:last-child').getBoundingClientRect().bottom})()");assert.ok(tailGap<20&&tailGap>=0,'long list has no empty tail after its last card');
  for(const button of ['scaleDown','scaleDown','scaleUp','scaleUp','scaleUp','scaleUp']){
    await js(`document.querySelector('#${button}').click()`);await new Promise(r=>setTimeout(r,200));
    const zoomSpacing=await js(`(()=>{const g=document.querySelector('.group.completed'),c=g.querySelector('.column-content'),r=document.querySelector('.group.running');return {tail:g.getBoundingClientRect().bottom-c.getBoundingClientRect().bottom,short:r.getBoundingClientRect().bottom-r.querySelector('.crystal').getBoundingClientRect().bottom,folded:document.querySelector('.group.waiting').getBoundingClientRect().height}})()`);
    assert.ok(zoomSpacing.tail<4&&zoomSpacing.short<32&&zoomSpacing.folded<=152,'zoom must not reintroduce stretched column blanks');
  }
  await js("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  fs.writeFileSync(path.join(output,'board-mixed.png'),(await win.webContents.capturePage()).toPNG());
  monitor.sessions.clear();monitor.emit('change',monitor.snapshot());await until("document.querySelectorAll('.group.is-collapsed').length===3");await new Promise(r=>setTimeout(r,250));
  assert.ok(await js("document.querySelector('.groups').getBoundingClientRect().height<=152"),'empty board stays compact');checks.push('mixed-length columns, list bottom, zoom buttons and empty board stay compact');

  const waiting={id:'manual-wait',title:'等待确认测试',state:'waiting',waitReason:'input',updatedAt:Date.now()};
  monitor.sessions=new Map([...many,short,waiting].map(s=>[s.id,s]));monitor.emit('change',monitor.snapshot());
  await until("document.querySelectorAll('.group:not(.is-collapsed)').length===3");
  const foldCases=[];
  for(const folded of [[],['running'],['waiting'],['completed'],['running','waiting'],['running','completed'],['waiting','completed'],['running','waiting','completed']]){
    await js(`(()=>{const folded=${JSON.stringify(folded)};for(const state of ['running','waiting','completed']){const b=document.querySelector('[data-column="'+state+'"]');if((b.getAttribute('aria-expanded')==='false')!==folded.includes(state))b.click();}})()`);
    await new Promise(r=>setTimeout(r,250));
    const measured=await js("({page:document.querySelector('.page').scrollHeight,groups:document.querySelector('.groups').getBoundingClientRect().height,folded:[...document.querySelectorAll('.group.is-collapsed')].map(g=>g.getBoundingClientRect().height)})");
    const zoom=win.webContents.getZoomFactor(),area=screen.getDisplayMatching(win.getBounds()).workArea;
    assert.ok(Math.abs(win.getBounds().height-Math.min(area.height,Math.max(60*zoom,Math.ceil((measured.page+20)*zoom))))<=2,'native height must follow visible content after '+folded.join(','));
    assert.ok(measured.folded.every(height=>height<=152),'folded columns never stretch');
    if(folded.length===3)assert.ok(measured.groups<=50,'all folded columns become one compact horizontal row');
    assert.equal(win.getBounds().width,Math.min(area.width,Math.round([360,440,700,920][3-folded.length]*zoom)),'width adapts to visible columns');
    assert.ok(await js('document.body.scrollWidth<=innerWidth'),'adaptive width must not overflow');
    foldCases.push({folded,groups:measured.groups,windowWidth:win.getBounds().width,windowHeight:win.getBounds().height});
    if(folded.length>0)fs.writeFileSync(path.join(output,'folded-'+folded.join('-')+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  checks.push('all seven manual fold combinations resize the native window');
  await until("!document.body.classList.contains('has-notice')&&innerHeight<=120");
  assert.ok(win.getBounds().height/win.webContents.getZoomFactor()<=120,'fully folded board is a small status strip');
  await js("document.querySelector('#moreControls').click()");await until("!document.querySelector('#morePanel').hidden");
  await new Promise(r=>setTimeout(r,250));assert.ok(await js("document.querySelector('#quit').getBoundingClientRect().bottom<innerHeight"),'secondary controls remain inside the resized window');
  await js("document.querySelector('#menuHistory').click()");await until("!document.querySelector('#history').hidden");await new Promise(r=>setTimeout(r,250));assert.ok(win.getBounds().width/win.webContents.getZoomFactor()>=439,'history opens at readable width');
  await js("document.querySelector('#closeHistory').click()");await until("document.querySelector('#history').hidden");await new Promise(r=>setTimeout(r,250));
  assert.ok(Math.abs(win.getBounds().width/win.webContents.getZoomFactor()-360)<1,'closing history restores compact width');checks.push('compact status strip, secondary controls and history adapt without clipping');
  fs.writeFileSync(path.join(output,'adaptive-summary.png'),(await win.webContents.capturePage()).toPNG());

  await js("document.querySelector('#moreControls').click()");await until("!document.querySelector('#morePanel').hidden");
  assert.equal(await js("document.querySelector('#fireworksScope').textContent"),'烟花：当前屏幕');
  const scopeChecks=[];
  for(const scope of ['all','current']){
    await js("document.querySelector('#fireworksScope').click()");await until(`document.querySelector('#fireworksScope').getAttribute('aria-pressed')==='${scope==='all'}'`);
    assert.equal(await js("window.clothesline.getPreferences().then(p=>p.fireworksScope)"),scope);
    for(let retry=0;retry<30;retry++){if(JSON.parse(fs.readFileSync(path.join(dataDir,'preferences.json'),'utf8')).fireworksScope===scope)break;await new Promise(r=>setTimeout(r,100));}assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir,'preferences.json'),'utf8')).fireworksScope,scope,'scope persists to disk');
    await js("window.clothesline.previewFireworks()");
    const expected=scope==='all'?screen.getAllDisplays().length:1;assert.equal(celebration.windows.size,expected);
    await new Promise(r=>setTimeout(r,700));assert.equal(celebration.errors.length,0);celebration.close();assert.equal(celebration.windows.size,0);
    scopeChecks.push({scope,screens:expected});
  }
  await js("window.clothesline.savePreferences({fireworksScope:'invalid'})");assert.equal(await js("window.clothesline.getPreferences().then(p=>p.fireworksScope)"),'current','invalid scope is rejected');
  await js("window.clothesline.savePreferences({fireworksScope:'all',paused:false})");
  // Restore the fixture's disabled effect setting only for this explicit completion check.
  const originalMode=celebration.mode;celebration.mode=()=> 'full';
  monitor.emit('completed',{id:'scope-completion',state:'completed',completedAt:Date.now(),updatedAt:Date.now()});
  await new Promise(r=>setTimeout(r,1200));assert.equal(celebration.windows.size,screen.getAllDisplays().length,'actual completion uses all-screen preference');celebration.close();celebration.mode=originalMode;
  await js("window.clothesline.savePreferences({paused:true,fireworksScope:'current'})");
  fs.writeFileSync(path.join(output,'fireworks-scope.png'),(await win.webContents.capturePage()).toPNG());
  checks.push('fireworks scope button, persisted preference, preview and completion screen selection');
  assert.equal(rendererErrors.length,0);assert.ok(windowInput.regions.length>0);
  const result={checks,board,spacing,unequal,foldCases,scopeChecks,errors:rendererErrors,bounds:win.getBounds()};fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
};
