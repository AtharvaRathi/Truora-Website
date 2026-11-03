export const contact = { phone: '+91 77982 00771', tel: 'tel:+917798200771', whatsapp: 'https://wa.me/917798200771', email: 'pranjalrathi1907@gmail.com' };
export const surgeries = [
 {slug:'knee-replacement',name:'Knee replacement',short:'Support for your next steps.',price:18500,icon:'knee',description:'A coordinated approach to the equipment, supplies and at-home care needed after knee replacement.'},
 {slug:'hip-replacement',name:'Hip replacement',short:'Comfort. Confidence. Home.',price:18500,icon:'hip',description:'Recovery support brought together around your hip surgery and your surgeon’s discharge instructions.'},
 {slug:'acl-reconstruction',name:'ACL reconstruction',short:'A little stronger, every day.',price:16950,icon:'acl',description:'Equipment, supplies and physiotherapy coordination for your recovery after ACL reconstruction.'},
 {slug:'fracture-recovery',name:'Fracture recovery',short:'The support to heal at home.',price:22950,icon:'fracture',description:'A single point of coordination for your recovery needs following fracture surgery.'},
 {slug:'spine-surgery',name:'Spine surgery',short:'Care that meets you where you are.',price:17250,icon:'spine',description:'Help organising equipment, supplies and care visits for recovery at home after spine surgery.'},
 {slug:'shoulder-surgery',name:'Shoulder surgery',short:'Less organising. More healing.',price:15750,icon:'shoulder',description:'A surgery-focused package approach to the practical needs of recovery after shoulder surgery.'},
];
export const formatPrice=(price:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(price);
export const steps=[
 {title:'Start with your surgery',label:'Choose',text:'Explore a package built around your procedure. Our team will help you understand the proposed equipment, supplies and care.'},
 {title:'Come home to a plan',label:'Prepare',text:'We’ll coordinate delivery around discharge day, with your surgeon’s instructions guiding the arrangements.'},
 {title:'Focus on getting better',label:'Recover',text:'A named coordinator will bring your equipment, supplies and scheduled care visits together. One person to call.'},
 {title:'Leave the collection to us',label:'Complete',text:'When you no longer need the rental equipment, we’ll arrange collection. One less thing for your family to organise.'},
];
export const faqs=[
 {q:'What is Truora?',a:'Truora brings rental equipment, recovery supplies and post-surgery care services into one coordinated package. We’re preparing to launch in Mumbai, starting with orthopedic surgeries.'},
 {q:'Is Truora available in Mumbai yet?',a:'Not yet. Mumbai is our planned first service area. This website introduces our approach; bookings and online enquiries are not currently enabled. You can contact us by phone, WhatsApp or email for general information.'},
 {q:'What will a recovery package include?',a:'The package approach brings together rental equipment, supplies, care visits and a named coordinator. Exact inclusions, visit schedules, rental durations and availability will be confirmed before any service agreement.'},
 {q:'Will care follow my surgeon’s instructions?',a:'Our planned service will be organised around your surgeon’s discharge instructions. The website provides general information and does not prescribe a recovery plan or replace advice from your treating team.'},
 {q:'Are the prices on this website final?',a:'No. All displayed prices are indicative planning figures and may change before launch. Final inclusions, availability, fees and any deposit will be confirmed before you agree to a package.'},
 {q:'Can I book or pay through the website?',a:'Online booking and payments are not available in this introductory release. You can explore our approach and contact the team directly for information.'},
];
