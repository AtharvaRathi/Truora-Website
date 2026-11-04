export const contact = { phone: '+91 77982 00771', tel: 'tel:+917798200771', whatsapp: 'https://wa.me/917798200771', email: 'pranjalrathi1907@gmail.com' };
import { recoveryPackages } from './packages';
export const surgeries = recoveryPackages.map(p=>({...p,icon:p.slug.includes('hip')?'hip':p.slug.includes('acl')?'acl':p.slug.includes('fracture')?'fracture':p.slug.includes('spine')?'spine':p.slug.includes('shoulder')?'shoulder':'knee',short:'Your recovery. Thoughtfully connected.',description:`A customizable sample package for ${p.name.toLowerCase()}, with equipment, supplies and care brought together.`}));
export const formatPrice=(price:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(price);
export const steps=[
 {title:'Start with your surgery',label:'Choose',text:'Explore a package built around your procedure. Our team will help you understand the proposed equipment, supplies and care.'},
 {title:'Come home to a plan',label:'Prepare',text:'We’ll coordinate delivery around discharge day, with your surgeon’s instructions guiding the arrangements.'},
 {title:'Focus on getting better',label:'Recover',text:'A named coordinator will bring your equipment, supplies and scheduled care visits together. One person to call.'},
 {title:'Leave the collection to us',label:'Complete',text:'When you no longer need the rental equipment, we’ll arrange collection. One less thing for your family to organise.'},
];
export const faqs=[
 {q:'What is Truora?',a:'Truora brings rental equipment, recovery supplies and post-surgery care services into one coordinated package. We’re preparing to launch in Mumbai, starting with orthopedic surgeries.'},
 {q:'Is Truora available in Mumbai yet?',a:'Not yet. Mumbai is our planned first service area. The site now supports demo orders and service requests through a shared account. No real delivery or care is arranged. You can contact us by phone, WhatsApp or email for general information.'},
 {q:'What will a recovery package include?',a:'Each package starts with sample products, equipment rentals and care visits. You can change quantities, buy or rent eligible items, adjust rental periods and add services before saving a demo order. Your treating team must confirm the final plan.'},
 {q:'Will care follow my surgeon’s instructions?',a:'Our planned service will be organised around your surgeon’s discharge instructions. The website provides general information and does not prescribe a recovery plan or replace advice from your treating team.'},
 {q:'Are the prices on this website final?',a:'No. All displayed prices are indicative planning figures and may change before launch. Final inclusions, availability, fees and any deposit will be confirmed before you agree to a package.'},
 {q:'Can I book or pay through the website?',a:'You can create an account, explore demo purchases and rentals, submit a demo order and save service requests. No payment is collected, and no delivery, rental reservation or appointment is confirmed.'},
];
