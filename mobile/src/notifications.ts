import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import {AndroidImportance} from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import {request} from './backend';
import AsyncStorage from '@react-native-async-storage/async-storage';
Notifications.setNotificationHandler({handleNotification:async()=>({shouldPlaySound:false,shouldSetBadge:false,shouldShowBanner:true,shouldShowList:true})});
export async function enablePush(){
 if(Platform.OS==='web'||!Device.isDevice)throw new Error('Push notifications require an Android or iOS build on a physical device.');
 const projectId=Constants.easConfig?.projectId||Constants.expoConfig?.extra?.eas?.projectId;if(!projectId)throw new Error('Link the app to Expo and create a device build before enabling push notifications.');
 if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('updates',{name:'Truora updates',importance:AndroidImportance.DEFAULT});
 let permission=await Notifications.getPermissionsAsync();if(permission.status!=='granted')permission=await Notifications.requestPermissionsAsync();if(permission.status!=='granted')throw new Error('Notifications were not enabled. You can change this in device settings.');
 const {data:token}=await Notifications.getExpoPushTokenAsync({projectId});await request('notifications/device',{token,platform:Platform.OS});await AsyncStorage.setItem('truora:push-token',token);return token;
}
export async function disablePush(){const token=await AsyncStorage.getItem('truora:push-token');if(token&&Platform.OS!=='web')await request('notifications/device',{token,platform:Platform.OS,remove:true});await AsyncStorage.removeItem('truora:push-token')}
