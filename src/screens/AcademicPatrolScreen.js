import React,{useCallback,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Title,Body,Card,Button,Choice,ErrorBox,Pill,styles} from '../components/ui';
import StudentPortrait from '../components/StudentPortrait';
import Dropdown from '../components/Dropdown';
import {get} from '../utils/api';
import {shareAcademicExport} from '../utils/academicExport';
const API='/api/academic-grades';
export default function AcademicPatrolScreen({navigation}){
 const [data,D]=useState(null),[term,T]=useState(''),[includePassed,I]=useState(false),[expanded,X]=useState({}),[error,E]=useState(null),[busy,B]=useState(false);const alive=useRef(false),lock=useRef(false),input=useRef({});input.current={term,includePassed};
 const query=()=>'?term='+encodeURIComponent(input.current.term)+'&includePassed='+input.current.includePassed;
 const load=async()=>{const d=await get(API+'/patrol'+query());if(alive.current)D(d)};
 useFocusEffect(useCallback(()=>{alive.current=true;void load().catch(E);return()=>{alive.current=false}},[]));
 const run=async fn=>{if(lock.current)return;lock.current=true;B(true);E(null);try{await fn()}catch(e){if(alive.current)E(e)}finally{lock.current=false;B(false)}};
 return <Page><Title>补考巡考</Title><Body muted>按科目核对挂科的所带学生，便于考前点名与人工核对。</Body><ErrorBox error={error}/>
 {data&&<>
  <Dropdown label="原考试学期" value={term||data.term||''} returnValue options={data.terms.map(x=>({value:x,label:x+(x===data.asOf?'（当前学期）':'')}))} disabled={busy} onChange={v=>{T(v);input.current.term=v;X({});void run(load)}}/>
  <Choice label="同时查看已有通过记录的学生" selected={includePassed} disabled={busy} onPress={()=>{I(!includePassed);input.current.includePassed=!includePassed;void run(load)}}/>
  <Card><Body>{data.courseCount} 门科目 · {data.studentCount} 名学生 · {data.studentCourseCount} 人次</Body><Body muted>所带历史成绩已同步 {data.coverage.synced}/{data.coverage.total} 人。{data.coverage.missing?'尚有未同步学生，名单可能不完整。':''}</Body><Body muted>{data.note}</Body>{!!data.excludedAbsences&&<Body muted>已排除 {data.excludedAbsences} 条旷考记录，无需查找补考。</Body>}{!!data.issues&&<Body muted>另有 {data.issues} 条缺考、缓考等特殊记录，请到待核实页面核对。</Body>}</Card>
  <Button secondary title="导出巡考核对名单" disabled={busy||!data.courses.length} onPress={()=>run(async()=>shareAcademicExport(await get(API+'/patrol/export'+query())))}/>
  {!data.courses.length&&<Body muted>该学期没有符合条件的已同步记录。可切换原考试学期，或先同步所带学生成绩。</Body>}
  {data.courses.map(c=><Card key={c.code}><Text style={styles.heading}>{c.name}</Text><Body muted>{c.code}</Body><Body>原始不及格 {c.originalFailed} 人 · 仍未通过 {c.unresolved} 人</Body><Body muted>待核实 {c.pending} 人 · 已有通过记录 {c.passed} 人</Body><Button secondary title={(expanded[c.code]?'收起':'查看')+'挂科学生（'+c.students.length+'人）'} onPress={()=>X({...expanded,[c.code]:!expanded[c.code]})}/>
   {expanded[c.code]&&c.students.map(s=><View key={s.studentId} style={{borderTopWidth:1,borderColor:'#D9E4F0',paddingTop:12,gap:7}}><View style={{flexDirection:"row",gap:12,alignItems:"center"}}><StudentPortrait studentId={s.studentId}/><Text style={styles.heading}>{s.name}</Text></View><Body muted>{s.studentId}　{s.className}</Body><Body>原始成绩 {s.score}</Body><Pill tone={s.state==='passed'?'success':s.state==='unresolved'?'warning':'neutral'}>{({passed:'已有明确通过记录',unresolved:'仍未通过，资格待核对',pending:'课程关系或成绩待核实'})[s.state]}</Pill>{s.latestPass&&<Body muted>{s.latestPass.semester}　{s.latestPass.attempt||'通过记录'}　{s.latestPass.score}</Body>}<Button secondary title={'查看'+s.name+'的档案'} onPress={()=>navigation.navigate('AcademicStudent',{cohortKey:s.cohortKey,studentId:s.studentId})}/></View>)}
  </Card>)}
 </>}
 <Button secondary title="刷新巡考名单" disabled={busy} onPress={()=>run(load)}/>
 </Page>;
}
