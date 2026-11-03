import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cookies } from 'next/headers';
import { cartTotals, getProduct, linePrice } from './catalog';
import type { AppUser, Profile, OrderInput, Order, ServiceInput, ServiceRequest } from './validation';

const scrypt = promisify(scryptCallback);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const cookieName = 'truora_local_session';
let db: DatabaseSync | undefined;
export function localDb() {
  if (process.env.NODE_ENV==='production' || process.env.VERCEL || process.env.RENDER) throw new Error('Use Supabase for hosted deployments. Local SQLite is for development only.');
  if (db) return db;
  const path = join(process.cwd(), '.local', 'truora.sqlite');
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,profile TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS resets(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),request_key TEXT NOT NULL,payload TEXT NOT NULL,UNIQUE(user_id,request_key));
    CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),request_key TEXT NOT NULL,payload TEXT NOT NULL,UNIQUE(user_id,request_key));
    CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);`);
  return db;
}
export function localRateLimit(key: string, max = 12) {
  const d = localDb(), now = Date.now();
  d.prepare('DELETE FROM rate_limits WHERE expires < ?').run(now);
  const row = d.prepare('SELECT count FROM rate_limits WHERE key=?').get(key) as {count:number}|undefined;
  if (row && row.count >= max) throw new Error('Too many attempts. Please try again in 15 minutes.');
  d.prepare('INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key, now + 900_000);
}
async function passwordHash(password: string) { const salt = randomBytes(16).toString('hex'); const value = await scrypt(password, salt, 64) as Buffer; return `${salt}:${value.toString('hex')}`; }
async function verify(password: string, stored: string) { const [salt, value] = stored.split(':'); const computed = await scrypt(password, salt, 64) as Buffer; return timingSafeEqual(computed, Buffer.from(value, 'hex')); }
async function setSession(id: string) { const token = randomBytes(32).toString('hex'); localDb().prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token), id, Date.now() + 7 * 86400_000); (await cookies()).set(cookieName, token, { httpOnly: true, sameSite: 'lax', secure: false, path: '/', maxAge: 7 * 86400 }); }
export async function localUser(): Promise<AppUser | null> { const token = (await cookies()).get(cookieName)?.value; if (!token) return null; const row = localDb().prepare('SELECT u.id,u.email,u.profile FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token=? AND s.expires>?').get(hash(token), Date.now()) as {id:string;email:string;profile:string}|undefined; return row ? {...JSON.parse(row.profile),id:row.id,email:row.email} : null; }
export async function localSignup(name: string, email: string, password: string) { const d = localDb(); if (d.prepare('SELECT id FROM users WHERE email=?').get(email)) throw new Error('Unable to create this account. Try signing in or resetting your password.'); const id = randomUUID(); d.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,email,await passwordHash(password),JSON.stringify({name,phone:'',address:'',city:'',pincode:''})); await setSession(id); }
export async function localLogin(email: string, password: string) { const row = localDb().prepare('SELECT id,password FROM users WHERE email=?').get(email) as {id:string;password:string}|undefined; if (!row || !await verify(password,row.password)) throw new Error('Email or password is incorrect.'); await setSession(row.id); }
export async function localLogout() { const jar = await cookies(), token = jar.get(cookieName)?.value; if (token) localDb().prepare('DELETE FROM sessions WHERE token=?').run(hash(token)); jar.delete(cookieName); }
export function localProfile(id: string, profile: Profile) { localDb().prepare('UPDATE users SET profile=? WHERE id=?').run(JSON.stringify(profile),id); }
export function localForgot(email: string) { const row = localDb().prepare('SELECT id FROM users WHERE email=?').get(email) as {id:string}|undefined; if (!row) return null; const token = randomBytes(32).toString('hex'); localDb().prepare('INSERT INTO resets VALUES(?,?,?)').run(hash(token),row.id,Date.now()+900_000); return token; }
export async function localReset(token: string, password: string) { const d=localDb(); const row=d.prepare('SELECT user_id FROM resets WHERE token=? AND expires>?').get(hash(token),Date.now()) as {user_id:string}|undefined; if(!row)throw new Error('This reset link has expired or has already been used.'); const nextHash=await passwordHash(password); d.exec('BEGIN IMMEDIATE');try{const valid=d.prepare('DELETE FROM resets WHERE token=? AND expires>?').run(hash(token),Date.now());if(Number(valid.changes)!==1)throw new Error('This reset link has already been used.');d.prepare('UPDATE users SET password=? WHERE id=?').run(nextHash,row.user_id);d.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);d.prepare('DELETE FROM resets WHERE user_id=?').run(row.user_id);d.exec('COMMIT');}catch(e){d.exec('ROLLBACK');throw e} }
export function localOrders(id: string): Order[] { return (localDb().prepare('SELECT payload FROM orders WHERE user_id=? ORDER BY rowid DESC').all(id) as {payload:string}[]).map(r=>JSON.parse(r.payload)); }
export function localRequests(id: string): ServiceRequest[] { return (localDb().prepare('SELECT payload FROM requests WHERE user_id=? ORDER BY rowid DESC').all(id) as {payload:string}[]).map(r=>JSON.parse(r.payload)); }
export function localOrder(id: string, input: OrderInput): Order {
  const d = localDb(); const existing = d.prepare('SELECT payload FROM orders WHERE user_id=? AND request_key=?').get(id,input.idempotencyKey) as {payload:string}|undefined;
  if(existing)return JSON.parse(existing.payload);
  const order:Order={id:randomUUID(),created_at:new Date().toISOString(),status:'demo_submitted',payment_status:'not_charged',...cartTotals(input.lines),address:input.address,rental_start:input.rentalStart||null,items:input.lines.map(l=>({productId:l.productId,name:getProduct(l.productId)!.name,mode:l.mode,quantity:l.quantity,days:l.days,unitPrice:linePrice(l),deposit:l.mode==='rental'?getProduct(l.productId)!.deposit:0}))};
  d.prepare('INSERT INTO orders VALUES(?,?,?,?)').run(order.id,id,input.idempotencyKey,JSON.stringify(order));return order;
}
export function localRequest(id: string, input: ServiceInput): ServiceRequest { const d=localDb();const existing=d.prepare('SELECT payload FROM requests WHERE user_id=? AND request_key=?').get(id,input.idempotencyKey) as {payload:string}|undefined;if(existing)return JSON.parse(existing.payload);const request:ServiceRequest={id:randomUUID(),created_at:new Date().toISOString(),kind:input.kind,subject:input.subject,phone:input.phone,preferred_date:input.preferredDate||null,preferred_time:input.preferredTime,notes:input.notes,status:'demo_submitted'};d.prepare('INSERT INTO requests VALUES(?,?,?,?)').run(request.id,id,input.idempotencyKey,JSON.stringify(request));return request; }
