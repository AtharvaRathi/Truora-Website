import 'server-only';
import {backendMode,supabase} from './backend';
import data from '@/packages/core/data/phase-one.json';
export async function catalogSnapshot(){
 if(backendMode()==='local')return data;
 const {data:result,error}=await (await supabase()).rpc('catalog_snapshot');
 if(error||!result)throw new Error('Published catalog unavailable');return result;
}
