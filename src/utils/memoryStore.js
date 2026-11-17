import {Platform} from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import {gcm} from '@noble/ciphers/aes';
import {bytesToHex,hexToBytes,utf8ToBytes,bytesToUtf8} from '@noble/ciphers/utils';
import {identity,BASE_URL} from './api';
const KEY='student.memory.key.v1';let keyFlight;const writes=new Map();
async function deviceKey(){
 if(!keyFlight)keyFlight=(async()=>{let value=Platform.OS==='web'?sessionStorage.getItem(KEY):await SecureStore.getItemAsync(KEY);if(!value){value=bytesToHex(await Crypto.getRandomBytesAsync(32));if(Platform.OS==='web')sessionStorage.setItem(KEY,value);else await SecureStore.setItemAsync(KEY,value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY})}return hexToBytes(value)})();
 return keyFlight;
}
async function scope(accountKey,projectId,type){const {openid}=await identity();if(!openid)throw Error('请先登录学工账号');const aad=[BASE_URL,openid,accountKey||'',projectId||'',type].join('|');const name=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,aad);return {aad,name};}
async function writeFile(name,text){if(Platform.OS==='web'){localStorage.setItem('memory.'+name,text);return}const dir=FileSystem.documentDirectory+'private-memory/';await FileSystem.makeDirectoryAsync(dir,{intermediates:true});const file=dir+name+'.json',tmp=file+'.tmp';await FileSystem.writeAsStringAsync(tmp,text);await FileSystem.moveAsync({from:tmp,to:file});}
async function readFile(name){if(Platform.OS==='web')return localStorage.getItem('memory.'+name);try{return await FileSystem.readAsStringAsync(FileSystem.documentDirectory+'private-memory/'+name+'.json')}catch{return null}}
export async function readMemory(accountKey,projectId,type){const {aad,name}=await scope(accountKey,projectId,type);await writes.get(name)?.catch(()=>{});const raw=await readFile(name);if(!raw)return null;try{const {iv,data}=JSON.parse(raw),key=await deviceKey();return JSON.parse(bytesToUtf8(gcm(key,hexToBytes(iv),utf8ToBytes(aad)).decrypt(hexToBytes(data))))}catch{throw Error('本机加密资料无法读取，请联网重新同步；不会使用其他账号的缓存')}}
export async function writeMemory(accountKey,projectId,type,value){const {aad,name}=await scope(accountKey,projectId,type),plain=JSON.stringify(value);const task=(writes.get(name)||Promise.resolve()).catch(()=>{}).then(async()=>{const key=await deviceKey(),iv=await Crypto.getRandomBytesAsync(12);await writeFile(name,JSON.stringify({iv:bytesToHex(iv),data:bytesToHex(gcm(key,iv,utf8ToBytes(aad)).encrypt(utf8ToBytes(plain)))}))});writes.set(name,task);try{await task}catch{throw Error('本机保存失败，请检查存储空间后重试')}finally{if(writes.get(name)===task)writes.delete(name)}}
export const eventId=()=>Crypto.randomUUID();
