const {completionStamp}=require('./completed-cards.js');
class CompletionDetector{
 constructor(now=Date.now()){this.startedAt=now;this.primed=false;this.seen=new Set();}
 completion(session,now=Date.now()){
  if(session.state!=='completed')return false;
  const stamp=completionStamp(session),key=session.id+':'+stamp,at=Date.parse(stamp);
  if(!stamp||this.seen.has(key))return false;
  this.seen.add(key);if(this.seen.size>4096)this.seen.delete(this.seen.values().next().value);
  return this.primed&&at>=this.startedAt&&at<=now+1000&&now-at<=30000;
 }
 update(sessions,now=Date.now()){
  const fresh=[];
  for(const session of sessions)if(this.completion(session,now))fresh.push(session.id);
  this.primed=true;return fresh;
 }
}
module.exports={CompletionDetector};
