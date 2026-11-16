import {useEffect,useState} from 'react';
const DAY=86400000,OFFSET=8*3600000;
export const shanghaiToday=(now=Date.now())=>new Date(Number(now)+OFFSET).toISOString().slice(0,10);
export function useShanghaiToday(active){
 const [today,setToday]=useState(()=>shanghaiToday());
 useEffect(()=>{if(!active)return;let timer;const tick=()=>{setToday(shanghaiToday());timer=setTimeout(tick,DAY-((Date.now()+OFFSET)%DAY)+50)};tick();return()=>clearTimeout(timer)},[active]);
 return today;
}
export function currentCutoffWeeks(weeks,calendar,entry){
 const week=Number(calendar?.week);if(!Number.isInteger(week)||week<1)return [];
 const valid=[...new Set((weeks||[]).filter(w=>Number.isInteger(w)&&w>=1&&w<=week))].sort((a,b)=>a-b);
 if(!valid.length)return entry==='automatic'?Array.from({length:week},(_,i)=>i+1):[week];
 const end=valid[valid.length-1];return [...valid,...Array.from({length:week-end},(_,i)=>end+i+1)];
}
export const sameWeeks=(a=[],b=[])=>a.length===b.length&&a.every((w,i)=>w===b[i]);
export function currentDraftCutoffs(draft,calendar,entry,today){
 return {...draft,toDate:today,weeks:currentCutoffWeeks(draft.weeks,calendar,entry)};
}
