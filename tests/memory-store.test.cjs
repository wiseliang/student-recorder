const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),babel=require('@babel/core'),crypto=require('crypto');
function setup(){const data=new Map(),keys=new Map();let openid='synthetic-owner';const exports={};const mocks={'react-native':{Platform:{OS:'web'}},'expo-crypto':{getRandomBytesAsync:async n=>new Uint8Array(crypto.randomBytes(n)),digestStringAsync:async(_,s)=>crypto.createHash('sha256').update(s).digest('hex'),CryptoDigestAlgorithm:{SHA256:'sha256'},randomUUID:crypto.randomUUID},'expo-secure-store':{},'expo-file-system':{},'./api':{BASE_URL:'https://hit-recorder.wiseliang.cloud/student-recorder',STORAGE_BASE_URL:'https://wiseliang.cloud/student-recorder',identity:async()=>({openid})}};vm.runInNewContext(babel.transformSync(fs.readFileSync(__dirname+'/../src/utils/memoryStore.js','utf8'),{configFile:false,babelrc:false,plugins:[require.resolve('@babel/plugin-transform-modules-commonjs')]}).code,{exports,require:k=>mocks[k]||require(k),sessionStorage:{getItem:k=>keys.get(k),setItem:(k,v)=>keys.set(k,v)},localStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},Uint8Array,Map,Promise,JSON,Error});return {m:exports,data,keys,changeOwner:x=>openid=x}}
test('离线资料AES-GCM加密、跨学校及App账号隔离、篡改拒读',async()=>{const{m,data,changeOwner}=setup();await m.writeMemory('school-a','project','pack',{name:'合成学生',photo:'synthetic-photo'});const raw=[...data.values()][0];assert(!raw.includes('合成学生'));assert(!raw.includes('synthetic-photo'));assert.equal((await m.readMemory('school-a','project','pack')).name,'合成学生');assert.equal(await m.readMemory('school-b','project','pack'),null);changeOwner('another-owner');assert.equal(await m.readMemory('school-a','project','pack'),null);changeOwner('synthetic-owner');const [key,value]=[...data][0],x=JSON.parse(value);x.data=(x.data[0]==='a'?'b':'a')+x.data.slice(1);data.set(key,JSON.stringify(x));await assert.rejects(()=>m.readMemory('school-a','project','pack'),/无法读取/)});
test('并发保存按顺序落盘，评级只改小状态而不重写照片包',async()=>{const{m,data}=setup();await m.writeMemory('s','p','pack',{images:['unchanged-photo']});const packEntry=[...data][0];await Promise.all([1,2,3].map(i=>m.writeMemory('s','p','state',{queue:Array.from({length:i},(_,j)=>j)})));assert.equal((await m.readMemory('s','p','state')).queue.length,3);assert.equal(data.get(packEntry[0]),packEntry[1])});
test('App的复习引擎由掌心刷题同源导出并保留新卡复习规则',()=>{const exports={};vm.runInNewContext(babel.transformSync(fs.readFileSync(__dirname+'/../src/utils/memoryCore.js','utf8'),{configFile:false,babelrc:false,plugins:[require.resolve('@babel/plugin-transform-modules-commonjs')]}).code,{exports,Math,Date,Map,Error,Object});const c={id:'card',revision:'v2',className:'合成班',kind:'name'};assert.equal(exports.selectMemoryCards([c],{dueOnly:true},{card:{revision:'v1',due:9e15}}).length,1);assert.equal(exports.restoreMemoryRound({ids:['card'],currentId:'card',revealed:true,revisions:{card:'v1'}},[c]).revealed,false);assert.equal(exports.memoryDue('known',0),604800000)});

test("清除照片卡片保留未同步评级队列",async()=>{const{m}=setup();await m.writeMemory("s","p","pack",{images:["photo"]});await m.writeMemory("s","p","state",{queue:["unsynced"]});await m.clearMemoryPack("s","p");assert.equal(await m.readMemory("s","p","pack"),null);assert.equal((await m.readMemory("s","p","state")).queue[0],"unsynced")});

test('reads the old encrypted hex format without relying on TextEncoder in the App',async()=>{
 const encoded={name:'合成学生 🧑'};
 const expected=Buffer.from(JSON.stringify(encoded),'utf8');
 const oldKey=crypto.randomBytes(32),iv=crypto.randomBytes(12);
 const aad='https://wiseliang.cloud/student-recorder|synthetic-owner|old-school|project|pack';
 const cipher=crypto.createCipheriv('aes-256-gcm',oldKey,iv);
 cipher.setAAD(Buffer.from(aad,'utf8'));
 const raw=Buffer.concat([cipher.update(expected),cipher.final(),cipher.getAuthTag()]);
 const bytes=crypto.createHash('sha256').update(aad).digest('hex');
 const instance=setup();
 instance.keys.set('student.memory.key.v1',oldKey.toString('hex'));
 instance.data.set('memory.'+bytes,JSON.stringify({iv:iv.toString('hex'),data:raw.toString('hex')}));
 assert.equal((await instance.m.readMemory('old-school','project','pack')).name,encoded.name);
});
