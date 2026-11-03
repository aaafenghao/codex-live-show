'use strict';
const canvas=document.getElementById('fireworks'),ctx=canvas.getContext('2d',{alpha:true});
const params=new URLSearchParams(location.search);
const gentle=params.get('mode')!=='full'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const duration=gentle?900:5000;
let width=innerWidth,height=innerHeight;
const ratio=Math.min(devicePixelRatio||1,1.75,Math.sqrt(8000000/(width*height)));
canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.scale(ratio,ratio);
let seed=80231;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const gold=['#e7b85f','#f8d99a','#fff0cc','#d89c45'],ice=['#a7e4e8','#d3f5f7'];
const bursts=[
 {x:width*.18,y:height*.28,t:.45,count:260,size:1.5},
 {x:width*.5,y:height*.4,t:.82,count:240,size:1.2},
 {x:width*.34,y:height*.2,t:1.75,count:260,size:1.5},
 {x:width*.1,y:height*.52,t:2.15,count:220,size:1.15},
 {x:width*.88,y:height*.52,t:3.3,count:240,size:1.35},
 {x:width*.22,y:height*.46,t:3.7,count:240,size:1.3},
 {x:width*.65,y:height*.2,t:5,count:260,size:1.5},
 {x:width*.76,y:height*.5,t:5.4,count:240,size:1.3}
];
const particles=[];
const radius=Math.min(width,height)*.25;
for(const burst of bursts)for(let i=0;i<burst.count;i++){const angle=i/burst.count*Math.PI*2+(random()-.5)*.12;const inner=i%4===0;const speed=radius*(inner?.12+random()*.3:.45+random()*.65)*burst.size;const long=i%2===0;particles.push({x:burst.x,y:burst.y,t:burst.t,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed*.88,tail:long?.18+random()*.16:.07+random()*.08,life:1.9+random()*1.05,size:1.2+random()*1.7,color:!long&&random()<.3?ice[Math.floor(random()*ice.length)]:gold[Math.floor(random()*gold.length)],crystal:!long&&random()<.12});}
const points=Array.from({length:30},()=>({x:width*(.2+random()*.6),y:height*(.15+random()*.35),size:.6+random()*.8}));
const paperColors=['#ff558a','#12cbe2','#a169ff','#ffd039','#22ca86','#ff8754'];
const confetti=Array.from({length:600},(_,i)=>({x:width*(-.02+random()*1.04),y:height*(.02+random()*.22),start:.3+Math.floor(i/200)*2.15+random()*.4,drift:(random()-.5)*135,speed:(height/1080)*(90+random()*80),size:8+random()*7,ribbon:i%5===0,spin:random()*Math.PI*2,color:paperColors[Math.floor(random()*paperColors.length)]}));
function position(p,age){const ease=(1-Math.exp(-1.1*age))/1.1;return{x:p.x+p.vx*ease,y:p.y+p.vy*ease+age*age*24};}
function draw(seconds){
 ctx.clearRect(0,0,width,height);ctx.globalCompositeOperation='lighter';
 if(gentle){ctx.fillStyle='#f6d69a';ctx.globalAlpha=Math.sin(Math.min(1,seconds/(duration/1000))*Math.PI)*.55;for(const p of points){ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;return;}
 for(const b of bursts){const flight=b.t-.05;if(seconds<flight&&seconds>flight-.46){const p=(seconds-(flight-.46))/.46;const x=width*.5+(b.x-width*.5)*p;const y=height*.96+(b.y-height*.96)*p;ctx.globalAlpha=Math.sin(p*Math.PI)*.65;ctx.strokeStyle='#f1cf87';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x-(b.x-width*.5)*.022,y+height*.025);ctx.lineTo(x,y);ctx.stroke();}}
 for(const p of particles){const age=seconds-p.t;if(age<0||age>p.life)continue;const progress=age/p.life;const alpha=Math.min(1,age/.08)*Math.pow(1-progress,.95)*.98;ctx.strokeStyle=p.color;ctx.fillStyle=p.color;const head=position(p,age);ctx.lineWidth=p.size*.95;for(let part=0;part<3;part++){const a=position(p,Math.max(0,age-p.tail*(1-part/3))),b=position(p,Math.max(0,age-p.tail*(1-(part+1)/3)));ctx.globalAlpha=alpha*Math.pow((part+1)/3,1.4);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}ctx.globalAlpha=alpha;if(p.crystal){const n=p.size*1.7;ctx.beginPath();ctx.moveTo(head.x,head.y-n);ctx.lineTo(head.x+n*.55,head.y);ctx.lineTo(head.x,head.y+n);ctx.lineTo(head.x-n*.55,head.y);ctx.closePath();ctx.fill();}else{ctx.beginPath();ctx.arc(head.x,head.y,p.size*.65,0,Math.PI*2);ctx.fill();}}
 ctx.globalAlpha=1;
 ctx.globalCompositeOperation='source-over';
 for(const p of confetti){const age=seconds-p.start;if(age<0||age>3.6)continue;ctx.globalAlpha=Math.min(1,age/.18)*Math.pow(1-age/3.6,.8)*.96;ctx.fillStyle=p.color;ctx.save();ctx.translate(p.x+p.drift*age+Math.sin(age*2+p.spin)*12,p.y+p.speed*age+age*age*24*(height/1080));ctx.rotate(p.spin+age*1.3);ctx.scale(1,.35+.65*Math.abs(Math.cos(age*2+p.spin)));ctx.fillRect(-p.size/2,-p.size*.3,p.ribbon?p.size*.35:p.size,p.ribbon?p.size*2.8:p.size*.7);ctx.restore();}ctx.globalAlpha=1;
}
let beginning,frame,finished=false;
function finish(){if(finished)return;finished=true;cancelAnimationFrame(frame);ctx.clearRect(0,0,width,height);window.celebration?.done();}
function tick(now){beginning??=now;const elapsed=now-beginning;if(elapsed>=duration){finish();return;}draw(elapsed/1000*(gentle?1:1.7));frame=requestAnimationFrame(tick);}
if(params.has('still'))draw(Number(params.get('still'))||1.25);else frame=requestAnimationFrame(tick);
window.addEventListener('pagehide',finish,{once:true});
