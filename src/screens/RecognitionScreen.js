import React,{useCallback,useEffect,useRef,useState} from 'react';
import {View,Image,PanResponder,Text} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import * as Picker from 'expo-image-picker';
import * as Manipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import {Page,Title,Body,Card,Button,ErrorBox,Pill,styles} from '../components/ui';
import {get,post} from '../utils/api';
import {cropRectangle,recognitionSearch} from '../utils/recognition';
const API='/api/recognition';
export default function RecognitionScreen({navigation}){
 const [state,S]=useState(null),[error,E]=useState(null),[busy,B]=useState(false),[image,I]=useState(null),[result,R]=useState(null),[crop,C]=useState(false),[selection,Q]=useState(null),[progress,P]=useState(null);
 const alive=useRef(false),lock=useRef(false),current=useRef(),box=useRef({width:1,height:300}),start=useRef(),selectionRef=useRef(),abort=useRef(),temp=useRef(new Set());current.current={image,crop};
 const load=async()=>{const s=await get(API+'/state');if(alive.current)S(s)};
 useFocusEffect(useCallback(()=>{alive.current=true;void load().catch(E);return()=>{alive.current=false;abort.current?.abort();R(null);I(null);B(false);P(null)}},[]));
 useEffect(()=>()=>{for(const uri of temp.current)void FileSystem.deleteAsync(uri,{idempotent:true}).catch(()=>{})},[]);
 const run=async fn=>{if(lock.current)return;lock.current=true;B(true);E(null);try{await fn()}catch(e){if(alive.current&&e.code!=='ABORTED'){E(e);if(e.code==='MULTIPLE_FACES')C(true)}}finally{lock.current=false;if(alive.current)B(false)}};
 const remember=x=>{temp.current.add(x.uri);return x};
 const choose=camera=>run(async()=>{
  const permission=camera?await Picker.requestCameraPermissionsAsync():{granted:true};if(!permission.granted)throw Error('请在系统设置中允许相机权限，或改为从相册选择。');
  const pick=await (camera?Picker.launchCameraAsync:Picker.launchImageLibraryAsync)({mediaTypes:['images'],allowsEditing:false,quality:1,exif:false});if(pick.canceled)return;
  const x=pick.assets[0],size=Math.max(x.width,x.height)>1600?{resize:x.width>=x.height?{width:1600}:{height:1600}}:null;
  const normalized=remember(await Manipulator.manipulateAsync(x.uri,size?[size]:[],{format:Manipulator.SaveFormat.JPEG,compress:0.9}));
  if(alive.current){I(normalized);R(null);Q(null);C(false);P(null)}
 });
 const pan=useRef(PanResponder.create({
  onStartShouldSetPanResponder:()=>!!current.current.crop,
  onMoveShouldSetPanResponder:()=>!!current.current.crop,
  onPanResponderGrant:e=>{start.current={x:e.nativeEvent.locationX,y:e.nativeEvent.locationY};selectionRef.current={start:start.current,end:start.current};Q(selectionRef.current)},
  onPanResponderMove:(_,g)=>{const end={x:start.current.x+g.dx,y:start.current.y+g.dy};selectionRef.current={start:start.current,end};Q(selectionRef.current)},
  onPanResponderTerminationRequest:()=>false
 })).current;
 const apply=()=>run(async()=>{const s=selectionRef.current;if(!s)throw Error('请在照片上拖动框选一个人的头部。');const rect=cropRectangle(image,box.current,s.start,s.end);if(!rect)throw Error('框选范围太小，请重新选择。');const x=remember(await Manipulator.manipulateAsync(image.uri,[{crop:rect}],{format:Manipulator.SaveFormat.JPEG,compress:0.9}));if(alive.current){I(x);C(false);Q(null);R(null)}});
 const search=()=>run(async()=>{
  R(null);P(0);const actions=Math.max(image.width,image.height)>1280?[{resize:image.width>=image.height?{width:1280}:{height:1280}}]:[];
  let x=remember(await Manipulator.manipulateAsync(image.uri,actions,{format:Manipulator.SaveFormat.JPEG,compress:0.8,base64:true}));
  if(x.base64.length>2500000)x=remember(await Manipulator.manipulateAsync(image.uri,[{resize:image.width>=image.height?{width:800}:{height:800}}],{format:Manipulator.SaveFormat.JPEG,compress:0.6,base64:true}));
  if(x.base64.length>2500000)throw Error('照片仍然过大，请先框选一人后查询。');
  const controller=new AbortController();abort.current=controller;const r=await recognitionSearch(x.base64,{signal:controller.signal,onProgress:p=>{if(alive.current)P(p)}});if(alive.current&&!controller.signal.aborted){R(r);C(false)}
 });
 return <Page><Title>拍照识人</Title><Body muted>从本人及明确共享的人员库查询候选，结果需人工核对。</Body><ErrorBox error={error}/>
 <Card><Body>当前可查 {state?.scope?.peopleCount??'—'} 人 · {state?.scope?.libraryCount??'—'} 个库</Body>{state?.setupError&&<Body muted>{state.setupError}</Body>}{state?.bridgeError&&<Body muted>{state.bridgeError}</Body>}{state&&!state.configured&&<Body muted>识人服务尚未连接，请联系维护者。其他学工功能可继续使用。</Body>}<Button secondary title="同步进度与照片授权" onPress={()=>navigation.navigate('RecognitionSync')}/><Button secondary title="刷新可查范围" disabled={busy} onPress={()=>run(load)}/></Card>
 <View style={{flexDirection:'row',gap:12}}><Button style={{flex:1}} title="拍照" icon="camera-outline" disabled={busy||!state?.configured} onPress={()=>choose(true)}/><Button style={{flex:1}} secondary title="相册选图" disabled={busy||!state?.configured} onPress={()=>choose(false)}/></View>
 {image&&<Card><View testID="recognition-crop-preview" onLayout={e=>{box.current=e.nativeEvent.layout}} style={{height:300,position:'relative',overflow:'hidden'}} {...pan.panHandlers}><Image source={{uri:image.uri}} style={{width:'100%',height:'100%'}} resizeMode="contain"/>{crop&&selection&&<View pointerEvents="none" style={{position:'absolute',left:Math.min(selection.start.x,selection.end.x),top:Math.min(selection.start.y,selection.end.y),width:Math.abs(selection.end.x-selection.start.x),height:Math.abs(selection.end.y-selection.start.y),borderWidth:2,borderColor:'#1B62A5',backgroundColor:'rgba(27,98,165,0.12)'}}/>}</View>
 {crop?<><Body muted>拖动框选一人的完整头部，留出少量边缘。</Body><Button title="使用框选区域" disabled={busy} onPress={apply}/><Button secondary title="取消框选" disabled={busy} onPress={()=>{C(false);Q(null)}}/></>:<><Button secondary title="合照框选一人" disabled={busy} onPress={()=>{C(true);Q(null);selectionRef.current=null}}/><Button title="查询这个人" loading={busy} onPress={search}/></>}
 {busy&&progress!==null&&<Body muted>{progress<100?'上传中 '+progress+'%':'照片已上传，正在查询…'}</Body>}</Card>}
 {result&&<Card><Pill tone={result.status==='candidate'?'success':result.status==='review'?'warning':'neutral'}>{({candidate:'找到候选，请核对',review:'有相近候选，需人工核对',none:'未找到匹配'})[result.status]}</Pill>{result.scopeChanged&&<Body muted>查询期间范围发生变化，结果已按当前权限核对。</Body>}{result.matches.map(p=><View key={p.id} style={{gap:8}}><Text style={styles.heading}>{p.name}</Text><Body>{p.employeeNo}　{p.department}</Body><Body muted>{p.libraryName} · 相似度评分 {p.score}</Body><Button secondary title={'查看'+p.name+'的档案'} onPress={()=>navigation.navigate('RecognitionPerson',{id:p.id})}/></View>)}<Body muted>评分不是身份正确概率。未匹配可能与光线、角度、同步进度或照片质量有关。</Body></Card>}
 </Page>;
}
