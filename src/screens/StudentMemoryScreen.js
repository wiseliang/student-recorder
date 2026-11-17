import React,{useState,useRef,useCallback} from 'react';
import {Image,View,AppState} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Card,Title,Body,Button,Choice,ErrorBox,Pill,SectionHeader} from '../components/ui';
import {post,identityContext} from '../utils/api';
import {readMemory,writeMemory,eventId} from '../utils/memoryStore';
import {MEMORY_LEVELS,selectMemoryCards,restoreMemoryRound,applyMemoryEvent} from '../utils/memoryCore';
const kinds={name:'看照片记姓名',class:'看照片记班级',committee:'班委情况',political:'政治面貌',focus:'重点关注群体',reason:'关注原因',situation:'学情',other:'其他情况'};
const empty=()=>({ratings:{},queue:[],round:null,serverRevision:0,dirty:false});
export default function StudentMemoryScreen({route,navigation}){
 const {projectId,accountKey,title}=route.params,base='/api/materials/projects/'+projectId;
 const [pack,P]=useState(null),[local,L]=useState(empty),[busy,B]=useState(false),[error,E]=useState(null),[notice,N]=useState(''),[filters,F]=useState({className:'',kind:'',dueOnly:false,random:false}),[showFilters,V]=useState(false),[cloud,C]=useState(null);
 const ref=useRef(empty()),packRef=useRef(null),alive=useRef(false),locked=useRef(false),owner=useRef(null),scroll=useRef(null);
 const sameOwner=async()=>{if(await identityContext()!==owner.current)throw Error('账号已切换，请从当前账号重新打开记忆资料')};
 const save=async value=>{await sameOwner();await writeMemory(accountKey,projectId,'state',value);ref.current=value;if(alive.current)L(value)};
 const run=async fn=>{if(locked.current)return;locked.current=true;if(alive.current){B(true);E(null)}try{await sameOwner();await fn()}catch(e){if(alive.current)E(e)}finally{locked.current=false;if(alive.current)B(false)}};
 const flush=async()=>{while(ref.current.queue.length){const batch=ref.current.queue.slice(0,200),r=await post(base+'/events',{events:batch}),acked=new Set(r.ids);if(!acked.size)throw Error('复习记录未获确认，已保留在本机');await save({...ref.current,queue:ref.current.queue.filter(e=>!acked.has(e.id))})}};
 const uploadProgress=async()=>{const value=ref.current;if(!value.round||!value.dirty)return;try{const r=await post(base+'/progress',{progress:value.round,expectedRevision:value.serverRevision});await save({...ref.current,serverRevision:r.revision,dirty:false});if(alive.current)N('复习记录与本轮进度已保存')}catch(e){if(e.status===409){if(alive.current)N('另一设备已更新进度。本机轮次已保留，可点“同步最新资料”后选择云端轮次。')}throw e}};
 const sync=async()=>{
  await flush();const remote=await post(base+'/memory',{}, {timeout:120000});await sameOwner();
  if(remote.accountKey!==accountKey)throw Error('学校账号已切换，请返回项目列表重新打开');
  const previous=ref.current;let ratings={...remote.ratings};for(const e of previous.queue)ratings=applyMemoryEvent(ratings,e,remote.cards.find(c=>c.id===e.cardId));
  const cloudRevision=remote.progress?.serverRevision||0,round=restoreMemoryRound(previous.round||remote.progress,remote.cards);
  const conflict=!!previous.round&&previous.dirty&&previous.serverRevision!==cloudRevision;
  const next={...previous,ratings,round,serverRevision:conflict?previous.serverRevision:cloudRevision};
  await writeMemory(accountKey,projectId,'pack',remote);packRef.current=remote;if(alive.current){P(remote);C(conflict?remote.progress:null)}await save(next);
  if(conflict){N('资料已更新。另一设备的轮次不同，本机轮次保留，请选择是否读取云端轮次。');return}
  await uploadProgress();if(alive.current)N('资料与记录已同步；可在断网后继续背诵');
 };
 useFocusEffect(useCallback(()=>{alive.current=true;void (async()=>{owner.current=await identityContext();try{const [cached,state]=await Promise.all([readMemory(accountKey,projectId,'pack'),readMemory(accountKey,projectId,'state')]);if(!alive.current)return;ref.current=state||empty();packRef.current=cached;if(cached){ref.current={...ref.current,round:restoreMemoryRound(ref.current.round,cached.cards)};P(cached);L(ref.current);N('已打开本机资料；联网时可同步最新内容')}else await run(sync)}catch(e){if(alive.current)E(e)}})();const sub=AppState.addEventListener('change',s=>{if(s!=='active'&&ref.current.round&&!locked.current)void run(async()=>{await flush();await uploadProgress()})});return()=>{alive.current=false;sub.remove();if(ref.current.round&&!locked.current)void run(async()=>{await flush();await uploadProgress()})}},[projectId,accountKey]));
 const start=()=>run(async()=>{const cards=selectMemoryCards(packRef.current.cards,filters,ref.current.ratings);if(!cards.length)throw Error('当前筛选没有需要复习的卡片，请调整班级、题型或到期筛选');const round={ids:cards.map(c=>c.id),currentId:cards[0].id,index:0,revealed:false,finished:false,revisions:Object.fromEntries(cards.map(c=>[c.id,c.revision]))};await save({...ref.current,round,dirty:true});V(false);N('');scroll.current?.scrollTo({y:0,animated:true})});
 const changeRound=async updates=>save({...ref.current,round:{...ref.current.round,...updates},dirty:true});
 const move=async delta=>{const r=ref.current.round,index=Math.max(0,Math.min(r.ids.length-1,r.index+delta));await changeRound({index,currentId:r.ids[index],revealed:false,finished:false});scroll.current?.scrollTo({y:0,animated:true})};
 const rate=level=>run(async()=>{const r=ref.current.round,c=packRef.current.cards.find(c=>c.id===r.currentId);if(!c||!r.revealed)throw Error('先回忆并展开答案后再评价');const e={id:eventId(),cardId:c.id,revision:c.revision,level,created:Date.now()},ratings=applyMemoryEvent(ref.current.ratings,e,c),index=Math.min(r.index+1,r.ids.length-1);await save({...ref.current,ratings,queue:[...ref.current.queue,e],dirty:true,round:{...r,index,currentId:r.ids[index],revealed:false,finished:r.index===r.ids.length-1}});scroll.current?.scrollTo({y:0,animated:true})});
 const expired=pack&&Date.now()>pack.expiresAt,r=local.round,card=pack?.cards.find(c=>c.id===r?.currentId),image=card?.imageId&&pack.images[card.imageId],classes=[...new Set(pack?.cards.map(c=>c.className)||[])].sort();
 return <Page scrollRef={scroll}><Title>{title||'学生辨识记忆'}</Title><Body muted>先独立回忆，再展开答案并评价掌握程度。</Body><ErrorBox error={error}/>{!!notice&&<Body muted>{notice}</Body>}

 {expired&&<Card><Body>本机资料已超过30天，请联网确认当前管理范围并同步后继续。</Body></Card>}
 {cloud&&<Card><Body>云端存在另一设备更新的轮次。本机作答记录会保留，读取云端后从云端位置继续。</Body><Button title="读取云端轮次" disabled={busy} onPress={()=>run(async()=>{const restored=restoreMemoryRound(cloud,packRef.current.cards);await save({...ref.current,round:restored,serverRevision:cloud.serverRevision,dirty:false});C(null);N('已读取云端轮次')})}/><Button title="继续本机轮次（暂不同步轮次）" secondary onPress={()=>C(null)}/></Card>}
 {pack&&!expired&&<>
 {!r&&<Button title="开始背诵全部内容" disabled={busy} onPress={start}/>}
 {r?.finished&&<Card><Title>本轮已完成</Title><Body>已练习{r.ids.length}张。自评用于安排复习，不代表考试正确率。</Body><Button title="开始新一轮" disabled={busy} onPress={start}/><Button title="回看本轮最后一张" secondary disabled={busy} onPress={()=>run(()=>move(0))}/></Card>}
 {card&&!r.finished&&<Card><View style={{flexDirection:'row',justifyContent:'space-between'}}><Pill>{kinds[card.kind]||'辨识记忆'}</Pill><Body muted>{r.index+1} / {r.ids.length}</Body></View><Body>{card.question}</Body>{image&&<Image accessibilityLabel="待回忆的学生照片" source={{uri:'data:'+image.mime+';base64,'+image.base64}} resizeMode="contain" style={{width:'100%',height:270,backgroundColor:'#F7FAFE',borderRadius:12}}/>}
 {!r.revealed?<Button title="回忆后展开答案" disabled={busy} onPress={()=>run(()=>changeRound({revealed:true}))}/>:<View style={{gap:16}}><Body style={{fontSize:22,lineHeight:32,fontWeight:'600'}}>{card.answer.join('\n')}</Body><Body muted>按本次回忆情况选择：不会约10分钟后、模糊约1天后、熟练约7天后复习。</Body>{Object.entries(MEMORY_LEVELS).map(([level,label])=><Button key={level} title={label} secondary={level!=='known'} disabled={busy} onPress={()=>rate(level)}/>)}</View>}
 <View style={{flexDirection:'row',gap:12}}><Button title="上一张" secondary disabled={busy||r.index===0} onPress={()=>run(()=>move(-1))}/><Button title="跳过这一张" secondary disabled={busy||r.index===r.ids.length-1} onPress={()=>run(()=>move(1))}/></View></Card>}
 <Button secondary title={showFilters?'收起练习设置':'选择班级与练习内容'} onPress={()=>V(!showFilters)}/>
 {showFilters&&<Card><SectionHeader title="班级"/><Choice label="全部班级" selected={!filters.className} onPress={()=>F(f=>({...f,className:''}))}/>{classes.map(c=><Choice key={c} label={c} selected={filters.className===c} onPress={()=>F(f=>({...f,className:c}))}/>)}<SectionHeader title="练习内容"/><Choice label="全部内容" selected={!filters.kind} onPress={()=>F(f=>({...f,kind:''}))}/>{Object.entries(kinds).filter(([k])=>pack.cards.some(c=>c.kind===k)).map(([k,label])=><Choice key={k} label={label} selected={filters.kind===k} onPress={()=>F(f=>({...f,kind:k}))}/>)}<Choice label="只练新卡或已到复习时间的卡" selected={filters.dueOnly} onPress={()=>F(f=>({...f,dueOnly:!f.dueOnly}))}/><Choice label="随机顺序" selected={filters.random} onPress={()=>F(f=>({...f,random:!f.random}))}/><Button title="按当前设置开始新一轮" disabled={busy} onPress={start}/><Body muted>开始新一轮会替换当前轮次，掌握记录继续保留。</Body></Card>}
 {r&&<Button title="暂停并保存本轮" secondary disabled={busy} onPress={()=>run(async()=>{await save({...ref.current});try{await flush();await uploadProgress()}catch{N('已保存到本机，联网后点击同步即可上传')}navigation.goBack()})}/>}</>}
  <Card><Body>{pack?pack.cards.length+'张记忆卡 · 待同步记录 '+local.queue.length+'条':'首次使用请联网下载资料'}</Body>{pack&&<Body muted>下载于 {new Date(pack.downloadedAt).toLocaleDateString()} · 离线可用至 {new Date(pack.expiresAt).toLocaleDateString()}</Body>}<Button title="同步最新资料与复习记录" secondary loading={busy} onPress={()=>run(sync)}/></Card>
 </Page>;
}
