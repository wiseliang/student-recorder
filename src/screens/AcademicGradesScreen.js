import React,{useCallback,useRef,useState,useEffect} from 'react';
import {View,Text,Pressable} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Title,Body,Card,Button,ErrorBox,RowLink,colors,styles} from '../components/ui';
import Dropdown from '../components/Dropdown';
import {get,post} from '../utils/api';
export const dateLabel=v=>v?new Date(v).toLocaleString('zh-CN'):'尚未同步';
export const gradeState={passed:'已通过',unresolved:'仍未通过',pending:'关系或成绩待核实',unknown:'成绩状态待核实',not_synced:'历史尚未同步',no_published_record:'未查到本次课程记录'};
const API='/api/academic-grades';
export default function AcademicGradesScreen({navigation}){
 const [data,D]=useState(null),[state,S]=useState(null),[term,T]=useState(''),[error,E]=useState(null),[busy,B]=useState(false);
 const alive=useRef(false),prompted=useRef(false),lock=useRef(false),current=useRef(''),imported=useRef(false);current.current=term;
 const load=async()=>{const [d,s]=await Promise.all([get(API+'/dashboard'+(current.current?'?term='+encodeURIComponent(current.current):'')),get(API+'/state')]);if(!alive.current)return;D(d);S(s);if(!s.profile.scopes.length&&!prompted.current){prompted.current=true;navigation.navigate('AcademicScope',{onboarding:true})}return d};
 useFocusEffect(useCallback(()=>{alive.current=true;void (async()=>{const d=await load();if(d&&d.profile.scopes.length&&d.connection.connected&&d.scopeSource==='classes'&&!imported.current){imported.current=true;lock.current=true;B(true);try{await post(API+'/managed/refresh');await load()}finally{lock.current=false;B(false)}}})().catch(E);return()=>{alive.current=false}},[]));
 const active=['pending','running','pause_requested'].includes(state?.job?.status);
 useEffect(()=>{if(!active)return;let polling=false;const timer=setInterval(async()=>{if(!alive.current||polling||lock.current)return;polling=true;try{await load()}catch(e){if(alive.current)E(e)}finally{polling=false}},3000);return()=>clearInterval(timer)},[active]);
 const run=async fn=>{if(lock.current)return;lock.current=true;B(true);E(null);try{await fn();await load()}catch(e){if(alive.current)E(e)}finally{lock.current=false;B(false)}};
 const open=view=>navigation.navigate('AcademicStudents',{view,term:data?.term});
 const count=data?.counts,c=data?.coverage,job=state?.job,p=job?.payload;
 const metrics=[['本学期挂科',count?.currentStudents,'current',true],['待补考核对',count?.historicalStudents,'makeup',true],['往期未通过',count?.historicalStudents,'historical',false],['尚未同步',c?.missing,'missing',false]];
 return <Page>
  <View style={{gap:6}}><Title>学业管理</Title><Body muted>先看所带学生，及时跟进未通过课程。</Body></View>
  <ErrorBox error={error}/>
  {data&&<>
   <Dropdown label="统计学期" value={term||data.term||''} returnValue options={data.terms.map(x=>({value:x,label:x+(x===data.defaultTerm?(data.calendarVerified?'（学校当前学期）':'（默认学期，待校历核验）'):'')}))} onChange={v=>{T(v);current.current=v;void run(load)}}/>
   <View style={{backgroundColor:colors.surface,borderRadius:16,padding:20,gap:10}}>
    <View style={{flexDirection:'row',alignItems:'baseline',gap:8}}><Text style={{fontSize:36,fontWeight:'600',color:colors.ink}}>{c.total}</Text><Body>名所带学生</Body></View>
    <Body muted>历史已同步 {c.synced} 人 · 尚缺 {c.missing} 人</Body>
    <Body muted>{c.currentNoGrades} 人未查到所选学期成绩，不能视为没有挂科。</Body>
    {data.scopeSource!=='school'&&<Body muted>当前按班级设置展示；请先在“名单、范围与连接”匹配学工所带学生。</Body>}
    {!data.calendarVerified&&<Body muted>当前学期尚未由学校校历核验，请先连接学工或手动选择学期。</Body>}
   </View>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{metrics.map(([label,value,view,alert])=><Pressable key={view} accessibilityRole="button" accessibilityLabel={label} onPress={()=>open(view)} style={({pressed})=>({width:'48%',flexGrow:1,borderRadius:14,padding:18,gap:8,backgroundColor:alert?'#FFF2F1':colors.surface,opacity:pressed?.7:1})}>
    <Text style={{fontSize:30,fontWeight:'600',color:alert?colors.danger:colors.ink}}>{value??'—'}</Text><Text style={{fontSize:15,color:colors.ink}}>{label}</Text>
   </Pressable>)}</View>
   <Body muted>数字只统计已读取记录；待补考核对含往期欠课，资格需以学校安排核实。</Body>
   <Button title={active?'正在同步所选范围…':'同步我的学生成绩'} loading={busy} disabled={active} onPress={()=>run(()=>post(API+'/sync',{range:'managed'}))}/>
   {job&&<View style={{gap:5}}><Body muted>{({pending:'准备同步',running:'正在同步',pause_requested:'准备暂停',paused:'已暂停',partial:'部分完成',completed:'同步完成',failed:'同步中断'})[job.status]} · 已保存 {p.success||0}/{p.total||0} 人{p.range==='professional'?'（全专业任务）':''}</Body>{!!p.message&&<Body muted>{p.message}</Body>}
    {active?<Button secondary title="暂停同步" disabled={busy} onPress={()=>run(()=>post(API+'/sync/'+job.id+'/pause'))}/>:['paused','partial','failed'].includes(job.status)&&p.range==='managed'&&<Button secondary title="继续同步未完成学生" disabled={busy} onPress={()=>run(()=>post(API+'/sync',{resumeId:job.id}))}/>}
   </View>}
   <View style={{backgroundColor:colors.surface,borderRadius:16,paddingHorizontal:18}}>
    <RowLink title="补考巡考" detail="按科目核对挂科的所带学生" icon="clipboard-outline" onPress={()=>navigation.navigate("AcademicPatrol")}/>
    <RowLink title="我的学生" detail="全部所带学生与成绩档案" icon="people-outline" onPress={()=>open('all')}/>
    <RowLink title="成绩或课程关系待核实" detail={String(count.pendingStudents)+' 人'} icon="help-circle-outline" onPress={()=>open('pending')}/>
    <RowLink title="曾不及格后已通过" detail={String(count.recoveredStudents)+' 人'} icon="checkmark-circle-outline" onPress={()=>open('recovered')}/>
    <RowLink title="全专业查询" detail="按专业查学生和单科成绩" icon="search-outline" onPress={()=>navigation.navigate('AcademicStudents',{range:'professional',term:data.term})}/>
    <RowLink title="名单、范围与连接" detail="学工匹配、手动调整、教务连接" icon="settings-outline" last onPress={()=>navigation.navigate('AcademicManage')}/>
   </View>
   <Button secondary title="刷新看板" disabled={busy} onPress={()=>run(load)}/>
  </>}
 </Page>;
}
