const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const babel=require('@babel/core')
const source=fs.readFileSync(path.join(__dirname,'../src/App.js'),'utf8')
const start=source.indexOf('  const initOpenid = async () => {')
const init=source.slice(start,source.indexOf('\n  if (ready && initError)',start)).replace('const initOpenid','globalThis.initOpenid')
async function run(post,storage={}) {
  const state={ready:null,error:null,values:null}
  const context={post,BASE_URL:'https://example.invalid',AsyncStorage:{multiSet:async values=>{state.values=values},...storage},setReady:v=>state.ready=v,setInitError:v=>state.error=v}
  vm.createContext(context);vm.runInContext(init,context);await context.initOpenid()
  return state
}
test('successful initial login persists signed session and exits splash',async()=>{
  const result=await run(async(path,body)=>{
    assert.equal(path,'/api/auth/login');assert.equal(body.platform,'android')
    return {openid:'android_test',token:'signed-session'}
  })
  assert.equal(result.ready,true);assert.equal(result.error,'')
  assert.equal(result.values[0][1],'android_test');assert.equal(result.values[1][1],'signed-session')
})
test('network, invalid response and storage errors end splash with recoverable failure',async()=>{
  for(const action of [()=>{throw Error('network')},()=>({openid:'legacy'}),()=>({})]) {
    const result=await run(action)
    assert.equal(result.ready,true);assert.ok(result.error);assert.equal(result.values,null)
  }
  const result=await run(()=>({openid:'android_test',token:'token'}),{multiSet:()=>{throw Error('storage')}})
  assert.equal(result.ready,true);assert.equal(result.error,'storage')
})
test('API exports address and sends bearer token with requests',async()=>{
  const input=fs.readFileSync(path.join(__dirname,'../src/utils/api.js'),'utf8')
  const transformed=babel.transformSync(input,{filename:'api.js',configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code
  const exports={};let sent
  const context={exports,require:()=>({getItem:async key=>key==='openid'?'android_test':key==='authServer'?'https://example.invalid':'signed-session'}),process:{env:{EXPO_PUBLIC_API_BASE_URL:'https://example.invalid'}},setTimeout,clearTimeout,AbortController,URLSearchParams,fetch:async(url,options)=>{sent={url,options};return {ok:true,json:async()=>({success:true})}}}
  vm.runInNewContext(transformed,context)
  assert.equal(exports.BASE_URL,'https://example.invalid')
  await exports.post('/api/auth/login',{platform:'android'})
  assert.equal(sent.url,'https://example.invalid/api/auth/login')
  assert.equal(sent.options.headers.Authorization,'Bearer signed-session')
  assert.equal(sent.options.headers['x-openid'],'android_test')
})
