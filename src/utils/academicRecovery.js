// Pending operations live in memory only and are tied to the current account epoch.
export function createAcademicRecovery({restore,getContext,timeoutMs=300000}){
 let listener=null,flight=null,gate=null,generation=0,chain=Promise.resolve();
 const error=(message,code='ACADEMIC_AUTH_CANCELLED')=>Object.assign(new Error(message),{status:409,code});
 const notify=event=>listener?.(event);
 function cancel(message='已取消教务验证，已保存成绩仍可查看'){
  generation++;flight=null;const current=gate;gate=null;if(current){clearTimeout(current.timer);current.reject(error(message))}notify({phase:'idle'});
 }
 function complete(){const current=gate;gate=null;if(current){clearTimeout(current.timer);current.resolve()}notify({phase:'idle'})}
 async function recover(action){
  const context=await getContext(),version=generation;
  const check=async()=>{if(version!==generation||await getContext()!==context)throw error('账号或操作已变化，请重新发起查询','IDENTITY_CHANGED')};
  let connected=false;
  try{
   if(!gate){
    if(!flight||flight.context!==context){notify({phase:'restoring',message:'正在恢复教务连接，已保存成绩仍可查看'});const promise=restore();const current={context,promise};flight=current;promise.finally(()=>{if(flight===current)flight=null}).catch(()=>{})}
    connected=!!(await flight.promise).connected;await check();
   }
   if(!connected){
    let pending=gate;
    if(!pending){
     if(!listener)throw error('请到教务连接完成验证','ACADEMIC_AUTH_REQUIRED');
     let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});pending={context,promise,resolve,reject};gate=pending;pending.timer=setTimeout(()=>cancel('教务验证等待超时，可重新发起更新'),timeoutMs);notify({phase:'verification',message:'学校需要验证，完成后将继续本次查询或更新'});
    }
    if(pending.context!==context)throw error('账号已变化','IDENTITY_CHANGED');await pending.promise;await check();
   }
   const invoke=async()=>{await check();return action()};const result=chain.then(invoke,invoke);chain=result.catch(()=>{});notify({phase:'idle'});return await result;
  }catch(e){notify({phase:'idle'});throw e}
 }
 return {recover,cancel,complete,subscribe(fn){listener=fn;return()=>{if(listener===fn)listener=null}},isPending:()=>!!gate};
}
