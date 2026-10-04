// A successful email confirmation must reveal scheduling in this tab, not a return instruction.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const base=require('path').join(__dirname,'..'),html=fs.readFileSync(base+'/booking.html','utf8'),controller=fs.readFileSync(base+'/booking-single-page.js','utf8');
const elements={};for(const id of [...Array.from(html.matchAll(/\bid="([^"]+)"/g),m=>m[1]),'fd331Approval','fd331Approve','fd331ApprovalStatus'])elements[id]={value:'',hidden:false,disabled:false,textContent:'',innerHTML:'',style:{},dataset:{},listeners:{},checkValidity(){return true;},setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]},classList:{add(){},remove(){},toggle(){}},addEventListener(k,f){this.listeners[k]=f;}};
const get=id=>{assert(elements[id],'Missing markup: '+id);return elements[id]};
let calls=[],loads=[],removed=false,drop=true;
const c={console,Date,TextEncoder,Uint8Array,crypto:crypto.webcrypto,URL,location:{hash:'#verify=VR-'+'a'.repeat(32)+'.'+'b'.repeat(64)+'.ip',pathname:'/booking.html'},history:{replaceState(){removed=true}},document:{hidden:false,getElementById:get,querySelectorAll:()=>[],querySelector:()=>({insertAdjacentHTML(){}})},window:{crypto:crypto.webcrypto,addEventListener(){}},setTimeout(){},clearTimeout(){}};
vm.createContext(c);for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(m[1].includes('var BOOKING_CLIENT_VERSION'))vm.runInContext(m[1],c);
c.loadBookingConfig=()=>{};c.loadSlots=id=>loads.push({id,session:c.state.verificationSession,mode:c.state.visitMode});c.call271=async p=>{calls.push(p);if(drop){drop=false;throw new Error('Connection interrupted')}return {success:true,approved:true,verified:true,session:'c'.repeat(64),expiresAt:new Date(Date.now()+600000).toISOString(),firstName:'Test',lastName:'Person',dob:'1988-04-12'}};
vm.runInContext(controller,c);
(async()=>{
assert.equal(calls.length,0,'Opening email must not consume token');assert.equal(removed,true);
assert.equal(typeof get('fd331Approve').onclick,'function','Email mode must expose confirmation action');
await get('fd331Approve').onclick.call(get('fd331Approve'));
assert.equal(calls.length,1);assert.equal(c.state.verificationSession,null);assert.equal(get('fd331Approve').disabled,false);
await get('fd331Approve').onclick.call(get('fd331Approve'));assert.equal(calls.length,2);assert.equal(calls[0].continuationKey,calls[1].continuationKey);assert.match(calls[0].continuationKey,/^[a-f0-9]{64}$/);
assert.equal(c.state.patientType,'returning');assert.equal(c.state.visitMode,'In Person');assert.equal(c.state.verifiedName,'Test Person');assert.equal(get('rpDob').value,'1988-04-12');assert.equal(get('panel3').hidden,false);assert.equal(get('fd331Approval').hidden,true);assert.equal(loads.length,1);
get('rpFirst').value='Changed';get('rpFirst').listeners.input();assert.equal(c.state.verificationSession,null);assert.equal(get('panel3').hidden,true);
console.log('PASS email page waits for explicit confirmation, clears URL secret, restores visit and identity, unlocks times in place, editing identity revokes');
})().catch(e=>{console.error(e);process.exitCode=1});
