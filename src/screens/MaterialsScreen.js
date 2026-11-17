import React,{useState,useCallback,useRef} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Title,Body,Card,Button,Field,ErrorBox,RowLink} from '../components/ui';
import {get,post,identityContext} from '../utils/api';
import {readMemory,writeMemory} from '../utils/memoryStore';
export default function MaterialsScreen({navigation}){
 const [data,D]=useState(null),[title,T]=useState('学生辨识材料'),[counselor,C]=useState(''),[creating,V]=useState(false),[busy,B]=useState(false),[error,E]=useState(null);const alive=useRef(false),locked=useRef(false);
 const load=async()=>{const context=await identityContext(),d=await get('/api/materials');if(context!==await identityContext())throw Error('账号已切换，请重新打开项目列表');await writeMemory('','catalog','catalog',d);if(alive.current)D(d);return d};
 useFocusEffect(useCallback(()=>{alive.current=true;void (async()=>{try{const cached=await readMemory('','catalog','catalog');if(alive.current&&cached)D(cached)}catch(e){if(alive.current)E(e)}try{await load();if(alive.current)E(null)}catch(e){if(alive.current)E(e)}})();return()=>{alive.current=false}},[]));
 const create=async()=>{if(locked.current)return;locked.current=true;B(true);E(null);try{const p=await post('/api/materials/projects',{title,counselor});await load();V(false);navigation.navigate('MaterialsProject',{projectId:p.id})}catch(e){E(e)}finally{B(false);locked.current=false}};
 return <Page><Title>辨识材料与记忆</Title><Body muted>整理本人所带学生，制作辨识PPT，在这里直接背诵。</Body><ErrorBox error={error}/>
 {data?.projects.map(p=><Card key={p.id}><Title>{p.title}</Title><Body muted>辅导员：{p.counselor}</Body><Button title="开始或继续背诵" onPress={()=>navigation.navigate('StudentMemory',{projectId:p.id,accountKey:data.accountKey,title:p.title})}/><RowLink title="整理资料与生成PPT" last onPress={()=>navigation.navigate('MaterialsProject',{projectId:p.id})}/></Card>)}
 {!data?.projects.length&&<Card><Body>从学业管理中已匹配的所带名单建立项目。已有缓存照片直接使用，个人情况需核实填写或从已完成的完整版PPT导入。</Body><Button secondary title="查看所带名单与照片" onPress={()=>navigation.navigate('AcademicManage')}/></Card>}
 <Button title={creating?'收起新建项目':'新建辨识项目'} secondary onPress={()=>V(!creating)}/>
 {creating&&<Card><Field label="项目名称" value={title} onChangeText={T} maxLength={100}/><Field label="辅导员姓名" value={counselor} onChangeText={C} maxLength={80}/><Body muted>采用当前账号已匹配的全部所带学生，生成时可按班级筛选。</Body><Button title="从所带名单建立" loading={busy} disabled={!title.trim()||!counselor.trim()} onPress={create}/></Card>}
 <Body muted>已下载的记忆资料可离线使用30天。请在本人设备使用；导出的文件需要自行妥善保管。</Body>
 </Page>;
}
