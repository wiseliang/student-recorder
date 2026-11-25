import React,{useState,useRef,useCallback} from 'react';
import {Image,View,AppState,Pressable,Modal} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Card,Title,Body,Button,Choice,ErrorBox,Pill,SectionHeader,Field,colors} from '../components/ui';
import {post,identityContext} from '../utils/api';
import {readMemory,writeMemory,eventId,clearMemoryPack} from '../utils/memoryStore';
import {STUDY_ATTRIBUTES,scopeCards,attributeValues,studyCards,createStudyRound,createExam,restoreExam,examSummary,objectiveCard} from '../utils/materialStudy';
import {MEMORY_LEVELS,restoreMemoryRound,applyMemoryEvent} from '../utils/memoryCore';
const kinds={profile:'整人背题',name:'看照片记姓名',class:'看照片记班级',committee:'班委情况',political:'政治面貌',focus:'重点关注群体',reason:'关注原因',situation:'学情',other:'其他情况'};
const empty=()=>({ratings:{},queue:[],round:null,exam:null,serverRevision:0,dirty:false});
export default function StudentMemoryScreen({route,navigation}){
 const {projectId,accountKey,title,bankId,importJobId,latestImportJobId}=route.params,base='/api/materials/projects/'+projectId;
 const storageId=bankId||projectId,bank=bankId?{bankId}:{};
 const [pack,P]=useState(null),[local,L]=useState(empty),[busy,B]=useState(false),[error,E]=useState(null),[notice,N]=useState(''),[filters,F]=useState({className:'',kind:'',dueOnly:false,random:false,attribute:'',attributeValue:''}),[showFilters,V]=useState(false),[cloud,C]=useState(null),[zoom,Z]=useState(false),[clearing,A]=useState(false),[syncStage,T]=useState('');
 const [mode,setMode]=useState('study'),[examInput,setExamInput]=useState(null),[confirmExam,setConfirmExam]=useState(false);
 const ref=useRef(empty()),packRef=useRef(null),alive=useRef(false),locked=useRef(false),owner=useRef(null),scroll=useRef(null);
 const sameOwner=async()=>{if(await identityContext()!==owner.current)throw Error('账号已切换，请从当前账号重新打开记忆资料')};
 const save=async value=>{await sameOwner();await writeMemory(accountKey,storageId,'state',value);ref.current=value;if(alive.current)L(value)};
 const run=async fn=>{if(locked.current)return;locked.current=true;if(alive.current){B(true);E(null)}try{await sameOwner();await fn()}catch(e){if(alive.current)E(e)}finally{locked.current=false;if(alive.current)B(false)}};
 const flush=async()=>{while(ref.current.queue.length){const batch=ref.current.queue.slice(0,200),r=await post(base+'/events',{...bank,events:batch}),acked=new Set(r.ids);if(!acked.size)throw Error('复习记录未获确认，已保留在本机');await save({...ref.current,queue:ref.current.queue.filter(e=>!acked.has(e.id))})}};
 const uploadProgress=async()=>{const value=ref.current;if(!value.round||!value.dirty)return;try{const r=await post(base+'/progress',{...bank,progress:value.round,expectedRevision:value.serverRevision});await save({...ref.current,serverRevision:r.revision,dirty:false});if(alive.current)N('复习记录与本轮进度已保存')}catch(e){if(e.status===409){if(alive.current)N('另一设备已更新进度。本机轮次已保留，可点“同步最新资料”后选择云端轮次。')}throw e}};
 const sync=async()=>{
  T('正在连接学习服务…');
  try {
  await flush();T('正在下载记忆卡和照片…');const remote=await post(base+'/memory',{...bank,profileCards:true}, {timeout:120000});await sameOwner();
  if(remote.accountKey!==accountKey||(bankId&&remote.bankId!==bankId))throw Error('学校账号已切换，请返回项目列表重新打开');
  const previous=ref.current;let ratings={...remote.ratings};for(const e of previous.queue)ratings=applyMemoryEvent(ratings,e,remote.cards.find(c=>c.id===e.cardId));
  const cloudRevision=remote.progress?.serverRevision||0,round=restoreMemoryRound(previous.round||remote.progress,remote.cards.filter(card=>card.kind==='profile'));
  const conflict=!!previous.round&&previous.dirty&&previous.serverRevision!==cloudRevision;
  const next={...previous,ratings,round,exam:restoreExam(previous.exam,remote.cards),serverRevision:conflict?previous.serverRevision:cloudRevision};
  T('正在加密保存到本机…');
  await writeMemory(accountKey,storageId,'pack',remote);packRef.current=remote;if(alive.current){P(remote);C(conflict?remote.progress:null)}await save(next);
  if(conflict){N('资料已更新。另一设备的轮次不同，本机轮次保留，请选择是否读取云端轮次。');return}
  await uploadProgress();if(alive.current)N(remote.unavailablePhotoCount?'资料已同步，有 '+remote.unavailablePhotoCount+' 张照片无法读取':'资料与记录已同步；可在断网后继续背诵');
  } finally { if(alive.current)T(''); }
 };
 useFocusEffect(useCallback(()=>{
  alive.current=true;
  void (async()=>{
   owner.current=await identityContext();
   try{
    const [cached,state]=await Promise.all([readMemory(accountKey,storageId,'pack').catch(()=>null),readMemory(accountKey,storageId,'state')]);
    if(!alive.current)return;
    ref.current=state||empty();packRef.current=cached;
    if(cached){
     ref.current={...ref.current,round:restoreMemoryRound(ref.current.round,cached.cards.filter(card=>card.kind==='profile')),exam:restoreExam(ref.current.exam,cached.cards)};
     P(cached);L(ref.current);N('已打开本机资料；联网时可同步最新内容');
    }
    const expected=importJobId||latestImportJobId;
    if(!cached||!cached.cards.some(card=>card.kind==='profile')||(expected&&!cached.importScopes?.some(scope=>scope.id===expected)))await run(sync);
   }catch(e){if(alive.current)E(e)}
  })();
  const sub=AppState.addEventListener('change',value=>{if(value!=='active'&&ref.current.round&&!locked.current)void run(async()=>{await flush();await uploadProgress()})});
  return()=>{alive.current=false;sub.remove();if(ref.current.round&&!locked.current)void run(async()=>{await flush();await uploadProgress()})};
 },[projectId,accountKey,bankId,importJobId,latestImportJobId]));
 const scopeId=bankId?'':filters.scopeId??importJobId??latestImportJobId??pack?.importScopes?.[0]?.id??'';
 const start=()=>run(async()=>{
  const cards=studyCards(packRef.current,{...filters,scopeId,mode},ref.current.ratings);
  if(!cards.length)throw Error('当前范围没有可用题卡，请同步资料或调整范围');
  if(mode==='exam'){
   await save({...ref.current,exam:{...createExam(cards),scopeId}});
   setExamInput(null);setConfirmExam(false);
  }else await save({...ref.current,round:{...createStudyRound(cards),scopeId},dirty:true});
  V(false);N('');scroll.current?.scrollTo({y:0,animated:true})
 });
 const changeScope=id=>{F(old=>({...old,scopeId:id,className:'',kind:'',attribute:'',attributeValue:''}));setConfirmExam(false)};
 const chooseMode=value=>{setMode(value);setConfirmExam(false);V(false)};
 const saveExamAnswer=async({step=0,submit=false,exit=false}={})=>{
  const exam=ref.current.exam,answers={...exam.responses};
  if(!exam.submitted&&examInput?.id===exam.currentId&&examInput.revision===exam.revisions[exam.currentId])answers[exam.currentId]=examInput.value.trim();
  const index=Math.max(0,Math.min(exam.ids.length-1,exam.index+step));
  await save({...ref.current,exam:{...exam,responses:answers,index,currentId:exam.ids[index],submitted:exam.submitted||submit}});
  setExamInput(null);setConfirmExam(false);
  if(exit)navigation.goBack();
  else scroll.current?.scrollTo({y:0,animated:true});
 };
 const changeRound=async updates=>save({...ref.current,round:{...ref.current.round,...updates},dirty:true});
 const move=async delta=>{const r=ref.current.round,index=Math.max(0,Math.min(r.ids.length-1,r.index+delta));await changeRound({index,currentId:r.ids[index],revealed:false,finished:false});scroll.current?.scrollTo({y:0,animated:true})};
 const rate=level=>run(async()=>{const r=ref.current.round,c=packRef.current.cards.find(c=>c.id===r.currentId);if(!c||!r.revealed)throw Error('先回忆并展开答案后再评价');const e={id:eventId(),cardId:c.id,revision:c.revision,level,created:Date.now()},ratings=applyMemoryEvent(ref.current.ratings,e,c),index=Math.min(r.index+1,r.ids.length-1);await save({...ref.current,ratings,queue:[...ref.current.queue,e],dirty:true,round:{...r,index,currentId:r.ids[index],revealed:false,finished:r.index===r.ids.length-1}});scroll.current?.scrollTo({y:0,animated:true})});
 const expired=pack&&Date.now()>pack.expiresAt;
 const r=(local.round?.scopeId||'')===scopeId?local.round:null;
 const exam=(local.exam?.scopeId||'')===scopeId?local.exam:null;
 const card=pack?.cards.find(c=>c.id===(mode==='exam'?exam?.currentId:r?.currentId));
 const image=card?.imageId&&pack.images[card.imageId];
 const scoped=pack?scopeCards(pack,scopeId):[];
 const classes=[...new Set(scoped.map(c=>c.className))].sort();
 const scope=pack?.importScopes?.find(item=>item.id===scopeId);
 const hasScope=!!scope?.studentIds;
 const legacyScope=!!scope&&scope.studentIds===null;
 const attributeOptions=Object.keys(STUDY_ATTRIBUTES).filter(key=>attributeValues(scoped,pack?.studentAttributes,key,filters.className).length);
 const attributes=attributeValues(scoped,pack?.studentAttributes,filters.attribute,filters.className);
 const available=pack?studyCards(pack,{...filters,scopeId,mode,random:false},local.ratings).length:0;
 const examResults=exam?.submitted?examSummary(exam,pack?.cards||[]):[];
 const currentResult=examResults.find(item=>item.card.id===exam?.currentId);
 const draftAnswer=examInput?.id===exam?.currentId&&examInput?.revision===card?.revision?examInput?.value:undefined;
 const unanswered=exam?.ids.filter(id=>!(id===exam.currentId&&draftAnswer!==undefined?draftAnswer:exam.responses[id])?.trim()).length||0;
 const photo=image&&<Pressable accessibilityRole="button" accessibilityLabel="放大学生照片" onPress={()=>Z(true)}><Image accessibilityLabel="待回忆的学生照片" source={{uri:'data:'+image.mime+';base64,'+image.base64}} resizeMode="contain" style={{width:'100%',height:270,backgroundColor:colors.soft,borderRadius:12}}/></Pressable>;
 return <Page scrollRef={scroll}><Title>{title||'学生辨识记忆'}</Title><ErrorBox error={error}/>{!!notice&&<Body muted>{notice}</Body>}

 {expired&&<Card><Body>本机资料已超过30天，请联网确认当前管理范围并同步后继续。</Body></Card>}
 {cloud&&<Card><Body>云端存在另一设备更新的轮次。本机作答记录会保留，读取云端后从云端位置继续。</Body><Button title="读取云端轮次" disabled={busy} onPress={()=>run(async()=>{const restored=restoreMemoryRound(cloud,packRef.current.cards.filter(card=>card.kind==='profile'));await save({...ref.current,round:restored,serverRevision:cloud.serverRevision,dirty:false});C(null);N('已读取云端轮次')})}/><Button title="继续本机轮次（暂不同步轮次）" secondary onPress={()=>C(null)}/></Card>}
 {pack&&!expired&&<>
 <Card>
  <SectionHeader title="练习方式"/>
  <Choice label="背题模式" selected={mode==='study'} onPress={()=>chooseMode('study')}/>
  <Choice label="考试模式" selected={mode==='exam'} onPress={()=>chooseMode('exam')}/>
  <Body>{scopeId?(scope?.filename||'本次导入的 PPT'):(bankId?'本 PPT 题库':'项目全部学生')}</Body>
  <Body muted>{scopeId?(hasScope?scope.studentIds.length+' 名学生 · '+available+' 道可用题':(legacyScope?'这次导入没有保存学生范围，请重新导入，或在练习设置里切换范围。':'请联网同步，获取这次导入的学生范围。')):(bankId&&pack.studentCount!=null?pack.studentCount+' 条记录 · ':'')+available+(mode==='study'?' 张整人题卡':' 道可用题')}</Body>
  {mode==='study'&&!r&&<Button title={bankId||scopeId?'开始背诵本次范围':'开始背诵全部内容'} disabled={busy||!available} onPress={start}/>}
  {mode==='exam'&&!exam&&<Button title="开始考试" disabled={busy||!available} onPress={start}/>}
  <Button secondary title={showFilters?'收起练习设置':'选择范围、班级与练习内容'} onPress={()=>V(!showFilters)}/>
 </Card>
 {showFilters&&<Card>
  {!bankId&&<>
  <SectionHeader title="学生范围"/>
  <Choice label="项目全部学生" selected={!scopeId} onPress={()=>changeScope('')}/>
  {(pack.importScopes||[]).map(item=><Choice key={item.id} label={item.filename+' · '+(item.studentIds?item.studentIds.length+'人':'旧导入，范围未记录')+(item.importedAt?' · '+new Date(item.importedAt).toLocaleDateString():'')} selected={scopeId===item.id} onPress={()=>changeScope(item.id)}/>)}
  </>}
  <SectionHeader title="按班级背诵"/>
  <Choice label="全部班级" selected={!filters.className} onPress={()=>F(old=>({...old,className:'',attribute:'',attributeValue:''}))}/>
  {classes.map(name=><Choice key={name} label={name} selected={filters.className===name} onPress={()=>F(old=>({...old,className:name,attribute:'',attributeValue:''}))}/>)}
  <SectionHeader title="特殊属性学生"/>
  <Choice label="不限属性" selected={!filters.attribute} onPress={()=>F(old=>({...old,attribute:'',attributeValue:''}))}/>
  {attributeOptions.map(key=><Choice key={key} label={STUDY_ATTRIBUTES[key]} selected={filters.attribute===key} onPress={()=>F(old=>({...old,attribute:key,attributeValue:''}))}/>)}
  {filters.attribute&&attributes.length>1&&<>
   <Choice label="该属性全部学生" selected={!filters.attributeValue} onPress={()=>F(old=>({...old,attributeValue:''}))}/>
   {attributes.map(value=><Choice key={value} label={value} selected={filters.attributeValue===value} onPress={()=>F(old=>({...old,attributeValue:value}))}/>)}
  </>}
  {!pack.includePersonal&&<Body muted>重点关注群体、学情等属性可在项目的「背诵内容范围」中开启。</Body>}
  {mode==='exam'&&<>
  <SectionHeader title="练习内容"/>
  <Choice label="全部内容" selected={!filters.kind} onPress={()=>F(old=>({...old,kind:''}))}/>
  {Object.entries(kinds).filter(([key])=>key!=='profile'&&scoped.some(item=>item.kind===key)).map(([key,label])=><Choice key={key} label={label} selected={filters.kind===key} onPress={()=>F(old=>({...old,kind:key}))}/>)}
  </>}
  <Choice label="只练新卡或已到复习时间的卡" selected={filters.dueOnly} onPress={()=>F(old=>({...old,dueOnly:!old.dueOnly}))}/>
  <Choice label="随机顺序" selected={filters.random} onPress={()=>F(old=>({...old,random:!old.random}))}/>
  <Button title={mode==='exam'?'按当前设置开始考试':'按当前设置开始新一轮'} disabled={busy||!available} onPress={start}/>
  <Body muted>班级和题型筛选在下一轮生效。开始新一轮会替换当前模式的轮次。</Body>
 </Card>}
 {mode==='study'&&<>
 {r?.finished&&<Card><Title>本轮已完成</Title><Body>已练习{r.ids.length}张。自评用于安排复习，不代表考试正确率。</Body><Button title="开始新一轮" disabled={busy||!available} onPress={start}/><Button title="回看本轮最后一张" secondary disabled={busy} onPress={()=>run(()=>move(0))}/></Card>}
 {card&&!r?.finished&&<Card><View style={{flexDirection:'row',justifyContent:'space-between'}}><Pill>{kinds[card.kind]||'辨识记忆'}</Pill><Body muted>{r.index+1} / {r.ids.length}</Body></View><Body>{card.question}</Body>{photo}
 {!r.revealed?<Button title="回忆后展开答案" disabled={busy} onPress={()=>run(()=>changeRound({revealed:true}))}/>:<View style={{gap:16}}><View style={{gap:8}}>{card.answer.map((line,index)=><Body key={index} style={{fontSize:18,lineHeight:27,fontWeight:'600'}}>{line}</Body>)}</View><Button title="收起答案再回忆" secondary disabled={busy} onPress={()=>run(()=>changeRound({revealed:false}))}/><Body muted>按本次回忆情况选择：不会约10分钟后、模糊约1天后、熟练约7天后复习。</Body>{Object.entries(MEMORY_LEVELS).map(([level,label])=><Button key={level} title={label} secondary={level!=='known'} disabled={busy} onPress={()=>rate(level)}/>)}</View>}
 <View style={{flexDirection:'row',gap:12}}><Button title="上一张" secondary disabled={busy||r.index===0} onPress={()=>run(()=>move(-1))}/><Button title="跳过这一张" secondary disabled={busy||r.index===r.ids.length-1} onPress={()=>run(()=>move(1))}/></View></Card>}
 {r&&<Button title="暂停并保存本轮" secondary disabled={busy} onPress={()=>run(async()=>{await save({...ref.current});try{await flush();await uploadProgress()}catch{N('已保存到本机，联网后点击同步即可上传')}navigation.goBack()})}/>}
 </>}
 {mode==='exam'&&exam&&card&&<Card>
  <SectionHeader title={exam.submitted?'考试结果':'考试作答'}/>
  {exam.submitted&&<Body>姓名、班级答对 {examResults.filter(item=>item.correct===true).length} / {examResults.filter(item=>item.correct!==null).length} 题。资料题可对照参考答案。</Body>}
  <Body muted>{exam.index+1} / {exam.ids.length} 题{!exam.submitted?' · 未答 '+unanswered+' 题':''}</Body>
  <Body>{card.question}</Body>{photo}
  {exam.submitted&&currentResult?<>
   <Body>你的作答　{currentResult.answer||'未答'}</Body>
   <Body>参考答案　{card.answer.join('、')}</Body>
   {currentResult.correct!==null&&<Pill tone={currentResult.correct?'success':'danger'}>{currentResult.correct?'正确':'未答对'}</Pill>}
  </>:<Field label="填写作答" value={draftAnswer??exam.responses[exam.currentId]??''} onChangeText={value=>{setExamInput({id:card.id,revision:card.revision,value});setConfirmExam(false)}} multiline={!objectiveCard(card)} maxLength={1000}/>}
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>
   <Button title="上一题" secondary disabled={busy||exam.index===0} onPress={()=>run(()=>saveExamAnswer({step:-1}))}/>
   <Button title={exam.submitted?'下一题':'保存并下一题'} secondary disabled={busy||exam.index===exam.ids.length-1} onPress={()=>run(()=>saveExamAnswer({step:1}))}/>
  </View>
  {exam.submitted?<Button title="开始新一场考试" disabled={busy||!available} onPress={start}/>:<>
   <Button title={confirmExam?'确认交卷（还有 '+unanswered+' 题未答）':'交卷查看结果'} loading={busy} onPress={()=>unanswered&&!confirmExam?setConfirmExam(true):run(()=>saveExamAnswer({submit:true}))}/>
   <Button title="暂停并保存考试" secondary disabled={busy} onPress={()=>run(()=>saveExamAnswer({exit:true}))}/>
  </>}
 </Card>}
 </>}
  <Card>{!!syncStage&&<Body>{syncStage}</Body>}<Body>{pack?pack.cards.filter(item=>item.kind==='profile').length+'张整人题卡 · 待同步记录 '+local.queue.length+'条':'首次使用请联网下载资料'}</Body>{pack&&<Body muted>下载于 {new Date(pack.downloadedAt).toLocaleDateString()} · 离线可用至 {new Date(pack.expiresAt).toLocaleDateString()}</Body>}<Button title="同步最新资料与复习记录" secondary loading={busy} onPress={()=>run(sync)}/></Card>
 {pack&&<Button secondary title={clearing?"确认清除本机照片与记忆卡（评级队列保留）":"清除本机下载资料"} disabled={busy} onPress={()=>{if(!clearing){A(true);return}void run(async()=>{await clearMemoryPack(accountKey,storageId);packRef.current=null;P(null);A(false);N("本机照片与卡片已清除，待同步评级继续加密保留")})}}/>}
 <Modal visible={zoom&&!!image} animationType="fade" onRequestClose={()=>Z(false)}><View style={{flex:1,backgroundColor:"#172C42",padding:24,paddingTop:48,gap:20}}>{image&&<Image accessibilityLabel="放大的学生照片" source={{uri:"data:"+image.mime+";base64,"+image.base64}} resizeMode="contain" style={{flex:1,width:"100%"}}/>}<Button title="关闭照片放大" onPress={()=>Z(false)}/></View></Modal>
 </Page>;
}
