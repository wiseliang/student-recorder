import React,{useCallback,useRef,useState} from "react";
import {Text,View} from "react-native";
import {useFocusEffect} from "@react-navigation/native";
import {Page,Title,Body,Card,Button,Field,Choice,ErrorBox,Pill,styles} from "../components/ui";
import Dropdown from "../components/Dropdown";
import {get,post} from "../utils/api";
import {dateLabel,gradeState} from "./AcademicGradesScreen";
const API="/api/academic-grades";
export default function AcademicStudentScreen({navigation,route}){
 const {cohortKey,studentId}=route.params;
 const [data,D]=useState(null),[error,E]=useState(null),[busy,B]=useState(false),[term,T]=useState("all"),[mode,M]=useState("all"),[edit,V]=useState(false),[from,F]=useState(""),[to,K]=useState(""),[reason,R]=useState(""),[whole,W]=useState(false),[confirm,C]=useState(null),[offset,O]=useState(0);
 const alive=useRef(false),lock=useRef(false);
 const load=async()=>{const r=await get(API+"/student?cohortKey="+cohortKey+"&studentId="+encodeURIComponent(studentId));if(alive.current)D(r)};
 useFocusEffect(useCallback(()=>{alive.current=true;void load().catch(E);return()=>{alive.current=false}},[cohortKey,studentId]));
 const run=async fn=>{if(lock.current)return;lock.current=true;B(true);E(null);try{await fn();await load();C(null)}catch(e){if(alive.current)E(e)}finally{lock.current=false;B(false)}};
 const records=data?.archive?.courses||[],courses=data?.analysis?.courses||[];
 const options=[...new Map(records.map(r=>[r.code,{value:r.code,label:r.name+"（"+r.code+"）"}])).values()];
 const names=code=>options.find(o=>o.value===code)?.label||code;
 const shown=courses.filter(c=>(mode==="all"||c.state===mode||mode==="history"&&c.everFailed)&&(term==="all"||c.attempts.some(r=>r.semester===term)));
 return <Page>
  <Title>{data?.student.name||"学生成绩"}</Title>
  <Body muted>{studentId}　{data?.student.className||""}</Body>
  <ErrorBox error={error}/>
  <Button secondary title="连接教务系统" onPress={()=>navigation.navigate("AcademicAccess")}/>
  <Button title="刷新该生全部可读成绩" loading={busy} onPress={()=>run(()=>post(API+"/student/refresh",{cohortKey,studentId}))}/>
  {data&&<Card>
   <Text style={styles.heading}>学业概览</Text>
   <Body>教务学分绩 {data.student.weightedScore||"暂无"}　不及格门数 {data.student.schoolFailedCount||"暂无"}</Body>
   {data.analysis?<>
    <Body>历史不及格 {data.analysis.historicalFailedAttempts} 次，涉及 {data.analysis.historicalFailedCourses} 门课程要求</Body>
    <Body>当前读取范围内仍未通过 {data.analysis.observedUnresolvedCount} 门，待核实 {data.analysis.pendingCount} 项</Body>
    <Body>曾不及格后已通过 {data.analysis.recoveredCount} 门</Body>
    <Body muted>{data.analysis.coverage}，共 {records.length} 条。此统计不替代学校正式认定，也不涵盖未选未修课程。</Body>
   </>:<Body muted>尚未同步该生历史，暂不判断补考、重修是否通过。</Body>}
   <Body muted>更新：{dateLabel(data.archive?.checkedAt)}</Body>
  </Card>}
  {!!records.length&&<>
   <Dropdown label="学期" value={term} returnValue options={[{value:"all",label:"全部学期"},...[...new Set(records.map(r=>r.semester))].map(s=>({value:s,label:s}))]} onChange={v=>{T(v);O(0)}}/>
   <Dropdown label="课程情况" value={mode} returnValue options={[["all","全部课程"],["history","历史曾不及格"],["unresolved","仍未通过"],["passed","已通过"],["pending","关系或成绩待核实"],["unknown","成绩状态待核实"]].map(([value,label])=>({value,label}))} onChange={v=>{M(v);O(0)}}/>
   {shown.slice(offset,offset+25).map(c=><Card key={c.key}>
    <Text style={styles.heading}>{c.names.join(" / ")}</Text>
    <Body muted>{c.codes.join("、")}</Body>
    <Pill tone={c.state==="passed"?"success":c.state==="unresolved"?"warning":"neutral"}>{gradeState[c.state]}</Pill>
    {!!c.recovery&&<Body>{({makeup:"补考已通过",retake:"重修已通过",linked:"关联课程已通过"})[c.recovery]}</Body>}
    {c.attempts.map(r=><View key={r.id} style={{borderTopWidth:1,borderColor:"#D9E4F0",paddingTop:10,gap:4}}>
     <Body>{r.semester}　{r.attempt||"原始考试记录"}　{r.score||"尚无成绩"}</Body>
     <Body muted>{r.name}　学分 {r.credits||"暂无"}{r.remark?"　"+r.remark:""}</Body>
    </View>)}
    {c.candidates.length>0&&<Body muted>可能相关的通过记录：{c.candidates.map(x=>x.name+"（"+x.code+"）").join("、")}。仅供核对，尚未合并。</Body>}
    {c.evidence.map(l=><Body muted key={l.id}>教师确认依据：{l.reason}</Body>)}
   </Card>)}
   {!shown.length&&<Body muted>当前条件没有课程。</Body>}
   {shown.length>25&&<View style={{gap:8}}><Body muted>当前 {offset+1}–{Math.min(offset+25,shown.length)} / {shown.length} 门</Body><Button secondary title="上一页" disabled={!offset} onPress={()=>O(Math.max(0,offset-25))}/><Button secondary title="下一页" disabled={offset+25>=shown.length} onPress={()=>O(offset+25)}/></View>}
   <Button secondary title={edit?"收起课程对应关系":"确认改名或重修课程关系"} onPress={()=>V(!edit)}/>
   {edit&&<Card>
    <Text style={styles.heading}>课程对应关系</Text>
    <Body muted>确认两门课满足同一个课程要求。只影响本工具统计，不修改学校成绩。</Body>
    <Dropdown label="原课程" value={from} returnValue options={options} disabled={busy} onChange={v=>{F(v);C(null)}}/>
    <Dropdown label="重修或替代课程" value={to} returnValue options={options.filter(x=>x.value!==from)} disabled={busy} onChange={v=>{K(v);C(null)}}/>
    <Field label="确认依据" value={reason} editable={!busy} multiline maxLength={500} onChangeText={v=>{R(v);C(null)}} helper="例如教务替代通知、培养方案版本或核实情况"/>
    <Choice label="适用于我查询的该年级整个专业" detail="不勾选时只适用于当前学生；不会共享给其他老师。" selected={whole} disabled={busy} onPress={()=>{W(!whole);C(null)}}/>
    {confirm==="create"?<>
     <Body>将 {names(from)} 与 {names(to)} 按同一课程要求统计。</Body>
     <Body>适用范围：{whole?"你所查询的该年级整个专业":"仅当前学生"}。关联后会重新判断是否通过，历史成绩保留。</Body>
     <Button title="确认关联并重新统计" loading={busy} onPress={()=>run(async()=>{await post(API+"/links",{action:"create",cohortKey,studentId,fromCode:from,toCode:to,reason,scope:whole?"cohort":"student"});F("");K("");R("");W(false)})}/>
     <Button secondary title="取消关联" disabled={busy} onPress={()=>C(null)}/>
    </>:<Button title="核对课程对应关系" disabled={!from||!to||from===to||!reason.trim()||busy} onPress={()=>C("create")}/>}
   </Card>}
   {!!data.links.length&&<Card>
    <Text style={styles.heading}>关联与撤销记录</Text>
    {data.links.map(l=><View key={l.id} style={{gap:8,paddingVertical:8}}>
     <Body>{l.from_code} → {l.to_code}　{l.active?"有效":"已撤销"}</Body>
     <Body muted>{l.student_id==="*"?"该专业年级":"当前学生"}；教师确认：{l.reason}</Body>
     <Body muted>{dateLabel(l.created_at)}</Body>
     {!!l.active&&(confirm===l.id?<><Body>撤销后将按剩余有效关系重新统计。</Body><Button secondary title="确认撤销这条关联" loading={busy} onPress={()=>run(()=>post(API+"/links",{action:"revoke",id:l.id,cohortKey}))}/><Button secondary title="保留关联" disabled={busy} onPress={()=>C(null)}/></>:<Button secondary title="撤销这条关联" disabled={busy} onPress={()=>C(l.id)}/>)}
    </View>)}
   </Card>}
  </>}
 </Page>;
}
