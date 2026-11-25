const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path');
module.exports=async function({win,screen,drawer,windowInput,monitor,rendererErrors,output}){
  fs.mkdirSync(output,{recursive:true});
  const js=source=>win.webContents.executeJavaScript(source);
  async function until(source){for(let i=0;i<50;i++){if(await js(source))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+source);}
  const checks=[];
  await until("document.querySelector('#drawerTab')&&!document.querySelector('#drawerTab').hidden");
  assert.ok(Math.abs(win.webContents.getZoomFactor()-(await js('window.clothesline.getPreferences().then(p=>p.scale||1)')))<.001,'startup restores page zoom');
  assert.ok(win.getBounds().width<=60);assert.ok(win.isAlwaysOnTop());checks.push('collapsed drawer is narrow and above normal windows');
  await js("document.querySelector('#expandDrawer').click()");await until("!document.body.classList.contains('drawer-collapsed')");
  await js("window.clothesline.setPinned(true)");await js("window.clothesline.setLayout('board')");await until("document.body.classList.contains('layout-board')");
  await until("document.querySelectorAll('.board-list .crystal').length>0");
  const board=await js("({overflow:document.body.scrollWidth>innerWidth,groups:[...document.querySelectorAll('.group-head')].map(e=>e.textContent),waiting:[...document.querySelectorAll('.waiting .card-status')].map(e=>e.textContent)})");
  assert.equal(board.overflow,false);assert.ok(board.waiting.includes('需要输入'));assert.ok(board.waiting.includes('需要审批'));
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
  const positions=await js("[...document.querySelectorAll('.running .crystal')].map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y}))");assert.equal(positions.length,2);assert.ok(Math.abs(positions[0].x-positions[1].x)>80,'running cards use two separate columns');checks.push('crystal running cards remain in two columns');
  await new Promise(r=>setTimeout(r,400));await until("getComputedStyle(document.querySelector('.glass')).display!=='none'");fs.writeFileSync(path.join(output,'crystal.png'),(await win.webContents.capturePage()).toPNG());
  await js("document.querySelector('#layoutToggle').click()");await until("document.body.classList.contains('layout-board')");checks.push('layout round trip');
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
    assert.ok(Math.abs(win.getBounds().height-Math.min(area.height,Math.max(180,Math.ceil((measured.page+20)*zoom))))<=2,'native height must follow visible content after '+folded.join(','));
    assert.ok(measured.folded.every(height=>height<=152),'folded columns never stretch');
    if(folded.length===3)assert.ok(measured.groups<=50,'all folded columns become one compact horizontal row');
    foldCases.push({folded,groups:measured.groups,windowHeight:win.getBounds().height});
    if(folded.length>0)fs.writeFileSync(path.join(output,'folded-'+folded.join('-')+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  checks.push('all seven manual fold combinations resize the native window');
  assert.equal(rendererErrors.length,0);assert.ok(windowInput.regions.length>0);
  const result={checks,board,spacing,unequal,foldCases,errors:rendererErrors,bounds:win.getBounds()};fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
};
