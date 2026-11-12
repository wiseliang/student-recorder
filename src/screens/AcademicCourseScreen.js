import React,{useCallback,useRef,useState} from "react";
import {Text,View} from "react-native";
import {useFocusEffect} from "@react-navigation/native";
import {Page,Title,Body,Card,Button,Field,Choice,ErrorBox,styles} from "../components/ui";
import Dropdown from "../components/Dropdown";
import {get,post} from "../utils/api";
import {dateLabel,gradeState} from "./AcademicGradesScreen";
const API="/api/academic-grades";
const filters=[["all","全部成绩"],["failed","本次查询不及格成绩"],["unresolved","历史判定仍未通过"],["recovered","补考或重修已通过"],["pending","历史或对应关系待核实"],["missing","本次未查到课程记录"]].map(([value,label])=>({value,label}));
export default function AcademicCourseScreen({navigation,route}){
 const key=route.params.cohortKey;
 const [options,V]=useState(null),[catalog,K]=useState([]),[term,T]=useState(""),[code,C]=useState(""),[managed,M]=useState(false),[filter,F]=useState("all"),[data,D]=useState(null),[offset,O]=useState(0),[error,E]=useState(null),[busy,B]=useState(false);
 const alive=useRef(false),lock=useRef(false);
 useFocusEffect(useCallback(()=>{alive.current=true;Promise.all([get(API+"/options"),get(API+"/catalog?cohortKey="+key)]).then(([o,c])=>{if(alive.current){V(o);K(c.courses)}}).catch(E);return()=>{alive.current=false}},[key]));
 const query=async()=>{if(lock.current)return;lock.current=true;B(true);E(null);D(null);O(0);try{const r=await post(API+"/course",{cohortKey:key,term,courseCode:code.trim(),managedOnly:managed,filter});if(alive.current)D(r)}catch(e){if(alive.current)E(e)}finally{lock.current=false;B(false)}};
 const termLabel=options?.terms.find(x=>x.value===term)?.label;
 const courses=catalog.filter(c=>c.semester===termLabel);
 const courseOptions=[...new Map(courses.map(c=>[c.code,{value:c.code,label:c.name+"（"+c.code+"）"}])).values()];
 const clear=()=>{D(null);O(0)};
 return <Page>
  <Title>专业单科成绩</Title>
  <Body muted>默认查询所选年级整个专业。课程无记录不算挂科，补考重修情况依据已同步历史。</Body>
  <ErrorBox error={error}/>
  {!options&&<Button secondary title="连接教务" onPress={()=>navigation.navigate("AcademicAccess")}/>}
  <Card>
   <Dropdown label="学期" value={term} options={options?.terms||[]} returnValue disabled={busy} onChange={v=>{T(v);C("");clear()}}/>
   <Dropdown label="已同步课程" value={code} options={courseOptions} returnValue disabled={busy||!courseOptions.length} helper="课程列表来自已同步的学生成绩；也可直接输入课程代码查询。" onChange={v=>{C(v);clear()}}/>
   <Field label="课程代码" value={code} editable={!busy} autoCapitalize="none" onChangeText={v=>{C(v);clear()}}/>
   <Choice label="只查我所带的班级" selected={managed} disabled={busy} onPress={()=>{M(!managed);clear()}}/>
   <Dropdown label="筛选情况" value={filter} options={filters} returnValue disabled={busy} onChange={v=>{F(v);clear()}}/>
   <Button title="查询这门课程" disabled={!term||!code.trim()} loading={busy} onPress={query}/>
  </Card>
  {data&&<>
   <Card>
    <Text style={styles.heading}>{data.scope.year}级 {data.scope.majorName}</Text>
    <Body>{data.summary.scopeLabel}：名单 {data.summary.rosterCount} 人，查到记录 {data.summary.returnedStudents} 人，已发布成绩 {data.summary.publishedStudents} 人</Body>
    <Body>本次不及格成绩涉及 {data.summary.failedScoreStudents} 人，历史判定仍未通过 {data.summary.observedUnresolvedStudents} 人</Body>
    <Body muted>历史待同步/核实 {data.summary.unknownHistoryStudents} 人；本次无课程记录 {data.summary.missingStudents} 人</Body>
    <Body muted>查询时间：{dateLabel(data.checkedAt)}</Body>
    <Body muted>{data.note}</Body>
   </Card>
   {!data.records.length&&<Body muted>当前条件没有结果，可调整学期、课程或筛选条件。</Body>}
   {data.records.slice(offset,offset+50).map((r,i)=><Card key={r.studentId+":"+r.code+":"+i}>
    <Text style={styles.heading}>{r.name}　{r.score||"暂无成绩"}</Text>
    <Body muted>{r.studentId}　{r.className}</Body>
    <Body>{r.courseName||code}</Body>
    <Body>{gradeState[r.courseState]}</Body>
    {!!r.classRank&&<Body muted>单科班级排名 {r.classRank}　专业排名 {r.majorRank||"暂无"}</Body>}
    <Body muted>历史更新：{dateLabel(r.archiveCheckedAt)}</Body>
    <Button secondary title={"查看"+r.name+"的全部成绩"} onPress={()=>navigation.navigate("AcademicStudent",{cohortKey:key,studentId:r.studentId})}/>
   </Card>)}
   {data.records.length>50&&<View style={{gap:8}}>
    <Body muted>当前 {offset+1}–{Math.min(offset+50,data.records.length)} / {data.records.length} 条</Body>
    <Button secondary title="上一页" disabled={!offset} onPress={()=>O(Math.max(0,offset-50))}/>
    <Button secondary title="下一页" disabled={offset+50>=data.records.length} onPress={()=>O(offset+50)}/>
   </View>}
  </>}
 </Page>;
}
