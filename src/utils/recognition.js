import {BASE_URL,identity,refreshIdentity,ApiError} from './api';
export function cropRectangle(image,box,start,end){
 const scale=Math.min(box.width/image.width,box.height/image.height),w=image.width*scale,h=image.height*scale,left=(box.width-w)/2,top=(box.height-h)/2;
 const clamp=(v,max)=>Math.max(0,Math.min(max,v));
 const x1=clamp((Math.min(start.x,end.x)-left)/scale,image.width),x2=clamp((Math.max(start.x,end.x)-left)/scale,image.width),y1=clamp((Math.min(start.y,end.y)-top)/scale,image.height),y2=clamp((Math.max(start.y,end.y)-top)/scale,image.height);
 if(!Number.isFinite(scale)||scale<=0||x2-x1<20||y2-y1<20)return null;
 const originX=Math.floor(x1),originY=Math.floor(y1);return {originX,originY,width:Math.min(image.width-originX,Math.floor(x2-x1)),height:Math.min(image.height-originY,Math.floor(y2-y1))};
}
export async function recognitionSearch(image,{onProgress=()=>{},signal}={}){
 const initial=await identity();
 for(let attempt=0;attempt<2;attempt++){
  const auth=await identity();if(auth.openid!==initial.openid)throw new ApiError('账号已变化，请重新查询',409,'IDENTITY_CHANGED');
  const result=await new Promise((resolve,reject)=>{
   const xhr=new XMLHttpRequest(),abort=()=>xhr.abort(),finish=(fn,value)=>{signal?.removeEventListener('abort',abort);fn(value)};
   xhr.open('POST',BASE_URL+'/api/recognition/search');xhr.timeout=120000;xhr.setRequestHeader('Content-Type','application/json');xhr.setRequestHeader('Authorization','Bearer '+auth.token);
   xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100))};
   xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText)}catch{return finish(reject,new ApiError('服务响应无效',502,'INVALID_RESPONSE'))}finish(resolve,{status:xhr.status,data})};
   xhr.onerror=()=>finish(reject,new ApiError('网络连接失败，请重新查询',0,'NETWORK_ERROR'));xhr.ontimeout=()=>finish(reject,new ApiError('查询超时，请重试',0,'TIMEOUT'));xhr.onabort=()=>finish(reject,new ApiError('查询已取消',0,'ABORTED'));
   signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){finish(reject,new ApiError('查询已取消',0,'ABORTED'));return;}xhr.send(JSON.stringify({image}));
  });
  if((await identity()).openid!==initial.openid)throw new ApiError('账号已变化，请重新查询',409,'IDENTITY_CHANGED');
  if(result.status===401&&result.data.code==='AUTH_REQUIRED'&&attempt===0){await refreshIdentity();continue;}
  if(result.status>=400)throw new ApiError(result.data.error||'查询失败',result.status,result.data.code||'SEARCH_FAILED');return result.data;
 }
}
