import React,{useCallback,useRef,useState} from "react";
import {Text} from "react-native";
import {useFocusEffect} from "@react-navigation/native";
import {Page,Title,Body,Card,Button,Choice,ErrorBox,styles} from "../components/ui";
import Dropdown from "../components/Dropdown";
import {get,post} from "../utils/api";
const API="/api/academic-grades";
export default function AcademicScopeScreen({navigation}){
 const [profile,P]=useState(null),[groups,G]=useState([]),[options,V]=useState(null),[input,I]=useState({year:"",facultyCode:"",majorCode:"",classes:[]}),[error,E]=useState(null),[busy,B]=useState(false);
 const version=useRef(0),alive=useRef(false),lock=useRef(false);
 const loadOptions=async value=>{const seq=++version.current;const q=Object.entries({year:value.year,facultyCode:value.facultyCode,majorCode:value.majorCode}).map(([k,v])=>k+"="+encodeURIComponent(v)).join("&");try{const r=await get(API+"/options?"+q);if(alive.current&&seq===version.current)V(r)}catch(e){if(alive.current&&seq===version.current)E(e)}};
 useFocusEffect(useCallback(()=>{alive.current=true;get(API+"/state").then(r=>{if(alive.current){P(r.profile);G(r.profile.scopes);if(r.connection.connected)void loadOptions(input)}}).catch(E);return()=>{alive.current=false;version.current++}},[]));
 const change=(key,value)=>{const next={...input,[key]:value};if(key==="facultyCode"){next.majorCode="";next.classes=[]}if(["year","majorCode"].includes(key))next.classes=[];I(next);V(o=>o?{...o,...(key==="facultyCode"?{majors:[]}:{}),classes:[]}:o);void loadOptions(next)};
 const add=()=>{
  if(!input.year||!input.facultyCode||!input.majorCode){E(new Error("请选择院系、年级和专业"));return}
  if(groups.some(s=>s.year===input.year&&s.facultyCode===input.facultyCode&&s.majorCode===input.majorCode)){E(new Error("该专业年级已有设置，请移除原组后重新选择班级"));return}
  const major=options.majors.find(x=>x.value===input.majorCode),faculty=options.faculties.find(x=>x.value===input.facultyCode);
  G([...groups,{...input,facultyName:faculty?.label,majorName:major?.label,classLabels:input.classes.map(v=>options.classes.find(x=>x.value===v)?.label||v)}]);E(null);
 };
 const save=async()=>{if(lock.current)return;lock.current=true;B(true);E(null);try{const r=await post(API+"/profile",{revision:profile.revision,scopes:groups.map(s=>({year:s.year,facultyCode:s.facultyCode,majorCode:s.majorCode,classes:s.classes}))});P(r);navigation.goBack()}catch(e){E(e)}finally{lock.current=false;B(false)}};
 return <Page>
  <Title>我的专业与班级</Title>
  <Body muted>首次查询成绩时设置所带范围。支持跨年级、多专业；专业单科查询默认整个专业。</Body>
  <ErrorBox error={error}/>
  <Button secondary title="连接教务并读取选项" onPress={()=>navigation.navigate("AcademicAccess",{returnTo:"AcademicScope"})}/>
  <Button secondary title="重新读取学校选项" disabled={busy} onPress={()=>loadOptions(input)}/>
  {options&&<Card>
   <Dropdown label="年级" value={input.year} options={options.years} returnValue onChange={v=>change("year",v)}/>
   <Dropdown label="院系" value={input.facultyCode} options={options.faculties} returnValue onChange={v=>change("facultyCode",v)}/>
   <Dropdown label="专业" value={input.majorCode} options={options.majors} returnValue disabled={!input.facultyCode} onChange={v=>change("majorCode",v)}/>
   <Body>所带行政班</Body>
   <Choice label="该专业该年级全部班级" selected={!input.classes.length} onPress={()=>I({...input,classes:[]})}/>
   {options.classes.map(c=><Choice key={c.value} label={c.label} selected={input.classes.includes(c.value)} onPress={()=>I({...input,classes:input.classes.includes(c.value)?input.classes.filter(v=>v!==c.value):[...input.classes,c.value]})}/>)}
   {!!input.majorCode&&!options.classes.length&&<Body muted>学校当前没有返回班级选项。可选择整个专业；指定班级需待学校返回选项后设置。</Body>}
   <Button secondary title="加入这组范围" onPress={add}/>
  </Card>}
  {groups.map((s,i)=><Card key={s.year+":"+s.facultyCode+":"+s.majorCode}>
   <Text style={styles.heading}>{s.year}级 {s.majorName}</Text>
   <Body muted>{s.facultyName}</Body>
   <Body>{s.classes.length?s.classLabels?.join("、")||s.classes.join("、"):"全部行政班"}</Body>
   <Button secondary title="移除这组范围" disabled={busy} onPress={()=>G(groups.filter((_,n)=>n!==i))}/>
  </Card>)}
  <Button title="保存管理范围" loading={busy} disabled={!profile||!groups.length} onPress={save}/>
  <Body muted>保存后可在学业查询中核对名单与人数；无法查询的范围会显示具体状态。调整范围不会删除原有录入记录。</Body>
 </Page>;
}
