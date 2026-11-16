import React,{useCallback,useRef,useState,useEffect} from "react";
import {Text,View} from "react-native";
import {useFocusEffect} from "@react-navigation/native";
import {Page,Title,Body,Card,Button,Field,Choice,ErrorBox,Pill,styles} from "../components/ui";
import StudentPortrait from "../components/StudentPortrait";
import Dropdown from "../components/Dropdown";
import {get,post} from "../utils/api";
import {dateLabel,gradeState} from "./AcademicGradesScreen";
const API="/api/academic-grades";
const reviewLabels={link:'确认是同一课程',reject:'确认不是同一课程',defer:'暂时无法确认',issue:'学校记录异常或不完整'};
export default function AcademicStudentScreen({navigation,route}){
 const {cohortKey,studentId}=route.params;
 const [data,D]=useState(null),[error,E]=useState(null),[busy,B]=useState(false),[term,T]=useState("all"),[mode,M]=useState("all"),[edit,V]=useState(null),[outcome,U]=useState("link"),[from,F]=useState(""),[originalName,ON]=useState(""),[to,K]=useState(""),[reason,R]=useState(""),[whole,W]=useState(false),[confirm,C]=useState(null),[offset,O]=useState(0),[photoVersion,PV]=useState(0);
 const alive=useRef(false),lock=useRef(false),opened=useRef(null),page=useRef(null),positions=useRef({}),pendingJump=useRef(null),context=useRef(''),loadedFor=useRef('');context.current=cohortKey+':'+studentId;
 const load=async()=>{const requested=cohortKey+':'+studentId;const r=await get(API+"/student?cohortKey="+cohortKey+"&studentId="+encodeURIComponent(studentId));if(alive.current&&context.current===requested){loadedFor.current=requested;D(r)}};
 useFocusEffect(useCallback(()=>{alive.current=true;void load().catch(E);return()=>{alive.current=false}},[cohortKey,studentId]));
 const run=async fn=>{if(lock.current)return;lock.current=true;B(true);E(null);try{await fn();await load();C(null)}catch(e){if(alive.current)E(e)}finally{lock.current=false;B(false)}};
 const records=data?.archive?.courses||[],courses=data?.analysis?.courses||[];
 const reviewStale=r=>r.outcome!=='reject'&&(courses.find(c=>c.codes.includes(r.from_code))?.reviewFingerprint!==r.archive_fingerprint);
 const options=[...new Map(records.map(r=>[r.code,{value:r.code,label:r.name+"（"+r.code+"）"}])).values()];
 const names=code=>code===from&&originalName?originalName:options.find(o=>o.value===code)?.label||code;
 const shown=courses.filter(c=>(mode==="all"||c.state===mode||mode==="history"&&c.everFailed)&&(term==="all"||c.attempts.some(r=>r.semester===term)));
 const openRelation=c=>{U('link');pendingJump.current=c.key;V(c.key);F(c.originalCourse?.code||c.codes[0]);ON(c.originalCourse?c.originalCourse.name+'（'+c.originalCourse.code+'）':'');K(c.candidates.length===1?c.candidates[0].code:'');R('');W(false);C(null)};
 useEffect(()=>{V(null);F('');ON('');opened.current=null;pendingJump.current=null},[cohortKey,studentId]);
 useEffect(()=>{const code=route.params?.verifyCourseCode,target=context.current+':'+code;if(!code||loadedFor.current!==context.current||opened.current===target||!courses.length)return;const index=courses.findIndex(c=>c.codes.includes(code));if(index<0)return;opened.current=target;M('all');T('all');O(Math.floor(index/25)*25);openRelation(courses[index]);},[data,cohortKey,studentId,route.params?.verifyCourseCode]);
 const jumpTo=key=>{const y=positions.current[key];if(y!==undefined)setTimeout(()=>page.current?.scrollTo({y:Math.max(0,y-8),animated:true}),150)};
 useEffect(()=>{if(edit&&pendingJump.current===edit&&positions.current[edit]!==undefined){pendingJump.current=null;jumpTo(edit)}},[edit]);
 return <Page scrollRef={page}>
  <Title>{data?.student.name||"学生成绩"}</Title>
  <Body muted>{studentId}　{data?.student.className||""}</Body>
  <ErrorBox error={error}/>
  <Button secondary title="连接教务系统" onPress={()=>navigation.navigate("AcademicAccess")}/>
  <Button title="刷新该生全部可读成绩" loading={busy} onPress={()=>run(()=>post(API+"/student/refresh",{cohortKey,studentId}))}/>
  {data?.isManaged&&<Card><StudentPortrait studentId={studentId} refresh={photoVersion} width={96} height={128}/><Button secondary title="保存该生教务照片" disabled={busy} onPress={()=>run(async()=>{await post(API+"/photos/student",{studentId});PV(v=>v+1)})}/></Card>}
  {data&&<Card>
   <Text style={styles.heading}>学业概览</Text>
   <Body>教务学分绩 {data.student.weightedScore||"暂无"}　不及格门数 {data.student.schoolFailedCount||"暂无"}</Body>
   {data.analysis?<>
    <Body>历史不及格 {data.analysis.historicalFailedAttempts} 次，涉及 {data.analysis.historicalFailedCourses} 门课程要求</Body>
    <Body>当前读取范围内仍未通过 {data.analysis.observedUnresolvedCount} 门，待核实 {data.analysis.pendingCount} 项</Body>
    <Body>当前挂科学分 {data.analysis.failedCredits??'—'} 分</Body><Body muted>按首次挂科学分累计，已通过不计入。{data.analysis.failedCreditUnknownCourses?'另有 '+data.analysis.failedCreditUnknownCourses+' 门学分缺失，待核实。':''}</Body><Body>曾不及格后已通过 {data.analysis.recoveredCount} 门</Body>
    <Body muted>{data.analysis.coverage}，共 {records.length} 条。此统计不替代学校正式认定，也不涵盖未选未修课程。</Body>
   </>:<Body muted>尚未同步该生历史，暂不判断补考、重修是否通过。</Body>}
   <Body muted>更新：{dateLabel(data.archive?.checkedAt)}</Body>
  </Card>}
  {!!records.length&&<>
   <Dropdown label="学期" value={term} returnValue options={[{value:"all",label:"全部学期"},...[...new Set(records.map(r=>r.semester))].map(s=>({value:s,label:s}))]} onChange={v=>{T(v);O(0)}}/>
   <Dropdown label="课程情况" value={mode} returnValue options={[["all","全部课程"],["history","历史曾不及格"],["unresolved","仍未通过"],["passed","已通过"],["pending","关系或成绩待核实"],["unknown","成绩状态待核实"]].map(([value,label])=>({value,label}))} onChange={v=>{M(v);O(0)}}/>
   {shown.slice(offset,offset+25).map(c=><View key={c.key} onLayout={e=>{positions.current[c.key]=e.nativeEvent.layout.y;if(pendingJump.current===c.key){pendingJump.current=null;jumpTo(c.key)}}}><Card>
    <Text style={styles.heading}>{c.names.join(" / ")}</Text>
    <Body muted>{c.codes.join("、")}</Body>
    <Pill tone={c.state==="passed"?"success":c.state==="unresolved"?"warning":"neutral"}>{gradeState[c.state]}</Pill>
    {c.everFailed&&c.state!=='passed'&&<Body>挂科学分 {c.failedCredits??'待核实'} 分 · 首次挂科 {c.originalCourse?.semester}（{c.originalCourse?.credits||'学分缺失'}）</Body>}
    {c.makeupEligible===false&&<Body muted>旷考，无补考机会；不查找补考对应记录，重修通过后不再累计挂科学分。</Body>}
    {c.candidates.length>0&&<Body muted>待核实的通过记录：{c.candidates.map(x=>x.name+'（'+x.code+'）').join('、')}。确认前保留挂科学分。</Body>}
    {c.state!=='passed'&&edit!==c.key&&<Button secondary title={'核对'+(c.originalCourse?.name||c.names[0])+'的结果'} disabled={busy} onPress={()=>openRelation(c)}/>}
   {edit===c.key&&<Card>
    <Text style={styles.heading}>课程核对结果</Text>
    <Dropdown label="核对结果" value={outcome} returnValue options={Object.entries(reviewLabels).map(([value,label])=>({value,label}))} disabled={busy} onChange={value=>{U(value);C(null);W(false)}}/>
    <Body muted>{outcome==='link'?'确认两门课满足同一个课程要求，随后按成绩重新判断。':outcome==='reject'?'仅排除所选两门课的候选关系，原课程挂科学分保留。':outcome==='defer'?'保存暂缓原因，保留待核实；成绩变化后需重新核对。':'保存学校成绩、学分或记录异常情况，保留待核实；待学校更正或补齐后更新成绩。'}只影响本工具核对，不修改学校成绩。</Body>
    <Body>原课程：{names(from)}</Body><Body muted>已根据这条待核实记录自动带出，无需重新选择。</Body>
    <Button secondary title="收起这门课的核对" disabled={busy} onPress={()=>V(null)}/>
    {['link','reject'].includes(outcome)&&<Dropdown label={outcome==='reject'?'排除对应的课程':'重修或替代课程'} value={to} returnValue options={options.filter(x=>x.value!==from)} disabled={busy} onChange={v=>{K(v);C(null)}}/>}
    <Field label="确认依据" value={reason} editable={!busy} multiline maxLength={500} onChangeText={v=>{R(v);C(null)}} helper="例如教务替代通知、培养方案版本或核实情况"/>
    {outcome==='link'&&<Choice label="适用于我查询的该年级整个专业" detail="不勾选时只适用于当前学生；不会共享给其他老师。" selected={whole} disabled={busy} onPress={()=>{W(!whole);C(null)}}/>}
    {outcome==='link'?<>
    {confirm==="create"?<>
     <Body>将 {names(from)} 与 {names(to)} 按同一课程要求统计。</Body>
     <Body>适用范围：{whole?"你所查询的该年级整个专业":"仅当前学生"}。关联后会重新判断是否通过，历史成绩保留。</Body>
     <Button title="确认关联并重新统计" loading={busy} onPress={()=>run(async()=>{await post(API+"/links",{action:"create",cohortKey,studentId,fromCode:from,toCode:to,reason,scope:whole?"cohort":"student"});V(null);F("");K("");R("");W(false)})}/>
     <Button secondary title="取消关联" disabled={busy} onPress={()=>C(null)}/>
    </>:<Button title="核对课程对应关系" disabled={!from||!to||from===to||!reason.trim()||busy} onPress={()=>C("create")}/>}
    </>:confirm==='review'?<>
     <Body>结果：{reviewLabels[outcome]}。原课程：{names(from)}{outcome==='reject'?'；排除课程：'+names(to):''}。</Body>
     <Body>仅适用于当前学生。依据：{reason}。记录可撤销；不会据此直接标记通过。</Body>
     <Button title="确认保存核对结果" loading={busy} onPress={()=>run(async()=>{await post(API+'/reviews',{action:'create',cohortKey,studentId,fromCode:from,toCode:outcome==='reject'?to:'',outcome,reason,fingerprint:c.reviewFingerprint});V(null);R('')})}/>
     <Button secondary title="取消保存" disabled={busy} onPress={()=>C(null)}/>
    </>:<Button title="保存核对结果" disabled={!from||!reason.trim()||busy||!c.reviewFingerprint||(outcome==='reject'&&(!to||from===to))} onPress={()=>C('review')}/>}

   </Card>}
    {(c.reviews||[]).map(r=><View key={r.id} style={{gap:4}}><Body>已记录：{reviewLabels[r.outcome]}{r.outcome==='reject'?'（'+r.from_code+' 与 '+r.to_code+'）':''}</Body><Body muted>{r.reason} · {dateLabel(r.created_at)}</Body>{r.stale&&<Body muted>成绩已变化，请重新核对；该条暂缓或异常结论不再影响最新判定。</Body>}</View>)}
    {!!c.recovery&&<Body>{({makeup:"补考已通过",retake:"重修已通过",linked:"关联课程已通过"})[c.recovery]}</Body>}
    {c.attempts.map(r=><View key={r.id} style={{borderTopWidth:1,borderColor:"#D9E4F0",paddingTop:10,gap:4}}>
     <Body>{r.semester}　{r.attempt||"原始考试记录"}　{r.score||"尚无成绩"}</Body>
     <Body muted>{r.name}　学分 {r.credits||"暂无"}{r.remark?"　"+r.remark:""}</Body>
    </View>)}
    {c.evidence.map(l=><Body muted key={l.id}>教师确认依据：{l.reason}</Body>)}
   </Card></View>)}
   {!shown.length&&<Body muted>当前条件没有课程。</Body>}
   {shown.length>25&&<View style={{gap:8}}><Body muted>当前 {offset+1}–{Math.min(offset+25,shown.length)} / {shown.length} 门</Body><Button secondary title="上一页" disabled={!offset} onPress={()=>O(Math.max(0,offset-25))}/><Button secondary title="下一页" disabled={offset+25>=shown.length} onPress={()=>O(offset+25)}/></View>}
   {!!data.reviews?.length&&<Card>
    <Text style={styles.heading}>核对结果与撤销记录</Text>
    {data.reviews.map(r=><View key={r.id} style={{gap:8,paddingVertical:8}}>
     <Body>{reviewLabels[r.outcome]} · {r.active?(reviewStale(r)?'成绩已变化，需重新核对':'有效'):'已撤销'}</Body>
     <Body>{options.find(o=>o.value===r.from_code)?.label||r.from_code}{r.to_code?' ↔ '+(options.find(o=>o.value===r.to_code)?.label||r.to_code):''}</Body>
     <Body muted>仅当前学生；{r.reason} · {dateLabel(r.created_at)}{r.revoked_at?'；撤销于 '+dateLabel(r.revoked_at):''}</Body>
     {!!r.active&&(confirm==='review:'+r.id?<><Body>撤销后重新按学校成绩及剩余有效核对记录统计，候选可能重新出现。</Body><Button secondary title="确认撤销这条核对" loading={busy} onPress={()=>run(()=>post(API+'/reviews',{action:'revoke',id:r.id,cohortKey,studentId}))}/><Button secondary title="保留核对记录" disabled={busy} onPress={()=>C(null)}/></>:<Button secondary title="撤销这条核对记录" disabled={busy} onPress={()=>C('review:'+r.id)}/>)}
    </View>)}
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
