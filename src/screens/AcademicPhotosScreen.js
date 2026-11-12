import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Text} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Title,Body,Card,Button,ErrorBox,styles} from '../components/ui';
import {get,post} from '../utils/api';
const API='/api/academic-grades';
export default function AcademicPhotosScreen({navigation}){
 const [data,D]=useState(null),[error,E]=useState(null),[busy,B]=useState(false);const alive=useRef(false),lock=useRef(false);
 const load=async()=>{const d=await get(API+'/photos/state');if(alive.current)D(d)};
 useFocusEffect(useCallback(()=>{alive.current=true;void load().catch(E);return()=>{alive.current=false}},[]));
 const active=['pending','running','pause_requested'].includes(data?.job?.status);
 useEffect(()=>{if(!active)return;let working=false;const timer=setInterval(async()=>{if(working||!alive.current||lock.current)return;working=true;try{await load()}catch(e){if(alive.current)E(e)}finally{working=false}},2500);return()=>clearInterval(timer)},[active]);
 const run=async fn=>{if(lock.current)return;lock.current=true;B(true);E(null);try{await fn();await load()}catch(e){if(alive.current)E(e)}finally{lock.current=false;B(false)}};
 const job=data?.job,p=job?.payload;
 return <Page><Title>学生照片</Title><Body muted>保存教务学生详情页的档案照片，用于学生档案和巡考时人工核对。</Body><ErrorBox error={error}/>
 {data&&<Card><Text style={styles.heading}>所带学生照片</Text><Body>已保存 {data.saved}/{data.total} 人 · 尚缺 {data.missing} 人</Body><Body muted>按详情页完整学号核对后保存，查询失败保留已有照片。仅通过本应用登录权限读取。</Body>{!!data.duplicateImages&&<Body muted>有 {data.duplicateImages} 张照片的文件完全相同，请在档案中人工核对是否为学校默认图。</Body>}
 {job&&<><Body>{({pending:'准备开始',running:'正在保存',pause_requested:'正在暂停',paused:'已暂停',partial:'部分完成',completed:'保存完成',failed:'保存中断'})[job.status]} · 本次成功 {p.success||0}/{p.total||0} 人，失败 {p.failures?.length||0} 人</Body>{!!p.message&&<Body muted>{p.message}</Body>}</>}
 {active?<Button secondary title="暂停照片保存" disabled={busy||job.status==='pause_requested'} onPress={()=>run(()=>post(API+'/photos/'+job.id+'/pause'))}/>:<><Button title={data.saved?'重新保存所带学生照片':'保存全部所带学生照片'} loading={busy} onPress={()=>run(()=>post(API+'/photos/start'))}/>{job&&['paused','partial','failed'].includes(job.status)&&<Button secondary title="继续保存并重试失败学生" disabled={busy} onPress={()=>run(()=>post(API+'/photos/start',{resumeId:job.id}))}/>}</>}
 </Card>}
 <Button secondary title="查看我的学生档案" onPress={()=>navigation.navigate('AcademicStudents')}/>
 <Button secondary title="查看教务连接" onPress={()=>navigation.navigate('AcademicAccess')}/>
 <Button secondary title="刷新照片保存进度" disabled={busy} onPress={()=>run(load)}/>
 </Page>;
}
