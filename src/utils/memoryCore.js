// Generated from palm-quiz/web/student-memory.js. Do not edit.
// source-sha256: 4db3c01905b720fd58efc989d31ae76ada3422892e393ccee5fbee142fc35fcd
const nextReview=function nextReview(level,now){return now+({weak:10*60000,unsure:86400000,known:7*86400000}[level]??86400000);};
export const MEMORY_PROTOCOL=1;
export const MEMORY_LEVELS={weak:'不会',unsure:'模糊',known:'熟练'};
export function memoryDue(level,at=Date.now()){if(!MEMORY_LEVELS[level])throw Error('请选择掌握程度');return nextReview(level,at)}
export function selectMemoryCards(cards,{className='',kind='',dueOnly=false,random=false}={},ratings={},now=Date.now()){
 const rows=cards.filter(c=>(!className||c.className===className)&&(!kind||c.kind===kind)&&(!dueOnly||!ratings[c.id]||ratings[c.id].revision!==c.revision||ratings[c.id].due<=now));
 if(random)for(let i=rows.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]]}return rows;
}
export function restoreMemoryRound(saved,cards){
 if(!saved?.ids?.length)return null;const byId=new Map(cards.map(c=>[c.id,c])),ids=saved.ids.filter(id=>byId.has(id));if(!ids.length)return null;
 const position=Math.max(0,ids.indexOf(saved.currentId));const current=byId.get(ids[position]);
 return {...saved,ids,index:position,currentId:current.id,revealed:saved.revisions?.[current.id]===current.revision&&!!saved.revealed,revisions:Object.fromEntries(ids.map(id=>[id,byId.get(id).revision]))};
}
export function applyMemoryEvent(ratings,event,card){if(!card||event.revision!==card.revision)return ratings;const prior=ratings[card.id];if(prior?.reviewed>event.created)return ratings;return {...ratings,[card.id]:{level:event.level,revision:event.revision,reviewed:event.created,due:memoryDue(event.level,event.created)}}}
