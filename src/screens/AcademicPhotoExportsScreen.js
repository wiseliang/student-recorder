import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Title,Body,Card,Button,ErrorBox,styles} from '../components/ui';
import {get,post} from '../utils/api';
import {downloadPhotoExport} from '../utils/photoExportDownload';
import {dateLabel} from './AcademicGradesScreen';
const API='/api/academic-grades',active=['pending','downloading','writing','pause_requested'],resumable=['awaiting_auth','paused','partial','failed'];
const labels={pending:'准备导出',downloading:'正在保存缺少的照片',writing:'正在生成名册与压缩包',pause_requested:'正在暂停',awaiting_auth:'等待教务连接',paused:'已暂停',partial:'部分完成',failed:'导出中断',completed:'导出完成'};
export default function AcademicPhotoExportsScreen({navigation,route}){
 const [data,D]=useState(null),[busy,B]=useState(false),[error,E]=useState(null);const alive=useRef(false),lock=useRef(false),started=useRef(null),autoResume=useRef('');
 const load=async()=>{const d=await get(API+'/photo-exports');if(alive.current)D(d);return d};
 const run=async fn=>{if(lock.current)return;lock.current=true;B(true);E(null);try{await fn();await load()}catch(e){if(alive.current)E(e)}finally{lock.current=false;B(false)}};
 useFocusEffect(useCallback(()=>{alive.current=true;void (async()=>{const d=await load(),job=d.jobs[0];
  if(route.params?.autoStart&&started.current!==route.params?.requestId){started.current=route.params?.requestId;await run(async()=>{if(!job||!active.includes(job.status))await post(API+'/photo-exports/start',job&&resumable.includes(job.status)?{resumeId:job.id}:{})})}
  else if(job?.status==='awaiting_auth'&&d.connection.connected&&!d.connection.busy&&autoResume.current!==job.id){autoResume.current=job.id;await run(()=>post(API+'/photo-exports/start',{resumeId:job.id}))}
 })().catch(E);return()=>{alive.current=false}},[route.params?.requestId]));
 const working=data?.jobs.some(j=>active.includes(j.status));
 useEffect(()=>{if(!working)return;let polling=false;const timer=setInterval(async()=>{if(!alive.current||polling||lock.current)return;polling=true;try{await load()}catch(e){if(alive.current)E(e)}finally{polling=false}},2000);return()=>clearInterval(timer)},[working]);
 return <Page><Title>照片导出到服务器</Title><Body muted>仅导出当前所带学生。已有照片直接使用，缺少的照片会从教务获取。</Body><ErrorBox error={error}/>
 <Card><Text style={styles.heading}>新版学生模板 · 八列</Text><Body>姓名、学号、班级、年级、学校、专业、班号、照片文件名。</Body><Body muted>学号和班号按文本保存；专业、班号选填。照片按学号命名，每人支持1～3张，多张用分号分隔。当前教务来源每人一张。</Body><Button title="一键导出到服务器" loading={busy} disabled={working} onPress={()=>run(()=>post(API+'/photo-exports/start'))}/></Card>
 {data?.jobs.map((job,index)=><Card key={job.id}><Text style={styles.heading}>{index===0?'最近导出':'历史导出'} · {labels[job.status]}</Text><Body>已有有效照片 {job.saved}/{job.total} 人 · 尚缺 {job.missing} 人</Body><Body muted>{dateLabel(job.createdAt)}</Body>{!!job.message&&<Body muted>{job.message}</Body>}
  {job.folder&&<View style={{gap:5}}><Body>服务器保存位置</Body><Text selectable accessibilityLabel="服务器保存位置" style={styles.muted}>{job.folder}</Text></View>}
  {active.includes(job.status)&&<Button secondary title="暂停导出" disabled={busy||job.status==='pause_requested'} onPress={()=>run(()=>post(API+'/photo-exports/'+job.id+'/pause'))}/>}
  {job.status==='awaiting_auth'&&<Button title="连接教务后继续导出" disabled={busy} onPress={()=>{autoResume.current='';navigation.navigate('AcademicAccess',{returnTo:'AcademicPhotoExports'})}}/>}
  {resumable.includes(job.status)&&<Button secondary title={job.status==='partial'?'重试缺失照片并生成完整名册':'继续上次导出'} disabled={busy||working} onPress={()=>run(()=>post(API+'/photo-exports/start',{resumeId:job.id}))}/>}
  {job.ready&&<Button secondary title="下载照片与名册压缩包" disabled={busy} onPress={()=>run(()=>downloadPhotoExport(job))}/>}
 </Card>)}
 {!data?.jobs.length&&<Body muted>导出后会显示文件位置和进度；照片文件夹与名册通过“照片文件名”逐一对应。</Body>}
 <Button secondary title="刷新导出进度" disabled={busy} onPress={()=>run(load)}/>
 </Page>;
}
