const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(process.argv[2] || require('path').join(__dirname, '../booking.html'),'utf8');
function fn(name){const start=html.indexOf('function '+name+'(');assert(start>=0,'Missing new-patient mode handler: '+name);const tail=html.slice(start);const next=tail.slice(1).search(/^function /m);return next<0?tail.split('</script>')[0]:tail.slice(0,next+1);}
const elements={};const el=id=>elements[id]||(elements[id]={value:id==='npDob'?'2000-01-01':'Test',disabled:false,style:{},classList:{toggle(){},remove(){},add(){}}});
let loads=[];const cards=[{getAttribute:()=> 'In Person',classList:{toggle(){}}},{getAttribute:()=> 'Virtual',classList:{toggle(){}}}];
const c={state:{patientType:'new',visitMode:null,selectedSlot:null,bookingPayload:null},document:{getElementById:el,querySelectorAll:()=>cards},loadSlots:id=>loads.push({id,mode:c.state.visitMode}),bookingPhoneNumber_:()=>'+12125550100',setStep(){},renderBookingCards(){}};
vm.createContext(c);vm.runInContext(fn('selectNewVisitMode')+'\n'+fn('buildWebsiteBookingPayload'),c);
for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(script[1]);
(async()=>{
 const pending=[],renders=[];
 c.FRONT_DOOR_GATEWAY_URL='https://example.test';
 c.bookingFetch271=()=>new Promise((resolve,reject)=>pending.push({resolve,reject}));
 c.renderPracticeBanners=()=>{};c.renderSlots=(slots)=>renders.push(slots);
 c.state.patientType='new';c.state.visitMode='In Person';
 vm.runInContext('var slotLoadGeneration = 0;\n'+fn('loadSlots'),c);
 c.loadSlots('slotContainer');c.state.visitMode='Virtual';c.loadSlots('slotContainer');
 pending[1].resolve({json:()=>Promise.resolve({success:true,slots:['virtual']})});
 await new Promise(resolve=>setImmediate(resolve));
 pending[0].resolve({json:()=>Promise.resolve({success:true,slots:['in-person']})});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(renders,[['virtual']]);
 console.log('PASS: slower stale mode response cannot replace current slots.');
})().catch(err=>{console.error(err);process.exitCode=1});

