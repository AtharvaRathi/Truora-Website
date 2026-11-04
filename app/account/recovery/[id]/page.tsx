import {AccountScreen} from '@/components/account';
export const metadata={title:'Recovery package progress',robots:{index:false,follow:false}};
export default async function RecoveryPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <AccountScreen planId={id}/>}
