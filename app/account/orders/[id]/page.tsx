import { AccountScreen } from '@/components/account';
export const metadata={title:'Order details',robots:{index:false,follow:false}};
export default async function Order({params}:{params:Promise<{id:string}>}){return <AccountScreen orderId={(await params).id}/>}
