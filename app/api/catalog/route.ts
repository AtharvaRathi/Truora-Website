import {json,apiError} from '@/lib/api';
import {catalogSnapshot} from '@/lib/catalog-server';
export const dynamic='force-dynamic';
export async function GET(){try{return json(await catalogSnapshot())}catch(e){return apiError(e)}}
