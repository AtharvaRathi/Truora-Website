import type {ConfigContext,ExpoConfig} from 'expo/config';
export default ({config}:ConfigContext):ExpoConfig=>({
 ...config,name:'Truora',slug:'truora',scheme:'truora',version:'1.0.0',orientation:'portrait',userInterfaceStyle:'light',icon:'./assets/icon.png',
 ios:{supportsTablet:true,bundleIdentifier:'com.truora.recovery',infoPlist:{ITSAppUsesNonExemptEncryption:false}},
 android:{package:'com.truora.recovery',permissions:['POST_NOTIFICATIONS'],adaptiveIcon:{foregroundImage:'./assets/icon.png',backgroundColor:'#123d42'}},
 web:{bundler:'metro',output:'single',favicon:'./assets/icon.png'},
 plugins:['expo-router','expo-secure-store','expo-font',['expo-splash-screen',{backgroundColor:'#123d42',image:'./assets/logo.png',imageWidth:220}],['expo-notifications',{color:'#123d42'}]],
 runtimeVersion:{policy:'fingerprint'},
 ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID?{updates:{url:`https://u.expo.dev/${process.env.EXPO_PUBLIC_EAS_PROJECT_ID}`},extra:{eas:{projectId:process.env.EXPO_PUBLIC_EAS_PROJECT_ID}}}:{}),
});
