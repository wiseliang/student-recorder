import React,{useCallback,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Title,Body,Card,Button,Field,Choice,ErrorBox,styles} from '../components/ui';
import Dropdown from '../components/Dropdown';
import {get,post} from '../utils/api';
import {shareAcademicExport} from '../utils/academicExport';
import {dateLabel} from './AcademicGradesScreen';
const API='/api/academic-grades',labels={all:'我的学生',current:'本学期挂科',makeup:'待补考核对名单',historical:'往期未通过',missing:'尚未同步',pending:'成绩与关系待核实',recovered:'曾不及格后已通过'};
export default function AcademicStudentsScreen({navigation,route}){
 const [data,D]=useState(null),[view,V]=useState(route.params?.view||'all'),[term,T]=useState(route.params?.term||''),[range,R]=useState(route.params?.range==='professional'?'professional':'managed'),[key,K]=useState(''),[q,Q]=useState(''),[offset,O]=useState(0),[error,E]=useState(null),[busy,B]=useState(false),[confirm,C]=useState(false),[byCourse,Y]=useState(false);
 const alive=useRef(false),lock=useRef(false),values=useRef({});values.current={view,term,range,key,q,offset};
 const params=()=>{const v=values.current;return 'view='+v.view+'&range='+v.range+'&term='+encodeURIComponent(v.term)+'&cohortKey='+v.key+'&q='+encodeURIComponent(v.q)+'&offset='+v.offset};
 const load=async()=>{const d=await get(API+'/dashboard?'+params());if(alive.current){D(d);if(!values.current.term)T(d.term||'')}};
 useFocusEffect(useCallback(()=>{alive.current=true;void load().catch(E);return()=>{alive.current=false}},[]));
 const run=async fn=>{if(lock.current)return;lock.current=true;B(true);E(null);try{await fn();await load()}catch(e){if(alive.current)E(e)}finally{lock.current=false;B(false)}};
 const change=(name,value)=>{values.current={...values.current,[name]:value,offset:0};O(0);({view:V,term:T,range:R,key:K})[name](value);void run(load)};
 return <Page>
  <Title>{range==='professional'?'全专业学生查询':labels[view]}</Title><ErrorBox error={error}/>
  <Choice label="查看整个专业，包含其他学生" selected={range==='professional'} disabled={busy} onPress={()=>change('range',range==='professional'?'managed':'professional')}/>
  {data&&<>
   <Dropdown label="学期" value={term||data.term||''} returnValue options={data.terms.map(s=>({value:s,label:s}))} onChange={v=>change('term',v)}/>
   <Dropdown label="专业范围" value={key} returnValue options={[{value:'',label:'全部已设置专业'},...data.profile.scopes.map(s=>({value:s.key,label:s.year+'级 '+s.majorName}))]} onChange={v=>change('key',v)}/>
   <Dropdown label="关注情况" value={view} returnValue options={Object.entries(labels).map(([value,label])=>({value,label:value==='all'?'全部学生':label}))} onChange={v=>change('view',v)}/>
   <Field label="搜索姓名、学号或班级" value={q} onChangeText={Q}/><Button secondary title="搜索学生" disabled={busy} onPress={()=>{O(0);values.current.offset=0;void run(load)}}/>
   <Body muted>匹配 {data.total} 人。当前范围历史同步 {data.coverage.synced}/{data.coverage.total} 人。</Body>
   {['makeup','historical'].includes(view)&&<Body muted>{data.makeupNote}</Body>}
   {['current','makeup','historical','pending','recovered'].includes(view)&&<Button secondary title="导出当前风险核对名单" disabled={busy} onPress={()=>run(async()=>shareAcademicExport(await get(API+'/export?'+params())))}/>}
   {view==='current'&&<Choice label="按课程汇总挂科情况" selected={byCourse} onPress={()=>Y(!byCourse)}/>}
   {view==='current'&&byCourse&&data.courses.map(c=><Card key={c.code}><Text style={styles.heading}>{c.name}</Text><Body>仍未通过 {c.failedStudents} 人 · 已发布成绩 {c.publishedStudents} 人</Body><Body muted>当前已发布样本的未通过比例 {c.failedRate??'待核实'}%，不含尚未同步或未出分学生。</Body>{key?<Button secondary title="查询这门课的学生成绩" onPress={()=>navigation.navigate('AcademicCourse',{cohortKey:key,courseCode:c.code,termLabel:data.term})}/>:<Body muted>先选择专业范围，可进入该课程明细。</Body>}</Card>)}
   {key&&<Button secondary title="查询这个专业的单科成绩" onPress={()=>navigation.navigate('AcademicCourse',{cohortKey:key})}/>}
   {range==='professional'&&(confirm?<Card><Body>将同步全部已设置专业的学生，包含非所带学生。此次操作会读取更多成绩。</Body><Button title="确认同步全专业" disabled={busy} onPress={()=>run(async()=>{await post(API+'/sync',{range:'professional'});C(false)})}/><Button secondary title="取消" onPress={()=>C(false)}/></Card>:<Button secondary title="同步全专业成绩…" onPress={()=>C(true)}/>)}
   {!data.students.length&&<Body muted>当前条件没有匹配学生。未同步的成绩不能据此判断为没有挂科。</Body>}
   {!(view==='current'&&byCourse)&&data.students.map(s=><Card key={s.studentId}>
    <Text style={styles.heading}>{s.name}</Text><Body muted>{s.studentId}　{s.className||'班级待匹配'}</Body>
    <Body>本学期挂科 {s.currentFailures} 门 · 往期未通过 {s.historicalFailures} 门</Body>
    {!!s.recoveredCount&&<Body>曾不及格后已通过 {s.recoveredCount} 门</Body>}
    {view==='recovered'&&(s.recoveries||[]).map(r=><Body key={r.code}>{r.name}　{r.score}　{r.semester} {r.attempt}</Body>)}
    {!!s.pending&&<Body muted>另有 {s.pending} 门关系或成绩待核实</Body>}
    {s.risk.filter(r=>view==='current'?r.bucket==='current':['historical','makeup'].includes(view)?r.bucket==='historical':true).map(r=><Body key={r.code}>{r.name}　{r.score}　{r.state==='pending'?'待核实':r.semester}</Body>)}
    <Body muted>{dateLabel(s.checkedAt)}{s.recordCount!==null?' · '+s.recordCount+' 条成绩':''}</Body>
    {s.cohortKey?<Button secondary title={'查看'+s.name+'的成绩'} onPress={()=>navigation.navigate('AcademicStudent',{cohortKey:s.cohortKey,studentId:s.studentId})}/>:<Body muted>尚未在已设置教务范围中匹配，请补充年级院系并重新匹配学工名单。</Body>}
    {data.scopeSource==='school'&&<Button secondary title={range==='professional'?'加入我的学生':'从我的学生中排除'} disabled={busy} onPress={()=>run(()=>post(API+'/managed/change',{studentId:s.studentId,action:range==='professional'?'include':'exclude'}))}/>}
   </Card>)}
   {data.total>50&&<View style={{gap:8}}><Body muted>当前 {offset+1}–{Math.min(offset+50,data.total)} / {data.total}</Body><Button secondary title="上一页" disabled={busy||!offset} onPress={()=>{const n=Math.max(0,offset-50);O(n);values.current.offset=n;void run(load)}}/><Button secondary title="下一页" disabled={busy||offset+50>=data.total} onPress={()=>{const n=offset+50;O(n);values.current.offset=n;void run(load)}}/></View>}
  </>}
 </Page>;
}
