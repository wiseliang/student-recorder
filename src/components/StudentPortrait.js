import React,{useEffect,useState} from 'react';
import {Image,View,Text} from 'react-native';
import {get} from '../utils/api';
export default function StudentPortrait({studentId,refresh=0,width=60,height=80}){
 const [image,I]=useState(null);
 useEffect(()=>{let alive=true;I(null);get('/api/academic-grades/photos/student',{studentId}).then(r=>{if(alive)I(r.available?r.imageData:null)}).catch(()=>{});return()=>{alive=false}},[studentId,refresh]);
 return image?<Image accessibilityLabel="学生档案照片，供人工核对" source={{uri:image}} style={{width,height,borderRadius:5,backgroundColor:'#E3EFFA'}} resizeMode="contain"/>:<View style={{width,height,borderRadius:5,backgroundColor:'#E3EFFA',alignItems:'center',justifyContent:'center',padding:4}}><Text style={{fontSize:11,color:'#60758B',textAlign:'center'}}>照片待保存</Text></View>;
}
