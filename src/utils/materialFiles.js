import {Platform} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {BASE_URL,IS_PRODUCTION_API,identity,identityContext,refreshIdentity,post} from './api';
export async function pickMaterial(projectId){
 const r=await DocumentPicker.getDocumentAsync({type:'application/vnd.openxmlformats-officedocument.presentationml.presentation',copyToCacheDirectory:true,multiple:false});if(r.canceled)return null;const f=r.assets[0];
 try{if(!f.name.toLowerCase().endsWith('.pptx')||!f.size||f.size>25*1024*1024)throw Error('请选择不超过25MiB的PPTX文件');let file;
 if(Platform.OS==='web'){const blob=f.file||await (await fetch(f.uri)).blob();file=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob)})}
 else file=await FileSystem.readAsStringAsync(f.uri,{encoding:FileSystem.EncodingType.Base64});
 return await post('/api/materials/projects/'+projectId+'/imports',{filename:f.name,file},{timeout:120000});
 }finally{if(Platform.OS!=='web'&&f.uri?.startsWith(FileSystem.cacheDirectory))await FileSystem.deleteAsync(f.uri,{idempotent:true}).catch(()=>{})}
}
const DIRECT_BASE = 'https://download.wiseliang.cloud/student-recorder';

async function directDownload(path,uri,token,onProgress){
 let timer, stopped=false;
 const task=FileSystem.createDownloadResumable(
  DIRECT_BASE+path,uri,{headers:{Authorization:'Bearer '+token}},
  progress=>{
   if(stopped)return;
   if(progress.totalBytesWritten>0)clearTimeout(timer);
   onProgress(progress);
  },
 );
 const firstByteDeadline=new Promise(resolve=>{
  timer=setTimeout(()=>{
   stopped=true;
   void task.cancelAsync().catch(()=>{});
   resolve(null);
  },10000);
 });
 try {
  const result=await Promise.race([task.downloadAsync(),firstByteDeadline]);
  return result?.status===200?result:null;
 } catch {
  return null;
 } finally {
  clearTimeout(timer);
 }
}
export async function downloadMaterial(job,onProgress=()=>{}){
 if(!/^[a-f0-9-]{36}$/.test(job.id))throw Error('材料任务编号无效');
 const path='/api/materials/jobs/'+job.id+'/download';
 const endpoint=BASE_URL+path;
 const context=await identityContext();
 const checkOwner=async()=>{
  if(await identityContext()!==context)throw Error('账号已切换，请重新打开材料项目');
 };
 const fetchWithSession=async download=>{
  let auth=await identity(), result=await download(auth.token);
  if(result?.status===401){
   await checkOwner();
   await refreshIdentity();
   await checkOwner();
   auth=await identity();
   result=await download(auth.token);
  }
  return result;
 };
 const assertDownloaded=status=>{
  if(status!==200)throw Error(status===409?'资料已更新，请重新生成':'下载失败，请检查网络后重试');
 };
 if(Platform.OS==='web'){
  const response=await fetchWithSession(token=>fetch(endpoint,{headers:{Authorization:'Bearer '+token}}));
  assertDownloaded(response.status);
  const blob=await response.blob();
  await checkOwner();
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='辨识材料.zip';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  return;
 }
 if(!await Sharing.isAvailableAsync())throw Error('此设备暂不支持系统文件分享');
 const dir=FileSystem.cacheDirectory+'material-'+job.id+'/';
 const normalUri=dir+'辨识材料.zip';
 const directDir=dir+'direct/';
 const directUri=directDir+'辨识材料.zip';
 await FileSystem.makeDirectoryAsync(dir,{intermediates:true});
 try{
  if(IS_PRODUCTION_API){
   const {token}=await identity();
   await FileSystem.makeDirectoryAsync(directDir,{intermediates:true});
   const result=await directDownload(path,directUri,token,onProgress);
   await checkOwner();
   if(result){
    await Sharing.shareAsync(directUri,{mimeType:'application/zip',dialogTitle:'保存辨识PPT'});
    return;
   }
   onProgress({totalBytesWritten:0,totalBytesExpectedToWrite:0});
  }
  const result=await fetchWithSession(token=>FileSystem.createDownloadResumable(
   endpoint,normalUri,{headers:{Authorization:'Bearer '+token}},onProgress,
  ).downloadAsync());
  assertDownloaded(result?.status);
  await checkOwner();
  await Sharing.shareAsync(normalUri,{mimeType:'application/zip',dialogTitle:'保存辨识PPT'});
 } finally {
  await FileSystem.deleteAsync(dir,{idempotent:true}).catch(()=>{});
 }
}
