import React,{useCallback,useState} from 'react';
import {View,Text} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {onAcademicRecovery} from '../utils/api';
export default function AcademicRecoveryBoundary({navigation,route,children}){
 const [message,M]=useState('');
 useFocusEffect(useCallback(()=>{const off=onAcademicRecovery(event=>{M(event.phase==='restoring'?event.message:'');if(event.phase==='verification'&&route.name!=='AcademicAccess')navigation.navigate('AcademicAccess',{recover:true})});return()=>{off();M('')}},[navigation,route.name]));
 return <View style={{flex:1}}>{!!message&&<View accessibilityRole="alert" style={{padding:12,backgroundColor:'#E3EFFA'}}><Text style={{color:'#16314F'}}>{message}</Text></View>}{children}</View>;
}
