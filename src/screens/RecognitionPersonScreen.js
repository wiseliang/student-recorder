import React,{useCallback,useRef,useState} from 'react';
import {Image} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Title,Body,Card,Button,ErrorBox} from '../components/ui';
import {get} from '../utils/api';
export default function RecognitionPersonScreen({route,navigation}){
 const [data,D]=useState(null),[images,I]=useState([]),[error,E]=useState(null);const alive=useRef(false),id=route.params.id;
 useFocusEffect(useCallback(()=>{alive.current=true;D(null);I([]);E(null);void(async()=>{const p=await get('/api/recognition/people/'+encodeURIComponent(id));if(!alive.current)return;D(p);const pics=[];for(const x of p.photos||[]){const image=await get('/api/recognition/people/'+encodeURIComponent(id)+'/photo-data',{photoId:x.id});pics.push(image.imageData);}if(alive.current)I(pics)})().catch(e=>{if(alive.current){D(null);I([]);E(e)}});return()=>{alive.current=false;D(null);I([])}},[id]));
 return <Page><Title>{data?.name||'人员档案'}</Title><ErrorBox error={error}/>{data&&<><Body muted>{data.libraryName} · {data.moduleName}</Body><Card>{images.map((uri,i)=><Image key={i} source={{uri}} resizeMode="contain" style={{height:220,width:'100%'}}/>)}{data.fields.map(f=><Body key={f.key}>{f.label}：{({name:data.name,employeeNo:data.employeeNo,department:data.department,title:data.title,...data.details})[f.key]||'未填写'}</Body>)}</Card>{data.academic&&<Button title="查看学业档案" onPress={()=>navigation.navigate('AcademicStudent',data.academic)}/>}<Body muted>候选需人工核对，资料与照片按当前账号权限提供。</Body></>}</Page>;
}
