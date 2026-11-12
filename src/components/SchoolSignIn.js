import React,{useRef,useState,useEffect} from "react";
import {Image,View} from "react-native";
import {Card,Title,Body,Button,Field,Choice,ErrorBox} from "./ui";
import {schoolSignIn} from "../utils/api";
export default function SchoolSignIn({onConnected}){
 const [studentId,S]=useState(""),[password,P]=useState(""),[code,C]=useState(""),[captcha,K]=useState(""),[remember,R]=useState(true),[data,D]=useState(null),[busy,B]=useState(false),[error,E]=useState(null);
 const alive=useRef(true),lock=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 const run=async(action,body={})=>{
  if(lock.current)return;lock.current=true;B(true);E(null);
  try{
   let r=await schoolSignIn(action,{...body,...(action!=="start"?{flowId:data?.flowId}:{})});
   if(alive.current)D(r);
   while(r.busy&&alive.current){await new Promise(resolve=>setTimeout(resolve,1500));r=await schoolSignIn("status",{flowId:r.flowId});if(alive.current)D(r)}
   if(r.connected){P("");C("");K("");onConnected()}
  }catch(e){if(alive.current)E(e)}
  finally{lock.current=false;if(alive.current)B(false)}
 };
 const challenge=["mfa","captcha","confirm_new"].includes(data?.step);
 return <Card>
  <Title>学校账号登录</Title>
  <Body muted>验证学校身份后找回原记录，换机、重装也无需记恢复码。</Body>
  <ErrorBox error={error}/>
  {data?.message&&<Body>{data.message}</Body>}
  {!challenge&&<>
   <Field label="学校账号" value={studentId} editable={!busy} onChangeText={S} placeholder="教师统一身份认证账号"/>
   <Field label="学校密码" value={password} editable={!busy} onChangeText={P} secureTextEntry/>
   <Choice label="加密保存学校账号，便于后续连接" selected={remember} disabled={busy} onPress={()=>R(!remember)}/>
   <Button title="验证学校账号并找回记录" loading={busy} disabled={!studentId.trim()||!password} onPress={()=>run("start",{studentId:studentId.trim(),password,remember})}/>
  </>}
  {data?.step==="confirm_new"&&<>
   <Button title="首次使用，创建学校账号" loading={busy} onPress={()=>run("create")}/>
   <Body muted>已有旧记录请先使用下方本机备份或联系维护者核对，避免误建空账号。</Body>
  </>}
  {data?.step==="mfa"&&<>
   <Field label="HIT APP本次验证码" value={code} onChangeText={C} keyboardType="number-pad" editable={!busy}/>
   <Button title="提交验证码并登录" loading={busy} disabled={!code.trim()} onPress={()=>run("code",{code:code.trim()})}/>
   <Button secondary title="重新获取HIT APP验证码" disabled={busy} onPress={()=>run("resend")}/>
  </>}
  {data?.step==="captcha"&&<>
   {!!data.captchaImage&&<Image source={{uri:data.captchaImage}} style={{width:240,height:90}} resizeMode="contain"/>}
   <Field label="学校图片验证码" value={captcha} onChangeText={K} editable={!busy}/>
   <Button title="提交图片验证码" loading={busy} disabled={!captcha.trim()} onPress={()=>run("captcha",{captcha:captcha.trim()})}/>
  </>}
  {challenge&&<Button secondary title="重新输入学校账号" disabled={busy} onPress={()=>{D(null);C("");K("");P("")}}/>}
 </Card>;
}
