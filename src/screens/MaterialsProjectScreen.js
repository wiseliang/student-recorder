import React,{useState,useCallback,useEffect,useRef} from 'react';
import {Image,View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Title,Body,Card,Button,Field,ErrorBox,RowLink,Choice,Pill} from '../components/ui';
import {readMemory,writeMemory} from '../utils/memoryStore';
import {get,post} from '../utils/api';
import {pickMaterial,downloadMaterial} from '../utils/materialFiles';
const API='/api/materials',labels={pending:'等待处理',running:'正在处理',completed:'处理完成',failed:'处理失败',imported:'已确认导入'};
export default function MaterialsProjectScreen({navigation,route}){
 const id=route.params.projectId,base=API+'/projects/'+id;
 const [data,D]=useState(null),[error,E]=useState(null),[busy,B]=useState(false),[search,S]=useState(''),[className,C]=useState(''),[page,N]=useState(0),[editing,V]=useState(null),[fields,F]=useState({}),[confirmed,Q]=useState(false),[portrait,P]=useState(null),[mode,M]=useState('both'),[draft,G]=useState(true),[jobs,J]=useState([]);
 const alive=useRef(false),locked=useRef(false),editRef=useRef(null),scroll=useRef(null);
 const load=async()=>{const d=await get(base);if(alive.current){D(d);J(d.jobs||[])}return d};
 const [downloadState,setDownloadState]=useState(null);
 const download=async job=>{
  setDownloadState({id:job.id,written:0,total:0});
  try{
   await downloadMaterial(job,({totalBytesWritten,totalBytesExpectedToWrite})=>{
    if(alive.current)setDownloadState({id:job.id,written:totalBytesWritten,total:totalBytesExpectedToWrite});
   });
  }finally{if(alive.current)setDownloadState(null);}
 };
 const run=async fn=>{if(locked.current)return;locked.current=true;B(true);E(null);try{await fn()}catch(e){if(alive.current)E(e)}finally{locked.current=false;if(alive.current)B(false)}};
 useFocusEffect(useCallback(()=>{alive.current=true;void load().catch(E);return()=>{alive.current=false}},[id]));
 const active=jobs.some(j=>['pending','running'].includes(j.status));
 useEffect(()=>{if(!active)return;let polling=false;const timer=setInterval(async()=>{if(polling||locked.current||!alive.current)return;polling=true;try{const next=await Promise.all(jobs.map(j=>['pending','running'].includes(j.status)?get(API+'/jobs/'+j.id):j));if(alive.current){J(next);if(next.some((j,i)=>j.status==='imported'&&jobs[i].status!=='imported'))await load()}}catch(e){if(alive.current)E(e)}finally{polling=false}},1800);return()=>clearInterval(timer)},[active,jobs]);
 const select=s=>{editRef.current=s.studentId;V(s);P(null);Q(false);F(Object.fromEntries(Object.keys(data.fields).map(k=>[k,s.fields?.[k]?.value||''])));scroll.current?.scrollTo({y:0,animated:true});void get(base+'/photos/'+encodeURIComponent(s.studentId)).then(r=>{if(alive.current&&editRef.current===s.studentId)P(r.imageData||null)}).catch(E)};
 const buildFromImport=async job=>{
  const updated=await post(API+'/jobs/'+job.id+'/study-bank',{});
  D(updated);J(updated.jobs||[]);
  scroll.current?.scrollTo({y:0,animated:true});
 };
 if(!data)return <Page><Title>辨识资料</Title><Body muted>正在读取项目…</Body><ErrorBox error={error} onRetry={()=>run(load)}/></Page>;
 const people=data.students.filter(s=>(!className||s.className===className)&&(!search||[s.name,s.studentId,s.className].some(v=>v?.includes(search)))),shown=people.slice(page*12,page*12+12);
 const imports=jobs.filter(job=>job.kind==='import');
 const exports=jobs.filter(job=>job.kind==='export');
 const openBank=async job=>{
  const title=job.filename||'PPT 题库';
  try{
   const catalog=await readMemory('','catalog','catalog');
   if(catalog?.accountKey===data.accountKey){
    const projects=catalog.projects.map(p=>p.id===id?{...p,latestBank:{id:job.id,filename:title}}:p);
    await writeMemory('','catalog','catalog',{...catalog,projects});
   }
  }catch{} // The server also supplies the latest bank when the project list refreshes.
  navigation.push('StudentMemory',{projectId:id,accountKey:data.accountKey,title,bankId:job.id});
 };
 return <Page scrollRef={scroll}><Title>{data.title}</Title>{!!data.counselor&&<Body muted>{data.counselor} · {data.students.length}名当前所带学生</Body>}<ErrorBox error={error}/>
 <Card><Title>PPT 题库</Title><Body muted>选择已填写的完整版 PPTX。每条记录建立一张整人背诵卡，题库独立保存。</Body>
 <Button title="选择已完成的PPTX" loading={busy} disabled={active} onPress={()=>run(async()=>{
  const job=await pickMaterial(id);
  if(job){J(old=>[job,...old]);scroll.current?.scrollTo({y:0,animated:true})}
 })}/>
 {imports.map(job=><View key={job.id} style={{gap:8,borderTopWidth:1,borderTopColor:'#D9E4F0',paddingTop:12}}>
  <Body>{job.filename||'已上传的 PPT'}</Body>
  {job.message?<Body>{job.message}</Body>:null}
  {job.studyBank&&job.status==='imported'?<>
   <Body muted>已建立题库 · {job.report?.bankRows||0} 条记录</Body>
   <Button title="背诵本次导入的 PPT" secondary disabled={busy} onPress={()=>openBank(job)}/>
  </>:['completed','imported'].includes(job.status)?
   <Button title="建立 PPT 题库" secondary loading={busy} onPress={()=>run(()=>buildFromImport(job))}/>:
   <Pill tone={job.status==='failed'?'danger':'neutral'}>{labels[job.status]||job.status}</Pill>}
 </View>)}
 </Card>
 {!!data.counselor&&<Button title="背诵学工项目资料" secondary onPress={()=>navigation.navigate('StudentMemory',{projectId:id,accountKey:data.accountKey,title:data.title})}/>}
 {data.counselor?<>
 {editing&&<Card><Title>核实：{editing.name}</Title><Body>{editing.className} · {editing.studentId}</Body>{portrait&&<Image accessibilityLabel="待核对学生照片" source={{uri:portrait}} style={{width:110,height:150,alignSelf:'center'}} resizeMode="contain"/>}
 <Body muted>仅填写已有依据的资料。空白代表待补充，明确没有时请填写“无”。学情按学校认定类型或级别填写。</Body>
 {Object.entries(data.fields).map(([k,label])=><Field key={k} label={label} value={fields[k]||''} onChangeText={v=>{F(f=>({...f,[k]:v}));Q(false)}} maxLength={1000} multiline={['reason','other'].includes(k)}/>)}
 <Choice label="我已核实以上填写内容" selected={confirmed} onPress={()=>Q(!confirmed)}/><Button title="确认保存资料" loading={busy} disabled={!confirmed} onPress={()=>run(async()=>{const r=await post(base+'/students/'+encodeURIComponent(editing.studentId),{revision:editing.revision,fields,confirmed:true});D(r);V(null);editRef.current=null})}/><Button secondary title="关闭资料编辑" disabled={busy} onPress={()=>{V(null);editRef.current=null}}/></Card>}
 <Card><Title>资料与照片</Title><Field label="搜索姓名、班级或学号" value={search} onChangeText={v=>{S(v);N(0)}}/><Choice label="全部所带学生" selected={!className} onPress={()=>{C('');N(0)}}/>{data.classes.map(c=><Choice key={c} label={c} selected={c===className} onPress={()=>{C(c);N(0)}}/>)}<Body muted>当前范围 {people.length}人 · 第{page+1}页</Body>
 {shown.map(s=><RowLink key={s.studentId} title={s.name+' · '+s.className} detail={(s.photoAvailable?'照片已保存':'缺少照片')+' · 已填'+Object.values(s.fields||{}).filter(f=>f.confirmed&&f.value).length+'/6项'} onPress={()=>select(s)}/>)}
 <View style={{flexDirection:'row',gap:12}}><Button title="名单上一页" secondary disabled={page===0} onPress={()=>N(page-1)}/><Button title="名单下一页" secondary disabled={(page+1)*12>=people.length} onPress={()=>N(page+1)}/></View><Button title="管理与补充学生照片" secondary onPress={()=>navigation.navigate('AcademicPhotos')}/></Card>
 <Card><Title>生成辨识PPT</Title><Body muted>范围：{className||'全部所带学生'}。每班单独分页，每页最多12人；考核版保留照片和空白栏目。</Body>{[['both','完整版与考核版'],['full','仅完整版'],['assessment','仅考核版']].map(([v,label])=><Choice key={v} label={label} selected={mode===v} onPress={()=>M(v)}/>)}<Choice label="生成草稿，允许缺项并标明待补充" selected={draft} onPress={()=>G(!draft)}/><Body muted>{draft?'草稿可先核查版式，不应直接提交。':'提交版须照片齐全、字段已确认，过长内容须先精简。'}</Body><Button title={draft?'生成PPT草稿':'生成PPT提交版'} loading={busy} disabled={active} onPress={()=>run(async()=>{const j=await post(base+'/exports',{mode,draft,className});J(old=>[j,...old])})}/></Card>
 <Card><Title>背诵内容范围</Title><Body muted>默认练习姓名、班级与已确认的班委情况。需要背诵其他个人情况时，可在此加入。</Body><Choice label="将已确认的政治面貌、关注群体、原因、学情及其他情况加入记忆" selected={!!data.sensitive} disabled={busy} onPress={()=>run(async()=>D(await post(base+'/settings',{sensitive:!data.sensitive})))}/><Body muted>仅同步已核实的字段，不自动交给AI分析。</Body></Card>
 {exports.map(j=><Card key={j.id}><Pill tone={j.status==='failed'?'danger':'neutral'}>{labels[j.status]||j.status}</Pill><Body>PPT生成</Body>{!!j.message&&<Body>{j.message}</Body>}{j.report&&<Body muted>{(j.report.files||[]).map(f=>f.filename+' '+f.pages+'页').join(' · ')}</Body>}{j.report?.issues?.slice(0,12).map((issue,i)=><RowLink key={i} title={(issue.name||issue.studentId)+' · '+(data.fields[issue.field]||'照片')} detail={issue.message} onPress={()=>{const s=data.students.find(s=>s.studentId===issue.studentId);if(s)select(s)}}/>)}{downloadState?.id===j.id&&<Body muted>{downloadState.total>0?'正在下载 '+Math.min(100,Math.floor(downloadState.written*100/downloadState.total))+'%':'正在下载辨识材料…'}</Body>}{j.status==='completed'&&<Button title="下载辨识材料压缩包" secondary loading={busy} onPress={()=>run(()=>download(j))}/>}</Card>)}
 </>:null}
 <Button secondary title="刷新项目与任务" loading={busy} onPress={()=>run(load)}/>
 </Page>;
}
