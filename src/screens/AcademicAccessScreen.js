import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Image} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {get,post,completeAcademicRecovery,cancelAcademicRecovery,hasAcademicRecovery} from '../utils/api';
import {useSchool} from '../state/SchoolContext';
import {Page,Title,Body,Card,Button,Field,ErrorBox} from '../components/ui';
export default function AcademicAccessScreen({navigation,route}){
 const [data,D]=useState(null),[device,T]=useState(null),[code,C]=useState(''),[error,E]=useState(null),[busy,B]=useState(false),[forget,F]=useState(false);
 const alive=useRef(false),completed=useRef(false),lock=useRef(false);const school=useSchool();
 const finish=()=>{if(completed.current)return;completed.current=true;if(navigation.canGoBack())navigation.goBack();else navigation.navigate('AcademicGrades');setTimeout(()=>completeAcademicRecovery(),100)};
 useEffect(()=>{if(data?.connected&&hasAcademicRecovery())finish()},[data?.connected]);
 useFocusEffect(useCallback(()=>{
  alive.current=true;completed.current=false;let timer,tried=false;
  const poll=async()=>{try{
   let r=await get('/api/academic-access/status');
   if(!tried&&!r.connected&&!r.busy&&!['code','captcha'].includes(r.step)){tried=true;r=await post('/api/academic-access/restore')}
   if(alive.current){D(r);if(r.busy)timer=setTimeout(poll,1500)}
  }catch(e){if(alive.current)E(e)}};
  void poll();void get('/api/academic-access/device-state').then(r=>{if(alive.current)T(r)}).catch(()=>{});
  return()=>{alive.current=false;clearTimeout(timer);if(!completed.current&&hasAcademicRecovery())cancelAcademicRecovery()};
 },[]));
 const run=async(path,body={})=>{if(lock.current)return;lock.current=true;B(true);E(null);try{
  let r=await post('/api/academic-access/'+path,body);if(alive.current)D(r);
  while(r.busy&&alive.current){await new Promise(resolve=>setTimeout(resolve,1500));r=await get('/api/academic-access/status');if(alive.current)D(r)}
  if(path==='forget-device'){T({saved:false});F(false);await school.refresh().catch(()=>{})}
  else if(r.connected){const saved=await get('/api/academic-access/device-state').catch(()=>null);if(alive.current)T(saved)}
  C('');
 }catch(e){if(alive.current)E(e)}finally{lock.current=false;if(alive.current)B(false)}};
 const cancel=()=>{completed.current=true;cancelAcademicRecovery();if(navigation.canGoBack())navigation.goBack();else navigation.navigate('AcademicGrades')};
 return <Page><Title>教务连接</Title><Body muted>优先恢复已保存的登录状态。学校要求验证时，再获取本次HIT APP验证码；已保存成绩仍可查看。</Body><ErrorBox error={error}/>
 <Card><Body>{data?.message||(data?.busy?'正在恢复教务连接…':'正在检查教务连接…')}</Body>
 {data?.connected&&<Body>教务连接已恢复。</Body>}
 {data?.captchaImage&&<Image source={{uri:data.captchaImage}} style={{width:220,height:80}} resizeMode="contain"/>}
 {['code','captcha'].includes(data?.step)&&<>
  {data.step==='code'&&!data.codeRequested&&<Body muted>尚未主动获取验证码，请点击下方按钮后查看HIT APP。</Body>}
  {data.step==='code'&&<Button secondary title={data.codeRequested?'重新获取HIT APP验证码':'获取HIT APP验证码'} disabled={busy||data.busy} onPress={()=>run('request-code')}/>}
  <Field label={data.step==='captcha'?'学校图片验证码':'HIT APP 本次验证码'} value={code} onChangeText={C} keyboardType={data.step==='captcha'?'default':'number-pad'}/>
  <Button title="提交验证码并继续" disabled={!code.trim()||busy||data.busy} loading={busy} onPress={()=>run('code',{code})}/>
 </>}
 {data?.connected&&<Button title={hasAcademicRecovery()?'返回并继续原操作':'返回学业页面'} onPress={finish}/>}
 {!data?.connected&&<Button title="尝试恢复教务连接" disabled={busy||data?.busy} loading={busy||data?.busy} onPress={()=>run('restore')}/>}
 {!data?.connected&&<Button secondary title="检查或更新学校账号" disabled={busy} onPress={()=>navigation.navigate("SchoolLogin")}/>}
 <Button secondary title="返回查看已保存成绩" disabled={busy} onPress={cancel}/>
 {data?.connected&&<Button secondary title="断开教务连接（保留长期登录信息）" disabled={busy} onPress={()=>run('release')}/>}
 </Card>
 <Card><Body>长期登录信息</Body><Body muted>{device?.saved?'已保存学校允许保留的浏览器登录信息，短期教务连接失效后仍可尝试恢复。':'尚无可用的长期登录信息，成功完成学校验证后会按实际凭据保存。'}</Body>
 {device?.trustSelectedAt&&<Body muted>曾选择学校的信任设备选项；是否仍可免验以学校当前返回结果为准。</Body>}
 <Button secondary title="清除长期登录信息…" disabled={busy||data?.busy} onPress={()=>F(!forget)}/>
 {forget&&<><Body>将清除该账号的长期登录信息，并断开所有设备共用的学校及教务连接。已保存成绩和照片保留；正在处理的任务须先暂停。</Body><Button danger title="确认清除长期登录信息" disabled={busy} onPress={()=>run('forget-device')}/><Button secondary title="保留登录信息" onPress={()=>F(false)}/></>}
 </Card></Page>;
}
