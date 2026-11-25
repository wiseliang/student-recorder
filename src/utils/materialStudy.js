import {selectMemoryCards,restoreMemoryRound} from './memoryCore';

export const STUDY_ATTRIBUTES={focus:'重点关注群体',situation:'学情',committee:'班委情况',political:'政治面貌',other:'其他情况'};

function studentKey(card) {
  const key=card.sourceId;
  return typeof key==='string'?key.slice(0,key.lastIndexOf(':')):'';
}

export function scopeCards(pack,scopeId) {
  if(!scopeId)return pack.cards;
  const scope=pack.importScopes?.find(item=>item.id===scopeId);
  if(!scope?.studentIds)return [];
  const allowed=new Set(scope.studentIds);
  return pack.cards.filter(card=>allowed.has(studentKey(card)));
}

export function attributeValues(cards,attributes,key,className='') {
  const values=cards.flatMap(card=>className&&card.className!==className?[]:attributes?.[studentKey(card)]?.[key]||[]);
  return [...new Set(values)].sort((left,right)=>left.localeCompare(right,'zh-CN'));
}

export function studyCards(pack,filters,ratings) {
  const {scopeId,attribute,attributeValue}=filters;
  const cards=scopeCards(pack,scopeId);
  const filtered=cards.filter(card=>{
    if(!attribute)return true;
    const values=pack.studentAttributes?.[studentKey(card)]?.[attribute]||[];
    return attributeValue?values.includes(attributeValue):values.length>0;
  });
  return selectMemoryCards(filtered,filters,ratings);
}

const normalizeAnswer=value=>value.normalize('NFKC').replace(/\s+/gu,'').toLowerCase();
export const objectiveCard=card=>['name','class'].includes(card.kind);

export function createStudyRound(cards) {
  return {
    ids:cards.map(card=>card.id),currentId:cards[0].id,index:0,revealed:false,finished:false,
    revisions:Object.fromEntries(cards.map(card=>[card.id,card.revision])),
  };
}

export function createExam(cards) {
  return {...createStudyRound(cards),responses:{},submitted:false};
}

export function restoreExam(saved,cards) {
  if(!saved)return null;
  const round=restoreMemoryRound(saved,cards);
  if(!round)return null;
  const ids=new Set(round.ids);
  const responses=Object.fromEntries(Object.entries(saved.responses||{}).filter(([id])=>ids.has(id)&&saved.revisions?.[id]===round.revisions[id]));
  const changed=round.ids.length!==saved.ids.length||round.ids.some(id=>round.revisions[id]!==saved.revisions?.[id]);
  return {...round,responses,submitted:!changed&&!!saved.submitted};
}

export function examSummary(exam,cards) {
  const byId=new Map(cards.map(card=>[card.id,card]));
  return exam.ids.map(id=>{
    const card=byId.get(id);
    if(!card)return null;
    const answer=exam.responses[id]?.trim()||'';
    const correct=objectiveCard(card)?!!answer&&card.answer.some(value=>normalizeAnswer(value)===normalizeAnswer(answer)):null;
    return {card,answer,correct};
  }).filter(Boolean);
}
