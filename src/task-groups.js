(function(root){
  'use strict';
  const completed=typeof module!=='undefined'&&module.exports?require('./completed-cards.js'):root.completedCards;
  function taskGroups(sessions,dismissed={},now=Date.now()){
    const newest=(a,b)=>(b.updatedAt||0)-(a.updatedAt||0)||String(a.id).localeCompare(String(b.id));
    return {
      running:sessions.filter(s=>s.state==='running').sort(newest),
      waiting:sessions.filter(s=>s.state==='waiting').sort(newest),
      completed:completed.visibleCompleted(sessions,dismissed,now).sort((a,b)=>(b.completedAt||b.updatedAt||0)-(a.completedAt||a.updatedAt||0)||String(a.id).localeCompare(String(b.id)))
    };
  }
  function columnOpen(count,override){return count>0&&(typeof override==='boolean'?override:true);}
  const api={taskGroups,columnOpen};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.taskView=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
