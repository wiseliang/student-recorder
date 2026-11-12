import React,{useCallback,useState,useRef} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Title,Body,Card,Button,ErrorBox} from '../components/ui';
import {get,post} from '../utils/api';
import {dateLabel} from './AcademicGradesScreen';
const API='/api/academic-grades';
export default function AcademicManageScreen({navigation}){
 const [data,D]=useState(null),[error,E]=useState(null),[busy,B]=useState(false),[result,R]=useState(null);const alive=useRef(false),lock=useRef(false);
 const load=async()=>{const d=await get(API+'/dashboard');if(alive.current)D(d)};
 useFocusEffect(useCallback(()=>{alive.current=true;void load().catch(E);return()=>{alive.current=false}},[]));
 const run=async fn=>{if(lock.current)return;lock.current=true;B(true);E(null);try{await fn();await load()}catch(e){E(e)}finally{lock.current=false;B(false)}};
 return <Page><Title>名单与连接</Title><ErrorBox error={error}/>
  <Card><Body>从学工系统匹配你所带的学生，使用完整学号核对。重新匹配会保留手动加入和排除设置。</Body><Body muted>名单更新：{dateLabel(data?.managedCheckedAt)}</Body>
   <Button title="匹配学工所带学生" loading={busy} onPress={()=>run(async()=>R(await post(API+'/managed/refresh')))}/>
   {result&&<Body>学工 {result.total} 人，教务已匹配 {result.matched} 人，待补充范围 {result.unmatched} 人。</Body>}
   <Body muted>默认同步与看板仅针对所带学生；手动调整请进入学生列表。</Body>
  </Card>
  <Button secondary title="保存与查看学生照片" onPress={()=>navigation.navigate('AcademicPhotos')}/>
  <Button secondary title="设置所带专业与班级" onPress={()=>navigation.navigate('AcademicScope')}/>
  <Button secondary title="连接学工系统" onPress={()=>navigation.navigate('SchoolLogin')}/>
  <Button secondary title="查看教务连接" onPress={()=>navigation.navigate('AcademicAccess')}/>
  <Button secondary title="查看我的学生并调整" onPress={()=>navigation.navigate('AcademicStudents')}/>
  {!!data?.overrides.exclude?.length&&<Card><Body>手动排除 {data.overrides.exclude.length} 人</Body>{data.overrides.exclude.map(id=><Button key={id} secondary title={'恢复 '+id+' 的自动归属'} disabled={busy} onPress={()=>run(()=>post(API+'/managed/change',{studentId:id,action:'reset'}))}/>)}</Card>}
 </Page>;
}
