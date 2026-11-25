'use strict';
const api=window.clothesline;
const $=id=>document.getElementById(id);
const crystalSvg='<svg class="facets" viewBox="0 0 184 217" preserveAspectRatio="none" aria-hidden="true"><path class="facet-a" d="M92 0 0 74 19 85 92 24Z"/><path class="facet-b" d="M184 74 165 85 165 132 92 194 92 217 184 141Z"/><path class="facet-c" d="M0 141 19 132 92 194 92 217Z"/><path class="edge" d="M92 1 183 74v67l-91 75L1 141V74Z"/><path class="cut" d="m92 24 73 61v47l-73 62-73-62V85ZM92 1v23M1 74l18 11M183 74l-18 11M1 141l18-9M183 141l-18-9M92 194v22"/></svg>';
let snapshot={sessions:[],health:{}},pages={running:0,waiting:0,completed:0},scale=1;
let dismissedCompletions={},displayDay=window.completedCards.dayKey(Date.now());
let view={layout:'crystal',collapsed:false,side:'right'},columnOverrides={},previousCounts={};
const interactions=new window.InteractionGate();
const openingSessions=new Set();let lastOpenError='';
let interactionTimeout,releaseTimer,interactionDelay=0;
function releaseInteraction(event){clearTimeout(interactionTimeout);clearTimeout(releaseTimer);releaseTimer=setTimeout(()=>interactions.end(),event?.type==='pointerup'?interactionDelay:0);}
document.addEventListener('pointerdown',event=>{if(event.target.closest('button,input,select')){clearTimeout(releaseTimer);interactionDelay=event.target.closest('.crystal,[data-history-id]')?700:0;interactions.begin();clearTimeout(interactionTimeout);interactionTimeout=setTimeout(()=>interactions.end(),10000);}},true);
document.addEventListener('pointerup',releaseInteraction,true);document.addEventListener('pointercancel',releaseInteraction,true);window.addEventListener('blur',releaseInteraction);
let paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
const labels={running:'执行中',waiting:'待确认',completed:'已完成',interrupted:'已中断',unknown:'状态未知'};
const groupLabels={running:'执行中',waiting:'待确认',completed:'已完成'};
let notice='',noticeTimer;
function showNotice(message){notice=message;clearTimeout(noticeTimer);render();noticeTimer=setTimeout(()=>{notice='';render()},5000)}
function setMotion(value){paused=value;document.body.classList.toggle('still',paused);$('motion').setAttribute('aria-pressed',String(paused));$('motion').textContent=paused?'恢复动效':'暂停动效';}
setMotion(paused);
$('motion').onclick=()=>{setMotion(!paused);api.savePreferences({paused})};
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>setMotion(event.matches));
function formatTime(value){if(!value)return '';const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';return d.toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}
function elapsed(value){if(!value)return '';const seconds=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));if(!Number.isFinite(seconds))return '';return seconds<3600?Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):Math.floor(seconds/3600)+'小时'+Math.floor(seconds%3600/60)+'分'}
function bindSessionActivation(button,id){button.onclick=event=>event.preventDefault();button.ondblclick=event=>{event.preventDefault();openConversation(id)};button.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();if(!event.repeat)openConversation(id)}};button.title='双击打开会话（或按 Enter）\n'+(button.title||button.textContent);}
function card(s){const b=document.createElement('button');b.className='crystal';b.dataset.state=s.state;b.dataset.id=s.id;b.disabled=openingSessions.has(s.id);b.title=(s.title||'未命名会话')+'\n'+(s.cwd||'工作空间未知');b.setAttribute('aria-label',b.title+'，'+(labels[s.state]||'待确认'));b.innerHTML='<span class="glass"></span>'+crystalSvg+'<span class="card-copy"><span class="workspace"><span class="parent"></span><span class="folder"></span></span><span class="card-title"></span><span class="card-status"></span></span>';const dirs=(s.cwd||'工作空间未知').split('/').filter(Boolean).slice(-3);b.querySelector('.parent').textContent=dirs.slice(0,-1).join(' / ');b.querySelector('.folder').textContent=dirs.at(-1)||'工作空间未知';b.querySelector('.card-title').textContent=s.title||'未命名会话';b.querySelector('.card-status').textContent=(s.state==='running'?(s.phase||'处理中')+' '+elapsed(s.startedAt):s.state==='waiting'?(s.waitReason==='approval'?'需要审批':'需要输入'):labels[s.state]+' '+formatTime(s.completedAt||s.updatedAt));const time=document.createElement('span');time.className='card-time';time.textContent=formatTime(s.state==='completed'?s.completedAt:s.updatedAt);b.querySelector('.card-copy').append(time);bindSessionActivation(b,s.id);if(s.state!=='completed')return b;const holder=document.createElement('div');holder.className='crystal-holder';const remove=document.createElement('button');remove.className='dismiss-completed';remove.title='从挂件移除，历史记录仍保留';remove.setAttribute('aria-label','移除已完成会话：'+(s.title||'未命名会话'));remove.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg>';remove.onclick=async()=>{remove.disabled=true;try{const result=await api.dismissCompleted(s.id);if(!result.ok){$('health').textContent=result.error;remove.disabled=false;return}dismissedCompletions=result.dismissed;render();$('showHistory').focus({preventScroll:true})}catch{$('health').textContent='移除未保存，请重试';remove.disabled=false}};holder.append(b,remove);return holder}
function group(state,rows){
  const root=document.createElement('section');root.className='group '+state+(state==='completed'?' complete':'');root.dataset.group=state;root.classList.toggle('is-empty',!rows.length);root.setAttribute('aria-label',groupLabels[state]+'会话');
  if(previousCounts[state]===0&&rows.length>0)delete columnOverrides[state];
  previousCounts[state]=rows.length;
  const open=window.taskView.columnOpen(rows.length,columnOverrides[state]);root.classList.toggle('is-collapsed',!open);
  const head=document.createElement('button');head.className='group-head';head.dataset.column=state;head.setAttribute('aria-expanded',String(open));head.setAttribute('aria-controls','column-'+state);head.title=rows.length?(open?'收起':'展开')+groupLabels[state]:'暂无'+groupLabels[state]+'任务，点击查看说明';
  head.innerHTML='<i class="state-dot" aria-hidden="true"></i><span></span><strong></strong><svg class="column-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m5 6 3 3 3-3"/></svg>';
  head.querySelector('span').textContent=groupLabels[state];head.querySelector('strong').textContent=rows.length;
  head.onclick=()=>{if(!rows.length){showNotice({running:'当前没有执行中的任务，开始任务后会自动显示。',waiting:'暂无待确认任务；需要审批或输入信息时会显示在这里。',completed:'今天暂无已完成任务，往日记录可在完成历史中查看。'}[state]);return}columnOverrides[state]=!open;render();document.querySelector('[data-column="'+state+'"]')?.focus({preventScroll:true})};root.append(head);
  const content=document.createElement('div');content.id='column-'+state;content.className='column-content';content.hidden=!open;root.append(content);if(!open)return root;
  if(!rows.length){const p=document.createElement('p');p.className='empty-message';p.textContent={running:'没有执行中的任务',waiting:'暂时不需要你处理',completed:'今天还没有完成的任务'}[state];content.append(p);return root;}
  if(view.layout==='board'){const list=document.createElement('div');list.className='board-list';for(const s of rows)list.append(card(s));content.append(list);return root;}
  const max=Math.max(0,Math.ceil(rows.length/4)-1);pages[state]=Math.min(pages[state],max);
  const list=document.createElement('div');list.className='strands';const visible=rows.slice(pages[state]*4,pages[state]*4+4);
  for(let column=0;column<2;column++){
    const strand=document.createElement('div');strand.className='strand';const values=visible.filter((_s,index)=>index%2===column);
    if(!values.length)strand.classList.add('empty-strand');
    for(const s of values){const rope=document.createElement('i');rope.className='rope';strand.append(rope,card(s))}
    list.append(strand);
  }
  content.append(list);
  if(max>0){const nav=document.createElement('div');nav.className='group-pagination';for(const [name,d,disabled]of [['上一组',-1,pages[state]===0],['下一组',1,pages[state]===max]]){const b=document.createElement('button');b.textContent=name;b.disabled=disabled;b.onclick=()=>{pages[state]+=d;render()};nav.append(b)}content.append(nav)}return root;
}
async function openConversation(id){if(openingSessions.has(id))return;openingSessions.add(id);lastOpenError='';$('health').textContent='正在打开 Codex 会话…';try{const result=await api.openSession(id);if(!result.ok)lastOpenError=result.error||'无法打开 Codex 会话'}catch{lastOpenError='无法打开 Codex 会话，请重试'}finally{openingSessions.delete(id);render()}}
function render(){if(interactions.active){interactions.request(render);return;}const focusKey=document.activeElement?.id;const columnFocus=document.activeElement?.dataset?.column;const historyFocus=document.activeElement?.dataset?.historyId;const focused=document.activeElement?.dataset?.id;const historyScroll=$('history').scrollTop;const groups=$('groups');const tasks=window.taskView.taskGroups(snapshot.sessions,dismissedCompletions);const scrolls={};groups.querySelectorAll('.column-content').forEach(el=>scrolls[el.id]=el.scrollTop);groups.replaceChildren(...Object.entries(tasks).map(([state,rows])=>group(state,rows)));groups.classList.toggle('all-collapsed',!groups.querySelector('.group:not(.is-collapsed)'));groups.querySelectorAll('.column-content').forEach(el=>el.scrollTop=scrolls[el.id]||0);$('drawerRunning').textContent=tasks.running.length;$('drawerWaiting').textContent=tasks.waiting.length;$('drawerCompleted').textContent=tasks.completed.length;$('expandDrawer').classList.toggle('needs-attention',tasks.waiting.length>0);$('expandDrawer').title=`展开会话抽屉 · 执行中 ${tasks.running.length} · 待确认 ${tasks.waiting.length} · 今日完成 ${tasks.completed.length}`;$('expandDrawer').setAttribute('aria-label',$('expandDrawer').title);if(focused)document.querySelector('.crystal[data-id="'+CSS.escape(focused)+'"]')?.focus({preventScroll:true});const health=snapshot.health||{};$('health').textContent=lastOpenError||notice|| (health.status==='degraded'?'监听提示：'+(health.message||'部分会话暂不可读'):'本地监听中 · '+snapshot.sessions.length+' 个会话');if(!$('history').hidden)renderHistory();const unknown=snapshot.sessions.filter(s=>s.state==='unknown').length;$('unknownCount').hidden=!unknown;$('unknownCount').textContent='状态未知 '+unknown;if(columnFocus)document.querySelector('[data-column="'+columnFocus+'"]')?.focus({preventScroll:true});if(focusKey)$(focusKey)?.focus({preventScroll:true});if(historyFocus)document.querySelector('[data-history-id="'+CSS.escape(historyFocus)+'"]')?.focus({preventScroll:true});$('history').scrollTop=historyScroll;resize()}
function renderHistory(){if(interactions.active){interactions.request(render);return;}const rows=snapshot.sessions.filter(s=>$('historyState').value==='all'||($('historyState').value==='unknown'?s.state==='unknown':['completed','interrupted'].includes(s.state))).filter(s=>((s.title||'')+' '+(s.cwd||'')).toLowerCase().includes($('search').value.trim().toLowerCase())).sort((a,b)=>new Date(b.completedAt||b.updatedAt)-new Date(a.completedAt||a.updatedAt));$('results').replaceChildren();$('history-count').textContent='找到 '+rows.length+' 个会话';for(const s of rows.slice(0,200)){const li=document.createElement('li'),b=document.createElement('button'),small=document.createElement('small');b.dataset.historyId=s.id;b.disabled=openingSessions.has(s.id);b.textContent=s.title||'未命名会话';bindSessionActivation(b,s.id);small.textContent=(s.cwd||'工作空间未知')+' · '+labels[s.state]+' '+formatTime(s.completedAt||s.updatedAt);li.append(b,small);$('results').append(li)}if(!rows.length){const li=document.createElement('li');li.textContent='没有匹配的会话';$('results').append(li)}if(rows.length>200){const li=document.createElement('li');li.textContent='显示最近200条，请输入关键词缩小范围';$('results').append(li)}resize()}
function toggleHistory(open){$('history').hidden=!open;$('showHistory').setAttribute('aria-expanded',String(open));if(open){renderHistory();$('search').focus()}else $('showHistory').focus();resize()}
$('showHistory').onclick=()=>{$('historyState').value='ended';toggleHistory($('history').hidden)};$('closeHistory').onclick=()=>toggleHistory(false);$('history').onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();toggleHistory(false)}};$('search').oninput=renderHistory;$('historyState').onchange=renderHistory;$('unknownCount').onclick=()=>{$('historyState').value='unknown';toggleHistory(true)};
$('reset').onclick=()=>api.home();$('quit').onclick=()=>api.quit();
function showPinned(value){$('pin').setAttribute('aria-pressed',String(value));$('pin').textContent=value?'取消置顶':'置顶';resize();}
$('pin').onclick=async()=>{try{showPinned(await api.setPinned($('pin').getAttribute('aria-pressed')!=='true'))}catch{$('health').textContent='窗口层级切换失败，请重试'}};
$('previewFireworks').onclick=async()=>{try{await api.previewFireworks();$('previewFireworks').textContent='播放中…';setTimeout(()=>{$('previewFireworks').textContent='试放烟花'},5100)}catch{$('health').textContent='烟花播放失败，请重启挂件'}};
$('scaleDown').onclick=async()=>{scale=await api.setScale(scale-.1);resize()};$('scaleUp').onclick=async()=>{scale=await api.setScale(scale+.1);resize()};
function moveWithKeyboard(e){const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(d){e.preventDefault();api.move({x:d[0]*(e.shiftKey?24:6),y:d[1]*(e.shiftKey?24:6)})}else if(['Home','Enter',' '].includes(e.key)){e.preventDefault();api.home()}};
$('staff').onkeydown=moveWithKeyboard;$('moveWindow').onkeydown=moveWithKeyboard;
const staff=$('staff'),staffDragController=new window.StaffDrag({start:point=>api.beginStaffDrag(point),move:point=>api.moveStaffDrag(point),end:moved=>api.endStaffDrag(moved)});
function bindWindowDrag(handle){
  handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();handle.setPointerCapture(event.pointerId);interactions.begin();staffDragController.down({x:event.screenX,y:event.screenY});});
  handle.addEventListener('pointermove',event=>staffDragController.move({x:event.screenX,y:event.screenY}));
  handle.addEventListener('pointerup',event=>{staffDragController.up();if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);releaseInteraction(event)});
  handle.addEventListener('pointercancel',()=>{staffDragController.up();releaseInteraction()});
  handle.addEventListener('lostpointercapture',()=>{staffDragController.up();releaseInteraction()});
  handle.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation()});
}
bindWindowDrag(staff);bindWindowDrag($('moveWindow'));window.addEventListener('blur',()=>staffDragController.up());
function updateInputRegions(){const regions=[...document.querySelectorAll('button,input,select,.staff,.history,.board-list')].map(element=>{const r=element.getBoundingClientRect(),extra=element.id==='staff'?7:0;return{x:r.x-extra,y:r.y-extra,width:r.width+extra*2,height:r.height+extra*2};}).filter(r=>r.width>0&&r.height>0&&r.y+r.height>0&&r.y<innerHeight);api.setInputRegions?.(regions);}
let sizeTimer;function resize(){clearTimeout(sizeTimer);sizeTimer=setTimeout(()=>{if(!view.collapsed)api.resize(Math.ceil(document.querySelector('.page').scrollHeight+20),document.querySelectorAll('.group:not(.is-collapsed)').length);updateInputRegions();},80)}
document.addEventListener('scroll',updateInputRegions,true);window.addEventListener('resize',updateInputRegions);
function setView(next){
  view={...view,...next};document.body.classList.toggle('layout-board',view.layout==='board');document.body.classList.toggle('drawer-collapsed',view.collapsed);document.body.dataset.drawerSide=view.side;
  $('drawerTab').hidden=!view.collapsed;$('app-scroll').hidden=view.collapsed;
  $('layoutToggle').textContent=view.layout==='board'?'切换挂件':'切换看板';$('layoutToggle').title=view.layout==='board'?'切换到水晶挂件':'切换到三栏看板';$('layoutToggle').setAttribute('aria-pressed',String(view.layout==='board'));
  render();
}
async function changeView(action){try{setView(await action())}catch{$('health').textContent='窗口切换失败，请重试'}}
$('layoutToggle').onclick=()=>changeView(()=>api.setLayout(view.layout==='board'?'crystal':'board'));
$('collapseDrawer').onclick=async()=>{await changeView(()=>api.setDrawer(true));$('expandDrawer').focus({preventScroll:true})};
$('expandDrawer').onclick=async()=>{await changeView(()=>api.setDrawer(false));$('collapseDrawer').focus({preventScroll:true})};
$('drawerSide').onclick=()=>changeView(()=>api.setDrawerSide(view.side==='right'?'left':'right'));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('history').hidden&&!view.collapsed){e.preventDefault();changeView(()=>api.setDrawer(true))}});
api.onView?.(setView);
api.onChange(data=>{snapshot=data;render()});
Promise.all([api.snapshot(),api.getPreferences()]).then(([data,prefs])=>{snapshot=data;dismissedCompletions=prefs.dismissedCompletions&&typeof prefs.dismissedCompletions==='object'?prefs.dismissedCompletions:{};scale=prefs.scale||1;setView({layout:prefs.layout==='board'?'board':'crystal',collapsed:prefs.drawerCollapsed===true,side:prefs.drawerSide==='left'?'left':'right'});showPinned(prefs.pinned===true);setMotion(typeof prefs.paused==='boolean'?prefs.paused:matchMedia('(prefers-reduced-motion: reduce)').matches);render()}).catch(()=>{$('health').textContent='无法连接监听服务，请重启挂件'});
setInterval(()=>{const day=window.completedCards.dayKey(Date.now());if(day!==displayDay){displayDay=day;pages.completed=0;render()}document.querySelectorAll('.crystal').forEach(b=>{const s=snapshot.sessions.find(s=>s.id===b.dataset.id);if(s?.state==='running')b.querySelector('.card-status').textContent=(s.phase||'处理中')+' '+elapsed(s.startedAt)})},1000);
