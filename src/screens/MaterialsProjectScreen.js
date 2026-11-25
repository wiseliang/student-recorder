import React,{useState,useCallback,useEffect,useRef} from 'react';
import {Image,View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Title,Body,Card,Button,Field,ErrorBox,RowLink,Choice,Pill} from '../components/ui';
import {get,post} from '../utils/api';
import {pickMaterial,downloadMaterial} from '../utils/materialFiles';
const API='/api/materials',labels={pending:'等待处理',running:'正在处理',completed:'处理完成',failed:'处理失败',imported:'已确认导入'};
export default function MaterialsProjectScreen({navigation,route}){
 const id=route.params.projectId,base=API+'/projects/'+id;
 const [data,D]=useState(null),[error,E]=useState(null),[busy,B]=useState(false),[search,S]=useState(''),[className,C]=useState(''),[page,N]=useState(0),[editing,V]=useState(null),[fields,F]=useState({}),[confirmed,Q]=useState(false),[portrait,P]=useState(null),[mode,M]=useState('both'),[draft,G]=useState(true),[jobs,J]=useState([]),[preview,I]=useState(null),[mapping,U]=useState({}),[identityQuery,H]=useState(''),[mappingIndex,X]=useState(null),[importConfirmed,K]=useState(false);
 const alive=useRef(false),locked=useRef(false),editRef=useRef(null),scroll=useRef(null);
 const load=async()=>{const d=await get(base);if(alive.current){D(d);J(d.jobs||[])}return d};
 const [reviewFirst,setReviewFirst]=useState(false);
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
 const showPreview=async(job,offset=0)=>{
  const r=await get(API+'/jobs/'+job.id+'/preview',{offset});
  I({...r,offset});
  U(old=>{
   const sameJob=preview?.job.id===job.id;
   if(r.suggestedMapping)return sameJob?old:Object.fromEntries(r.suggestedMapping.map(m=>[m.index,m.studentId]));
   const prior=sameJob?old:{};
   return {...prior,...Object.fromEntries(r.rows.filter(row=>!(row.index in prior)&&row.matchedStudentId).map(row=>[row.index,row.matchedStudentId]))};
  });
  K(false);X(null);scroll.current?.scrollTo({y:0,animated:true});
 };
 const completeImport=async(job,options)=>{
  const r=await post(API+'/jobs/'+job.id+'/commit',options);
  D(r);J(r.jobs||[]);I(null);U({});K(false);V(null);editRef.current=null;
  scroll.current?.scrollTo({y:0,animated:true});
 };
 if(!data)return <Page><Title>辨识资料</Title><Body muted>正在读取项目…</Body><ErrorBox error={error} onRetry={()=>run(load)}/></Page>;
 const people=data.students.filter(s=>(!className||s.className===className)&&(!search||[s.name,s.studentId,s.className].some(v=>v?.includes(search)))),shown=people.slice(page*12,page*12+12),mapCount=Object.values(mapping).filter(Boolean).length;
 const latestImport=jobs.find(j=>j.kind==='import');
 const latestImportJobId=jobs.find(j=>j.kind==='import'&&j.status==='imported')?.id;
 return <Page scrollRef={scroll}><Title>{data.title}</Title><Body muted>辅导员：{data.counselor} · {data.students.length}名当前所带学生</Body><ErrorBox error={error}/>
 <Button title="在App内背诵" onPress={()=>navigation.navigate('StudentMemory',{projectId:id,accountKey:data.accountKey,title:data.title,latestImportJobId})}/>
 {!preview&&latestImport&&<Card>
 <Title>PPT 导入进度</Title><Pill tone={latestImport.status==='failed'?'danger':'neutral'}>{labels[latestImport.status]||latestImport.status}</Pill>
 {latestImport.message?<Body>{latestImport.message}</Body>:null}
 {['pending','running'].includes(latestImport.status)&&<Body muted>正在解析照片和资料，可离开页面，稍后返回查看结果。</Body>}
 {latestImport.status==='completed'&&<>
 <Body>{latestImport.report?'解析 '+latestImport.report.rows+' 条，唯一匹配 '+latestImport.report.matched+' 条。':'资料已解析，等待写入。'}</Body>
 <Button title="直接导入匹配项" loading={busy} disabled={latestImport.report?.matched===0} onPress={()=>run(()=>completeImport(latestImport,{autoApply:true}))}/>
 <Button title="核对本次导入" secondary loading={busy} onPress={()=>run(()=>showPreview(latestImport))}/>
 </>}
 {latestImport.status==='imported'&&latestImport.report?.imported!=null&&<>
 <Body>已更新 {latestImport.report.imported} 名学生的辨识资料</Body>
 {latestImport.report.skipped>0&&<Body muted>有 {latestImport.report.skipped} 条未写入。需要逐条处理时，可选择先核对再重新导入。</Body>}
 <Button title="背诵本次导入的 PPT" onPress={()=>navigation.navigate('StudentMemory',{projectId:id,accountKey:data.accountKey,title:data.title,importJobId:latestImport.id})}/>
 <Body muted>如需更新已有的 PPT，请重新生成。</Body>
 </>}
 </Card>}
 {editing&&<Card><Title>核实：{editing.name}</Title><Body>{editing.className} · {editing.studentId}</Body>{portrait&&<Image accessibilityLabel="待核对学生照片" source={{uri:portrait}} style={{width:110,height:150,alignSelf:'center'}} resizeMode="contain"/>}
 <Body muted>仅填写已有依据的资料。空白代表待补充，明确没有时请填写“无”。学情按学校认定类型或级别填写。</Body>
 {Object.entries(data.fields).map(([k,label])=><Field key={k} label={label} value={fields[k]||''} onChangeText={v=>{F(f=>({...f,[k]:v}));Q(false)}} maxLength={1000} multiline={['reason','other'].includes(k)}/>)}
 <Choice label="我已核实以上填写内容" selected={confirmed} onPress={()=>Q(!confirmed)}/><Button title="确认保存资料" loading={busy} disabled={!confirmed} onPress={()=>run(async()=>{const r=await post(base+'/students/'+encodeURIComponent(editing.studentId),{revision:editing.revision,fields,confirmed:true});D(r);V(null);editRef.current=null})}/><Button secondary title="关闭资料编辑" disabled={busy} onPress={()=>{V(null);editRef.current=null}}/></Card>}
 {preview&&<Card><Title>导入前核对</Title><Body>共{preview.total}条，当前第{Math.floor(preview.offset/12)+1}页。已选择{mapCount}条，{preview.total-mapCount}条未选。</Body><Body muted>逐页核对姓名、班级、照片和个人情况。仅导入已选择的记录；空字段不覆盖原有资料，姓名与班级沿用所带名单。</Body>
 {preview.job.report?.warnings?.slice(0,6).map((w,i)=><Body key={i} muted>{w}</Body>)}
 {preview.rows.map(r=><View key={r.index} style={{gap:10,borderTopWidth:1,borderTopColor:'#D9E4F0',paddingTop:16}}><Body>第{r.sourcePage}页 · 位置{r.sourcePosition} · {r.name||'姓名未填写'} · {r.className||'班级未填写'}</Body>{r.photo&&<Image accessibilityLabel="PPT中的学生照片" source={{uri:r.photo.imageData}} style={{width:90,height:120}} resizeMode="contain"/>}{Object.entries(r.fields).filter(([,v])=>v).map(([k,v])=><Body key={k}>{data.fields[k]}：{v}</Body>)}<Body>{mapping[r.index]?'对应：'+(data.students.find(s=>s.studentId===mapping[r.index])?.name||'')+' '+(data.students.find(s=>s.studentId===mapping[r.index])?.className||''):'尚未选择对应学生，将跳过'}</Body><Button secondary title={'核对第'+(r.index+1)+'条的对应学生'} onPress={()=>{X(mappingIndex===r.index?null:r.index);H('')}}/>
 {mappingIndex===r.index&&<View style={{gap:8}}><Field label="搜索所带学生姓名或学号" value={identityQuery} onChangeText={H}/><Choice label="跳过这条记录" selected={!mapping[r.index]} onPress={()=>{U(m=>({...m,[r.index]:null}));K(false);X(null)}}/>{data.students.filter(s=>[s.name,s.studentId,s.className].some(v=>v.includes(identityQuery))).slice(0,12).map(s=><Choice key={s.studentId} label={s.name+' · '+s.className+' · '+s.studentId} selected={mapping[r.index]===s.studentId} onPress={()=>{U(m=>({...m,[r.index]:s.studentId}));K(false);X(null)}}/>)}</View>}</View>)}
 <View style={{flexDirection:'row',gap:12}}><Button secondary title="预览上一页" disabled={busy||preview.offset===0} onPress={()=>run(()=>showPreview(preview.job,preview.offset-12))}/><Button secondary title="预览下一页" disabled={busy||preview.offset+12>=preview.total} onPress={()=>run(()=>showPreview(preview.job,preview.offset+12))}/></View>
 <Choice label="已核对所选记录的身份、照片与填写内容" selected={importConfirmed} onPress={()=>K(!importConfirmed)}/><Button title={'确认导入所选'+mapCount+'条记录'} loading={busy} disabled={!importConfirmed||!mapCount} onPress={()=>run(()=>completeImport(preview.job,{confirmed:true,mapping:Object.entries(mapping).filter(([,v])=>v).map(([index,studentId])=>({index:Number(index),studentId}))}))}/><Button title="关闭导入预览" secondary onPress={()=>I(null)}/></Card>}
 <Card><Title>资料与照片</Title><Field label="搜索姓名、班级或学号" value={search} onChangeText={v=>{S(v);N(0)}}/><Choice label="全部所带学生" selected={!className} onPress={()=>{C('');N(0)}}/>{data.classes.map(c=><Choice key={c} label={c} selected={c===className} onPress={()=>{C(c);N(0)}}/>)}<Body muted>当前范围 {people.length}人 · 第{page+1}页</Body>
 {shown.map(s=><RowLink key={s.studentId} title={s.name+' · '+s.className} detail={(s.photoAvailable?'照片已保存':'缺少照片')+' · 已填'+Object.values(s.fields||{}).filter(f=>f.confirmed&&f.value).length+'/6项'} onPress={()=>select(s)}/>)}
 <View style={{flexDirection:'row',gap:12}}><Button title="名单上一页" secondary disabled={page===0} onPress={()=>N(page-1)}/><Button title="名单下一页" secondary disabled={(page+1)*12>=people.length} onPress={()=>N(page+1)}/></View><Button title="管理与补充学生照片" secondary onPress={()=>navigation.navigate('AcademicPhotos')}/></Card>
 <Card><Title>生成辨识PPT</Title><Body muted>范围：{className||'全部所带学生'}。每班单独分页，每页最多12人；考核版保留照片和空白栏目。</Body>{[['both','完整版与考核版'],['full','仅完整版'],['assessment','仅考核版']].map(([v,label])=><Choice key={v} label={label} selected={mode===v} onPress={()=>M(v)}/>)}<Choice label="生成草稿，允许缺项并标明待补充" selected={draft} onPress={()=>G(!draft)}/><Body muted>{draft?'草稿可先核查版式，不应直接提交。':'提交版须照片齐全、字段已确认，过长内容须先精简。'}</Body><Button title={draft?'生成PPT草稿':'生成PPT提交版'} loading={busy} disabled={active} onPress={()=>run(async()=>{const j=await post(base+'/exports',{mode,draft,className});J(old=>[j,...old])})}/></Card>
 <Card><Title>导入已完成的辨识材料</Title><Body muted>支持同版式的完整版 PPTX。按姓名和班级唯一匹配后自动更新照片和填写内容，空字段保留原值。</Body><Choice label="先核对再导入" selected={reviewFirst} disabled={busy} onPress={()=>setReviewFirst(!reviewFirst)}/><Button title="选择已完成的PPTX" loading={busy} disabled={active} onPress={()=>run(async()=>{const j=await pickMaterial(id,!reviewFirst);if(j){J(old=>[j,...old]);U({});I(null);V(null);editRef.current=null;scroll.current?.scrollTo({y:0,animated:true})}})}/></Card>
 <Card><Title>背诵内容范围</Title><Body muted>默认练习姓名、班级与已确认的班委情况。需要背诵其他个人情况时，可在此加入。</Body><Choice label="将已确认的政治面貌、关注群体、原因、学情及其他情况加入记忆" selected={!!data.sensitive} disabled={busy} onPress={()=>run(async()=>D(await post(base+'/settings',{sensitive:!data.sensitive})))}/><Body muted>仅同步已核实的字段，不自动交给AI分析。</Body></Card>
 {jobs.filter(j=>j.id!==latestImport?.id).map(j=><Card key={j.id}><Pill tone={j.status==='failed'?'danger':'neutral'}>{labels[j.status]||j.status}</Pill><Body>{j.kind==='import'?'PPT导入':'PPT生成'}</Body>{!!j.message&&<Body>{j.message}</Body>}{j.report&&<Body muted>{j.kind==='import'?'解析'+j.report.rows+'条，唯一匹配'+j.report.matched+'条':(j.report.files||[]).map(f=>f.filename+' '+f.pages+'页').join(' · ')}</Body>}{j.report?.issues?.slice(0,12).map((issue,i)=><RowLink key={i} title={(issue.name||issue.studentId)+' · '+(data.fields[issue.field]||'照片')} detail={issue.message} onPress={()=>{const s=data.students.find(s=>s.studentId===issue.studentId);if(s)select(s)}}/>)}{downloadState?.id===j.id&&<Body muted>{downloadState.total>0?'正在下载 '+Math.min(100,Math.floor(downloadState.written*100/downloadState.total))+'%':'正在下载辨识材料…'}</Body>}{j.status==='completed'&&<Button title={j.kind==='import'?'核对本次导入':'下载辨识材料压缩包'} secondary loading={busy} onPress={()=>run(()=>j.kind==='import'?showPreview(j):download(j))}/>}</Card>)}
 <Button secondary title="刷新项目与任务" loading={busy} onPress={()=>run(load)}/>
 </Page>;
}
