import React,{useCallback,useRef,useState,useEffect} from "react";
import {View,Text} from "react-native";
import {useFocusEffect} from "@react-navigation/native";
import {Page,Title,Body,Card,Button,Field,Choice,ErrorBox,Pill,styles} from "../components/ui";
import Dropdown from "../components/Dropdown";
import {get,post} from "../utils/api";
const API="/api/academic-grades";
export const dateLabel=v=>v?new Date(v).toLocaleString("zh-CN"):"尚未同步";
export const gradeState={passed:"已通过",unresolved:"仍未通过",pending:"关系或成绩待核实",unknown:"成绩状态待核实",not_synced:"历史尚未同步",no_published_record:"未查到本次课程记录"};
export default function AcademicGradesScreen({navigation,route}){
 const [state,S]=useState(null),[cohort,C]=useState(""),[data,D]=useState(null),[query,Q]=useState(route.params?.studentId||""),[failed,F]=useState(false),[offset,O]=useState(0),[error,E]=useState(null),[busy,B]=useState(false);
 const lock=useRef(false),alive=useRef(false),timer=useRef(null),selected=useRef(""),scopePrompted=useRef(false);
 selected.current=cohort;
 const latest=useRef({});latest.current={query,offset,failed};
 const load=async(key=selected.current,q=query,off=offset,onlyFailed=failed)=>{
  const r=await get(API+"/state");if(!alive.current)return;S(r);
  if(!r.profile.scopes.length){if(!scopePrompted.current){scopePrompted.current=true;navigation.navigate("AcademicScope",{onboarding:true})}return r}
  const k=r.profile.scopes.some(s=>s.key===key)?key:r.profile.scopes[0].key;C(k);
  const list=await get(API+"/students?cohortKey="+k+"&q="+encodeURIComponent(q)+"&offset="+off+"&failed="+onlyFailed);
  if(alive.current)D(list);
  return r;
 };
 useFocusEffect(useCallback(()=>{alive.current=true;void load().catch(e=>{if(alive.current)E(e)});return()=>{alive.current=false;clearTimeout(timer.current)}},[]));
 const activeJob=["pending","running","pause_requested"].includes(state?.job?.status);
 useEffect(()=>{
  if(!activeJob)return;
  let working=false;
  const poll=setInterval(async()=>{if(!alive.current||working||lock.current)return;working=true;try{const v=latest.current;await load(selected.current,v.query,v.offset,v.failed)}catch(e){if(alive.current)E(e)}finally{working=false}},2500);
  return()=>clearInterval(poll);
 },[activeJob]);
 const run=async fn=>{if(lock.current)return;lock.current=true;B(true);E(null);try{await fn();await load(selected.current,query,offset,failed)}catch(e){E(e)}finally{lock.current=false;B(false)}};
 const job=state?.job,p=job?.payload,active=["pending","running","pause_requested"].includes(job?.status);
 return <Page>
  <Title>学业查询</Title>
  <Body muted>专业课程默认查整个专业；这里的学生名单只显示你设置的所带范围。</Body>
  <ErrorBox error={error}/>
  <View style={{gap:10}}>
   <Button secondary title={state?.connection.connected?"查看教务连接":"连接教务系统"} onPress={()=>navigation.navigate("AcademicAccess")}/>
   <Button secondary title="设置所带专业与班级" onPress={()=>navigation.navigate("AcademicScope")}/>
  </View>
  {!!state?.profile.scopes.length&&<>
   <Dropdown label="所带专业" value={cohort} returnValue options={state.profile.scopes.map(s=>({value:s.key,label:s.year+"级 "+s.majorName}))} onChange={key=>{C(key);selected.current=key;O(0);void run(()=>load(key,query,0,failed))}}/>
   <Button title="查专业单科成绩" onPress={()=>navigation.navigate("AcademicCourse",{cohortKey:cohort})}/>
   <Card>
    <Text style={styles.heading}>成绩同步</Text>
    <Body muted>同步所选各专业全体学生的教务可返回历史，以便识别补考、重修。查询失败会保留上次成功结果。</Body>
    {job&&<>
     <Pill tone={job.status==="completed"?"success":"neutral"}>{{pending:"等待开始",running:"正在同步",pause_requested:"正在暂停",paused:"已暂停",partial:"部分完成",completed:"同步完成",failed:"同步中断"}[job.status]||job.status}</Pill>
     <Body>{p.success||0} / {p.total||0} 人已保存，{p.failures?.length||0} 人读取失败</Body>
     {!!p.message&&<Body muted>{p.message}</Body>}
     {!!p.current&&<Body muted>正在读取学号 {p.current}</Body>}
    </>}
    {active?<Button secondary title="暂停同步" disabled={busy||job.status==="pause_requested"} onPress={()=>run(()=>post(API+"/sync/"+job.id+"/pause"))}/>:<>
     <Button title="同步全部专业成绩" loading={busy} onPress={()=>run(async()=>{await post(API+"/sync");clearTimeout(timer.current);timer.current=setTimeout(()=>{if(alive.current)void load().catch(E)},2600)})}/>
     {job&&["paused","partial","failed"].includes(job.status)&&<Button secondary title="恢复进度并重试失败学生" disabled={busy} onPress={()=>run(()=>post(API+"/sync",{resumeId:job.id}))}/>}
    </>}
    <Button secondary title="刷新同步进度" disabled={busy} onPress={()=>run(()=>load())}/>
   </Card>
   <Card>
    <Text style={styles.heading}>所带学生</Text>
    <Body muted>全专业 {data?.professionalCount??"待读取"} 人，所带范围 {data?.managedCount??"待读取"} 人</Body>
    <Body muted>名单更新：{dateLabel(data?.rosterCheckedAt)}</Body>
    <Button secondary title="核对并刷新专业名单" disabled={busy||active} onPress={()=>run(()=>post(API+"/roster/refresh",{cohortKey:cohort}))}/>
    <Field label="搜索姓名或学号" value={query} onChangeText={Q}/>
    <Choice label="只看当前读取范围内仍未通过" selected={failed} onPress={()=>F(!failed)}/>
    <Button secondary title="筛选学生" disabled={busy} onPress={()=>{O(0);void run(()=>load(cohort,query,0,failed))}}/>
   </Card>
   {data&&!data.students.length&&<Body muted>{data.professionalCount===null?"请刷新名单或开始同步成绩。":"当前筛选没有学生，请检查范围或筛选条件。"}</Body>}
   {data?.students.map(s=><Card key={s.studentId}>
    <Text style={styles.heading}>{s.name}</Text>
    <Body muted>{s.studentId}　{s.className}</Body>
    <Body>学分绩 {s.weightedScore||"暂无"}　教务不及格门数 {s.schoolFailedCount||"暂无"}</Body>
    <Body>仍未通过 {s.observedUnresolvedCount??"待同步"}　待核实 {s.pendingCount??"待同步"}</Body>
    <Body muted>成绩更新：{dateLabel(s.checkedAt)}</Body>
    <Button secondary title={"查看"+s.name+"的成绩"} onPress={()=>navigation.navigate("AcademicStudent",{cohortKey:cohort,studentId:s.studentId})}/>
   </Card>)}
   {data&&data.total>50&&<View style={{gap:8}}>
    <Body muted>当前 {offset+1}–{Math.min(offset+50,data.total)} / {data.total} 人</Body>
    <Button secondary title="上一页" disabled={busy||offset===0} onPress={()=>{const n=Math.max(0,offset-50);O(n);void run(()=>load(cohort,query,n,failed))}}/>
    <Button secondary title="下一页" disabled={busy||offset+50>=data.total} onPress={()=>{const n=offset+50;O(n);void run(()=>load(cohort,query,n,failed))}}/>
   </View>}
  </>}
 </Page>;
}
