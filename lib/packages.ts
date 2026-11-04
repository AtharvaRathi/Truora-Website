import data from './data/phase-one.json';
import type { CartLine } from './catalog';
export const recoveryPackages = data.packages;
export function getRecoveryPackage(slug:string){return recoveryPackages.find(p=>p.slug===slug)}
export function recommendedLines(slug:string):CartLine[]{return (getRecoveryPackage(slug)?.lines||[]).map(l=>({...l,mode:l.mode as CartLine['mode'],packageSlug:slug}))}
export const recoveryStages = [
 {id:'submitted',title:'Submitted for review',description:'Your selections are saved. A coordinator has not yet confirmed your plan.'},
 {id:'reviewed',title:'Plan reviewed',description:'The coordinator confirms the plan with your treating team’s instructions.'},
 {id:'scheduled',title:'Delivery & care scheduled',description:'Equipment delivery and the first care visits are arranged.'},
 {id:'recovering',title:'Recovery in progress',description:'Equipment and scheduled services support your recovery at home.'},
 {id:'collection',title:'Collection arranged',description:'Rental returns and any remaining care visits are coordinated.'},
 {id:'completed',title:'Package completed',description:'The agreed services and equipment returns are complete.'},
] as const;
export type RecoveryPlan={id:string;order_id:string;package_slug:string;name:string;status:string;created_at:string;updated_at:string;events:{status:string;at:string;note:string}[]};
