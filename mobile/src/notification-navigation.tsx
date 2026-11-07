import {useEffect} from 'react';
import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';
import {router} from 'expo-router';
export function NotificationNavigation(){useEffect(()=>{if(Platform.OS==='web')return;const open=(response:Notifications.NotificationResponse|null)=>{if(response)router.push('/notifications')};void Notifications.getLastNotificationResponseAsync().then(open);const listener=Notifications.addNotificationResponseReceivedListener(open);return()=>listener.remove()},[]);return null}
