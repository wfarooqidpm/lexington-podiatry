// Single booking form: everyone enters the same details; the gateway's record check
// decides follow-up (linked, 15 min) or first visit (30 min).
const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const base=require('path').join(__dirname,'..'),html=fs.readFileSync(base+'/booking.html','utf8'),controller=fs.readFileSync(base+'/booking-single-page.js','utf8');
const elements={};for(const [,id] of html.matchAll(/\bid="([^"]+)"/g))elements[id]={value:'',checked:false,hidden:false,disabled:false,textContent:'',innerHTML:'',className:'',style:{},dataset:{},listeners:{},checkValidity(){return true;},focus(){this.focused=true;},setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]},classList:{add(){},remove(){},toggle(){}},addEventListener(k,f){this.listeners[k]=f;}};
const get=id=>{assert(elements[id],'Missing real markup for '+id);return elements[id];};
for(const [,id,value] of html.matchAll(/name="npSex" id="([^"]+)" value="([^"]+)"/g))get(id).value=value;
const sexInputs=()=>[get('npSexFemale'),get('npSexMale')];
const query=selector=>selector==='input[name="npSex"]:checked'?sexInputs().find(e=>e.checked)||null:null;
const queryAll=selector=>selector==='input[name="npSex"]'?sexInputs():[];
let calls=[],loads=[],bookings=0,reply={success:true,matched:false};
const c={console,Date,TextEncoder,Uint8Array,crypto:crypto.webcrypto,URL,URLSearchParams,location:{search:'',hash:'',pathname:'/booking.html'},history:{},document:{hidden:false,getElementById:get,querySelectorAll:queryAll,querySelector:query},window:{crypto:crypto.webcrypto,addEventListener(){}},setTimeout:()=>0,clearTimeout(){}};
vm.createContext(c);for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(m[1].includes('var BOOKING_CLIENT_VERSION'))vm.runInContext(m[1],c);
c.loadBookingConfig=()=>{};c.call271=async p=>{calls.push(p);return typeof reply==='function'?reply(p):reply};c.loadSlots=id=>loads.push({id,type:c.state.patientType,session:c.state.verificationSession});c.verifyFrontDoorGatewayVersion=()=>Promise.resolve();c.reserveWebsiteAndStartFrontDoor=()=>{bookings++;return Promise.resolve()};
vm.runInContext(controller,c);
const button=v=>({getAttribute:()=>v});
const fill=()=>{get('npFirst').value='Maria';get('npLast').value='Lopez-Garcia';get('npDob').value='1984-06-02';get('npPhone').value='+12125550142';get('npEmail').value='Maria@Example.com';get('npSexFemale').checked=true;};
const slot=()=>c.selectSlot({dataset:{iso:'2026-12-01T15:00:00Z',label:'Tuesday 10 AM'},classList:{add(){}}});
const future=()=>new Date(Date.now()+600000).toISOString();
(async()=>{
 // The old first-visit / returning question is gone; the page starts with visit mode.
 assert(!elements.visitTypeQuestion&&!elements.cardNew&&!elements.cardReturning,'Patients no longer choose new or returning');
 assert.equal(get('visitModeQuestion').hidden,false);assert.equal(get('identitySection').hidden,true);assert.equal(get('panel3').hidden,true);assert.equal(get('bookingFinish').hidden,true);assert.equal(get('bookingPath').hidden,true);

 c.fd331SelectMode(button('In Person'));
 assert.equal(get('visitModeQuestion').hidden,true);assert.equal(get('identitySection').hidden,false);assert.equal(get('panel3').hidden,true);assert.equal(loads.length,0);
 assert.equal(get('pathFirstText').textContent,'Your details');assert.equal(get('pathFirst')['aria-current'],'step');assert.equal(get('pathSecond').disabled,true);assert.equal(get('pathType').hidden,true);

 // Incomplete details (no sex chosen) never reach the gateway.
 get('npFirst').value='Maria';get('npLast').value='Lopez-Garcia';get('npDob').value='1984-06-02';get('npPhone').value='+12125550142';get('npEmail').value='maria@example.com';
 await c.fd333Check();assert.equal(calls.length,0);assert.match(get('matchMessage').textContent,/sex/);

 // Match: linked follow-up with a short-lived session; times unlock in place.
 fill();reply={success:true,matched:true,session:'f'.repeat(64),expiresAt:future()};
 await c.fd333Check();
 assert.equal(calls.length,1);const sent=calls[0];
 assert.equal(sent.action,'patient-match');
 assert.deepEqual({...sent},{action:'patient-match',firstName:'Maria',lastName:'Lopez-Garcia',dob:'1984-06-02',sex:'female',phone:'+12125550142',email:'maria@example.com'});
 assert.equal(c.state.patientType,'returning');assert.equal(c.state.verificationSession,'f'.repeat(64));
 assert.equal(loads.length,1);assert.equal(loads[0].type,'returning');
 assert.equal(get('patientMatchStatus').hidden,false);assert.equal(get('matchTitle').textContent,'Patient found and linked');assert.match(get('matchBody').textContent,/Welcome back, Maria.*follow-up visit \(15 minutes\)/);
 assert.equal(get('identitySection').hidden,true);assert.equal(get('panel3').hidden,false);
 assert.equal(get('pathFirstText').textContent,'Record linked');assert.equal(get('pathSecond')['aria-current'],'step');assert.equal(get('pathType').textContent,'Follow-up');
 assert.equal(get('btnSubmit').disabled,true);slot();assert.equal(get('btnSubmit').disabled,false);assert.equal(get('bookingFinish').hidden,false);
 const followUp=c.buildWebsiteBookingPayload();assert.equal(followUp.patientType,'returning');assert.equal(followUp.sex,'female');assert.equal(followUp.verificationSession,'f'.repeat(64));
 c.fd331SelectMode(button('In Person'));assert(c.state.selectedSlot,'Selecting the same mode keeps the time');

 // Any edit to the details unlinks the record and hides the times until checked again.
 get('npEmail').value='other@example.com';get('npEmail').listeners.input();
 assert.equal(c.state.verificationSession,null);assert.equal(c.state.patientType,null);assert.equal(c.state.selectedSlot,null);
 assert.equal(get('btnSubmit').disabled,true);assert.equal(get('panel3').hidden,true);assert.equal(get('patientMatchStatus').hidden,true);assert.equal(get('identitySection').hidden,false);
 get('npSexMale').checked=true;get('npSexFemale').checked=false;get('npSexMale').listeners.change();

 // No match: first visit, new-patient times, one booking for a double click.
 reply={success:true,matched:false};await c.fd333Check();
 assert.equal(calls.at(-1).sex,'male');assert.equal(c.state.patientType,'new');assert.equal(c.state.verificationSession,null);assert.equal(loads.at(-1).type,'new');
 assert.equal(get('matchTitle').textContent,'Welcome to Lexington Podiatry');assert.match(get('matchBody').textContent,/first visit \(30 minutes\)/);
 assert.equal(get('pathFirstText').textContent,'First visit');
 slot();assert.equal(get('btnSubmit').disabled,false);
 const firstVisit=c.buildWebsiteBookingPayload();assert.equal(firstVisit.patientType,'new');assert.equal(firstVisit.sex,'male');assert.equal(firstVisit.dob,'1984-06-02');
 c.fd332Edit('mode');assert.equal(get('visitModeQuestion').hidden,false);assert.equal(get('panel3').hidden,true);c.fd331SelectMode(button('In Person'));assert(c.state.selectedSlot);
 c.fd332Edit('info');assert.equal(get('identitySection').hidden,false);assert.equal(get('panel3').hidden,true);c.fd332Edit('time');assert.equal(get('panel3').hidden,false);
 c.fd331Submit();c.fd331Submit();await new Promise(setImmediate);assert.equal(bookings,1);assert.equal(get('bookingInputs').disabled,false);

 // Gateway failure: nothing is assumed; the patient sees a message and can retry.
 get('npFirst').value='Mara';get('npFirst').listeners.input();
 reply={success:false,error:'Unsupported action.'};await c.fd333Check();
 assert.equal(c.fd333.status,'error');assert.equal(c.state.patientType,null);assert.equal(get('panel3').hidden,true);assert.equal(get('matchMessage').textContent,'Unsupported action.');
 // A matched reply without a valid session is treated as a failure, not a follow-up.
 reply={success:true,matched:true,session:'',expiresAt:future()};await c.fd333Check();assert.equal(c.fd333.status,'error');assert.equal(c.state.patientType,null);

 // A reply for details the patient has since changed is ignored.
 let release;reply=()=>new Promise(r=>{release=()=>r({success:true,matched:true,session:'a'.repeat(64),expiresAt:future()});});
 const pending=c.fd333Check();get('npLast').value='Lopez';get('npLast').listeners.input();release();await pending;
 assert.equal(c.state.verificationSession,null);assert.equal(c.state.patientType,null);

 // An expired follow-up session returns the patient to their details.
 get('npLast').value='Lopez-Garcia';reply={success:true,matched:true,session:'b'.repeat(64),expiresAt:future()};await c.fd333Check();assert.equal(c.state.patientType,'returning');
 c.showReturningVerification_();assert.equal(c.state.verificationSession,null);assert.equal(get('identitySection').hidden,false);assert.match(get('matchMessage').textContent,/confirm your details again/);

 // A shared first-visit link's time is preselected once the record check says first visit.
 reply={success:true,matched:false};await c.fd333Check();
 const later=new Date(Date.now()+86400000).toISOString();c.state.selectedSlot=null;
 c.linkedBookingSlot=Date.parse(later);c.renderSlots([{iso:later,visitMode:'VIRTUAL',dateLabel:'Tomorrow',timeLabel:'11:00 AM'}],'slotContainer');
 assert.equal(c.state.selectedSlot,null);assert.match(get('bookingSlotNotice').textContent,/no longer available/);
 c.linkedBookingSlot=Date.parse(later);c.renderSlots([{iso:later,visitMode:'IN_PERSON',dateLabel:'Tomorrow',timeLabel:'11:00 AM'}],'slotContainer');
 assert.equal(c.state.selectedSlot.iso,later);assert.equal(get('bookingSlotNotice').textContent,'');
 console.log('PASS one details form with sex; record check links follow-ups (15 min) or books first visits (30 min); edits unlink; failures and stale replies never assume a patient type; one booking submission.');
})().catch(e=>{console.error(e);process.exitCode=1});
