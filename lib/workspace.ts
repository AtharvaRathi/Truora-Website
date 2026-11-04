import { z } from 'zod';
import type { Order, Profile, ServiceRequest } from './validation';
import type { RecoveryPlan } from './packages';
export const roleNames={admin:'Administrator',manager:'Manager',staff:'Operations staff',provider:'Care provider'};
export const specialties=['physiotherapist','nurse','caregiver','dietitian','doctor','other'] as const;
export const taskStatuses=['scheduled','accepted','in_progress','completed','cancelled'] as const;
export const orderStatuses=['demo_submitted','reviewed','preparing','dispatched','completed','cancelled'] as const;
export const requestStatuses=['demo_submitted','contacted','in_progress','resolved','cancelled'] as const;
export type TeamMember={user_id:string;role:keyof typeof roleNames;specialty:string;active:boolean;name:string;email?:string};
export type Customer=Profile&{id:string;email:string;created_at:string};
export type CareTask={id:string;customer_id:string;plan_id:string|null;order_id:string|null;request_id:string|null;service_id:string;provider_id:string;title:string;starts_at:string;duration_minutes:number;status:typeof taskStatuses[number];instructions:string;completion_note:string;version:number;created_at:string;customer:Profile;provider_name:string};
export type CustomerVisit=Pick<CareTask,'id'|'title'|'starts_at'|'duration_minutes'|'status'|'plan_id'|'provider_name'>;
export type WorkNote={id:string;entity_type:string;entity_id:string;body:string;created_at:string;author_name:string};
export type AuditEntry={id:string;action:string;entity_type:string;entity_id:string;created_at:string;actor_name:string;details:Record<string,unknown>};
export type WorkspaceData={member:TeamMember;customers:Customer[];orders:(Order&{user_id:string})[];plans:(RecoveryPlan&{user_id:string})[];requests:(ServiceRequest&{user_id:string})[];tasks:CareTask[];team:TeamMember[];notes:WorkNote[];audit:AuditEntry[];counts:{customers:number;orders:number;activePlans:number;openRequests:number;upcomingTasks:number}};
const id=z.string().uuid();
export const workspaceActionSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('recovery_status'),id,status:z.enum(['submitted','reviewed','scheduled','recovering','collection','completed','cancelled']),expected:z.string().max(30)}).strict(),
 z.object({action:z.literal('order_status'),id,status:z.enum(orderStatuses),expected:z.string().max(30)}).strict(),
 z.object({action:z.literal('request_status'),id,status:z.enum(requestStatuses),expected:z.string().max(30)}).strict(),
 z.object({action:z.literal('note'),entityType:z.enum(['customer','order','recovery','request']),id,body:z.string().trim().min(2).max(2000)}).strict(),
 z.object({action:z.literal('task_create'),customerId:id,planId:id.nullable(),orderId:id.nullable().optional(),requestId:id.nullable(),serviceId:z.string().min(1).max(100),providerId:id,startsAt:z.iso.datetime({offset:true}),duration:z.number().int().min(15).max(720),instructions:z.string().trim().max(1000),requestKey:id}).strict(),
 z.object({action:z.literal('task_status'),id,status:z.enum(taskStatuses),version:z.number().int().min(1),completionNote:z.string().trim().max(1000)}).strict(),
 z.object({action:z.literal('team'),email:z.string().trim().toLowerCase().email().max(254),role:z.enum(['admin','manager','staff','provider']),specialty:z.enum(specialties),active:z.boolean(),identityVerified:z.literal(true)}).strict(),
]);
export type WorkspaceAction=z.infer<typeof workspaceActionSchema>;
export const prettyStatus=(s:string)=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export function canOperate(m:TeamMember){return m.role!=='provider'}
export function canManage(m:TeamMember){return m.role==='admin'||m.role==='manager'}
