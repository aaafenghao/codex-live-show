(function(root){
 'use strict';
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
 function dayKey(value){if(value===null||value===undefined||value==='')return '';const date=new Date(value);return Number.isFinite(date.getTime())?formatter.format(date):'';}
 function completionStamp(session){const value=session.completedAt??session.updatedAt;const date=new Date(value);return value!==null&&value!==undefined&&Number.isFinite(date.getTime())?date.toISOString():'';}
 function visibleCompleted(sessions,dismissed={},now=Date.now()){const today=dayKey(now);return sessions.filter(s=>s.state==='completed'&&dayKey(s.completedAt??s.updatedAt)===today&&completionStamp(s)!==dismissed[s.id]);}
 const api={dayKey,completionStamp,visibleCompleted};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.completedCards=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
