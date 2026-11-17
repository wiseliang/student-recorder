import {Platform} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {BASE_URL,identity,refreshIdentity,post} from './api';
export async function pickMaterial(projectId){
 const r=await DocumentPicker.getDocumentAsync({type:'application/vnd.openxmlformats-officedocument.presentationml.presentation',copyToCacheDirectory:true,multiple:false});if(r.canceled)return null;const f=r.assets[0];
 try{if(!f.name.toLowerCase().endsWith('.pptx')||!f.size||f.size>25*1024*1024)throw Error('请选择不超过25MiB的PPTX文件');let file;
 if(Platform.OS==='web'){const blob=f.file||await (await fetch(f.uri)).blob();file=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob)})}
 else file=await FileSystem.readAsStringAsync(f.uri,{encoding:FileSystem.EncodingType.Base64});
 return await post('/api/materials/projects/'+projectId+'/imports',{filename:f.name,file},{timeout:120000});
 }finally{if(Platform.OS!=='web'&&f.uri?.startsWith(FileSystem.cacheDirectory))await FileSystem.deleteAsync(f.uri,{idempotent:true}).catch(()=>{})}
}
export async function downloadMaterial(job){
 if(!/^[a-f0-9-]{36}$/.test(job.id))throw Error('材料任务编号无效');const path='/api/materials/jobs/'+job.id+'/download',name='辨识材料.zip';let auth=await identity();
 if(Platform.OS==='web'){let r=await fetch(BASE_URL+path,{headers:{Authorization:'Bearer '+auth.token}});if(r.status===401){await refreshIdentity();auth=await identity();r=await fetch(BASE_URL+path,{headers:{Authorization:'Bearer '+auth.token}})}if(!r.ok)throw Error(r.status===409?'资料已更新，请重新生成':'下载失败，请刷新重试');const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return}
 if(!await Sharing.isAvailableAsync())throw Error('此设备暂不支持系统文件分享');const uri=FileSystem.cacheDirectory+name;
 try{let r=await FileSystem.downloadAsync(BASE_URL+path,uri,{headers:{Authorization:'Bearer '+auth.token}});if(r.status===401){await refreshIdentity();auth=await identity();r=await FileSystem.downloadAsync(BASE_URL+path,uri,{headers:{Authorization:'Bearer '+auth.token}})}if(r.status!==200)throw Error(r.status===409?'资料已更新，请重新生成':'下载失败，请刷新重试');await Sharing.shareAsync(uri,{mimeType:'application/zip',dialogTitle:'保存辨识PPT'})}finally{await FileSystem.deleteAsync(uri,{idempotent:true}).catch(()=>{})}
}
