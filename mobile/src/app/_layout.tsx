import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {useFonts} from 'expo-font';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NotificationNavigation} from '../notification-navigation';
import {Provider} from '../provider';
import {Spinner} from '../ui';
export default function Layout(){const [loaded,error]=useFonts({Outfit:require('../../assets/fonts/outfit-400.ttf'),DMSans:require('../../assets/fonts/dm-sans-400.ttf')});if(!loaded&&!error)return <Spinner/>;return <SafeAreaProvider><Provider><NotificationNavigation/><StatusBar style="dark"/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:'#f8faf7'},animation:'slide_from_right'}}/></Provider></SafeAreaProvider>}
