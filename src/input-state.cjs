// Track only explicit tool requests and their matching replies, never infer from prose.
function refreshWaiting(session, at) {
  const pending=Object.values(session.pendingInputs||{}).length>0;
  if(pending){session.state='waiting';session.waitReason='input';session.phase='需要输入';}
  else if(session.waitReason==='input'){
    session.state=session.turnEnded?'completed':'running';session.phase=session.turnEnded?'已完成':'处理中';delete session.waitReason;
  }
  session.updatedAt=at;
}
function recordInput(session, payload, at) {
  if(!Number.isFinite(at)||at<(session.updatedAt||0))return false;
  const name=String(payload.name||'').split('.').at(-1);
  if(payload.type==='function_call'&&['request_user_input','request_user_input_async'].includes(name)&&typeof payload.call_id==='string'){
    let args;try{args=JSON.parse(payload.arguments)}catch{return false}
    if(!Array.isArray(args.questions)||!args.questions.length)return false;
    session.pendingInputs={...session.pendingInputs,[payload.call_id]:{async:name.endsWith('_async'),remaining:args.questions.map((_,i)=>i)}};
    session.turnEnded=false;refreshWaiting(session,at);return true;
  }
  if(payload.type==='function_call_output'&&session.pendingInputs?.[payload.call_id]){
    const pending=session.pendingInputs[payload.call_id];let output;
    try{output=typeof payload.output==='string'?JSON.parse(payload.output):payload.output}catch{output=null}
    // An async acknowledgement leaves the question open. Failed calls do not.
    if(pending.async&&output?.accepted===true)return false;
    delete session.pendingInputs[payload.call_id];refreshWaiting(session,at);return true;
  }
  if(payload.type==='message'&&payload.role==='user'){
    const text=(payload.content||[]).map(item=>item.text||'').join('');
    const match=text.match(/^\s*<send_user_message_question_reply>\s*([\s\S]*?)\s*<\/send_user_message_question_reply>\s*$/);
    if(!match)return false;
    let replies;try{replies=JSON.parse(match[1])}catch{return false}
    if(!Array.isArray(replies))return false;
    let changed=false;
    for(const reply of replies){
      let key;try{key=JSON.parse(reply.questionItemId)}catch{continue}
      if(!Array.isArray(key)||key[0]!=='request_user_input_async')continue;
      const pending=session.pendingInputs?.[key[1]];
      if(!pending||!pending.remaining.includes(key[2]))continue;
      pending.remaining=pending.remaining.filter(index=>index!==key[2]);changed=true;
      if(!pending.remaining.length)delete session.pendingInputs[key[1]];
    }
    if(changed)refreshWaiting(session,at);
    return changed;
  }
  return false;
}
module.exports={recordInput,refreshWaiting};
