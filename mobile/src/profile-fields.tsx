import {View} from 'react-native';
import type {Profile} from '../../packages/core/validation';
import {Field} from './ui';
export const blankProfile:Profile={name:'',phone:'',address:'',city:'',pincode:''};
export function ProfileFields({value,onChange}:{value:Profile;onChange:(v:Profile)=>void}){return <View style={{gap:14}}>{([['name','Full name'],['phone','Phone number'],['address','Address'],['city','City'],['pincode','PIN code']] as const).map(([key,label])=><Field key={key} label={label} value={value[key]} onChangeText={v=>onChange({...value,[key]:v})} keyboardType={key==='phone'?'phone-pad':key==='pincode'?'number-pad':'default'} multiline={key==='address'} maxLength={key==='pincode'?6:key==='address'?300:key==='phone'?20:80}/>)}</View>}
