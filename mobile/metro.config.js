const {getDefaultConfig}=require('expo/metro-config');
const path=require('path');
const config=getDefaultConfig(__dirname);
config.watchFolders=[path.resolve(__dirname,'..','packages')];
config.resolver.nodeModulesPaths=[path.resolve(__dirname,'node_modules')];
// Shared files must use this app's React and Zod, never the website's React.
config.resolver.extraNodeModules={react:path.resolve(__dirname,'node_modules/react'),zod:path.resolve(__dirname,'node_modules/zod')};
module.exports=config;
