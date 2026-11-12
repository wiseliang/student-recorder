import {Platform} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {BASE_URL,identity,refreshIdentity} from './api';
export async function downloadPhotoExport(job){
 if(!/^\/api\/academic-grades\/photo-exports\/[a-f0-9-]{36}\/download$/.test(job.downloadPath||''))throw Error('导出文件尚未就绪');
 const name='所带学生照片与名册_'+job.saved+'人.zip';
 if(Platform.OS==='web'){
  let auth=await identity(),r=await fetch(BASE_URL+job.downloadPath,{headers:{Authorization:'Bearer '+auth.token}});
  if(r.status===401){await refreshIdentity();auth=await identity();r=await fetch(BASE_URL+job.downloadPath,{headers:{Authorization:'Bearer '+auth.token}})}
  if(!r.ok)throw Error(r.status===409?'名单已变化，请重新导出':'导出文件下载失败，请刷新重试');
  const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
 }
 if(!await Sharing.isAvailableAsync())throw Error('此设备不支持系统分享，文件仍保存在服务器');
 const uri=FileSystem.cacheDirectory+name;
 try{let auth=await identity(),result=await FileSystem.downloadAsync(BASE_URL+job.downloadPath,uri,{headers:{Authorization:'Bearer '+auth.token}});
  if(result.status===401){await refreshIdentity();auth=await identity();result=await FileSystem.downloadAsync(BASE_URL+job.downloadPath,uri,{headers:{Authorization:'Bearer '+auth.token}})}
  if(result.status!==200)throw Error(result.status===409?'名单已变化，请重新导出':'导出文件下载失败，请刷新重试');
  await Sharing.shareAsync(uri,{mimeType:'application/zip',dialogTitle:'保存照片与学生名册'});
 }finally{await FileSystem.deleteAsync(uri,{idempotent:true}).catch(()=>{})}
}
