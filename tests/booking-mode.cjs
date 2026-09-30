const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(process.argv[2] || require('path').join(__dirname, '../booking.html'),'utf8');
function fn(name){const start=html.indexOf('function '+name+'(');assert(start>=0,'Missing new-patient mode handler: '+name);const tail=html.slice(start);const next=tail.slice(1).search(/^function /m);return next<0?tail.split('</script>')[0]:tail.slice(0,next+1);}
const elements={};const el=id=>elements[id]||(elements[id]={value:id==='npDob'?'2000-01-01':'Test',disabled:false,style:{},classList:{toggle(){},remove(){},add(){}}});
let loads=[];const cards=[{getAttribute:()=> 'In Person',classList:{toggle(){}}},{getAttribute:()=> 'Virtual',classList:{toggle(){}}}];
const c={state:{patientType:'new',visitMode:null,selectedSlot:null,bookingPayload:null},document:{getElementById:el,querySelectorAll:()=>cards},loadSlots:id=>loads.push({id,mode:c.state.visitMode}),bookingPhoneNumber_:()=>'+12125550100',setStep(){}};
vm.createContext(c);vm.runInContext(fn('selectNewVisitMode')+'\n'+fn('buildWebsiteBookingPayload'),c);
const newPanel=html.slice(html.indexOf('<div class="panel" id="panel3">'),html.indexOf('<!-- PANEL 4 REVIEW -->'));
assert(newPanel.includes('id="newModeGrid"'),'New-patient mode controls must be visible with slots');
for(const [card,mode] of [[cards[0],'In Person'],[cards[1],'Virtual']]){c.state.selectedSlot={iso:'stale'};c.state.bookingPayload={stale:true};c.selectNewVisitMode(card);assert.equal(c.state.visitMode,mode);assert.equal(c.state.selectedSlot,null);assert.equal(c.state.bookingPayload,null);assert.equal(el('btnStep3Next').disabled,true);assert.equal(loads.at(-1).mode,mode);assert.equal(loads.at(-1).id,'slotContainer');c.state.selectedSlot={iso:'2026-10-05T10:00:00-04:00',label:'Test time'};assert.equal(c.buildWebsiteBookingPayload().visitMode,mode);}
c.state.patientType='returning';c.state.verifiedName='Test Patient';c.state.verifiedPhone='+12125550100';c.state.verifiedEmail='test@example.com';c.state.verificationSession='test-session';c.state.visitMode='Virtual';assert.equal(c.buildWebsiteBookingPayload().visitMode,'Virtual');assert.equal(c.buildWebsiteBookingPayload().verificationSession,'test-session');
for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(script[1]);
console.log('PASS: visible new-patient mode controls; both modes load filtered slots and reach payload; switching clears stale booking; returning verification preserved; script syntax valid.');
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
