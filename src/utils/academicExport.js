import {Platform} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
export async function shareAcademicExport(result){
 if(Platform.OS==='web'){const blob=new Blob([result.content],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=result.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return}
 if(!await Sharing.isAvailableAsync())throw Error('当前设备不支持文件分享');
 const uri=FileSystem.cacheDirectory+result.filename;
 try{await FileSystem.writeAsStringAsync(uri,result.content,{encoding:FileSystem.EncodingType.UTF8});await Sharing.shareAsync(uri,{mimeType:'text/csv',dialogTitle:'导出学业核对名单',UTI:'public.comma-separated-values-text'})}
 finally{await FileSystem.deleteAsync(uri,{idempotent:true}).catch(()=>{})}
}
