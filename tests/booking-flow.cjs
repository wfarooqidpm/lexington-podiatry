const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../booking.html'),'utf8');
assert(html.includes('class="panel active" id="panel2New"'),'Your information must be the initial screen');
const typePanel=html.slice(html.indexOf('id="panel1"'),html.indexOf('<!-- PANEL 2A'));
assert(typePanel.includes('id="newModeGrid"'),'Visit type and mode must share one panel');
function fn(name){let i=html.indexOf('function '+name+'(');assert(i>=0,name);let s=html.slice(i),n=s.slice(1).search(/^function /m);return n<0?s.split('</script>')[0]:s.slice(0,n+1);}
const els={};const el=id=>els[id]||(els[id]={value:'Test',style:{},disabled:false,classList:{add(){},remove(){},toggle(){}}});
const steps=[],loads=[];const c={state:{patientType:'new',visitMode:'Virtual',selectedSlot:{label:'Old'}},document:{getElementById:el,querySelectorAll:()=>[]},setStep:n=>steps.push(n),loadSlots:id=>loads.push(id),hasVerifiedReturningPatient_:()=>false,restoreVerificationAttempts_(){},verifyReturning(){},renderBookingCards(){},validBookingPhone_:()=>true,goToStep4:()=>steps.push(4)};vm.createContext(c);vm.runInContext(fn('goToStep2')+'\n'+fn('goToStep3New')+'\n'+fn('validateNewInfoAndReview'),c);
c.validateNewInfoAndReview();assert.equal(steps.at(-1),2);assert.equal(loads.length,0);
c.goToStep2();assert.equal(steps.at(-1),3);assert.equal(loads.at(-1),'slotContainer');
c.state.selectedSlot={label:'New slot'};c.goToStep3New();assert.equal(steps.at(-1),4);
c.state.patientType='returning';c.goToStep2();assert.equal(el('rpFirst').value,el('npFirst').value);assert.equal(loads.length,1,'Unverified follow-up cannot load slots');
console.log('PASS information → combined visit/mode → slots → review; follow-up identity prefilled and gated.');
vm.runInContext(fn('selectCombinedMode')+'\n'+fn('selectType'),c);c.configureStepTabs=()=>{};c.clearReturningVerification_=()=>{};c.state.patientType=null;c.state.visitMode=null;const before=loads.length;c.selectCombinedMode({getAttribute:()=> 'Virtual'});assert.equal(el('btnStep1Next').disabled,true);c.selectType({getAttribute:()=> 'new'});assert.equal(el('btnStep1Next').disabled,false);assert.equal(c.state.visitMode,'Virtual');assert.equal(loads.length,before,'Selecting visit and mode does not fetch or save');
console.log('PASS combined visit/mode requires both choices and performs no server calls.');
c.state.visitMode='Virtual';c.clearReturningVerification_=()=>{c.state.visitMode=null;c.state.verificationSession=null;};vm.runInContext(fn('showReturningVerification_'),c);c.showReturningVerification_('Expired');assert.equal(c.state.visitMode,'Virtual');assert.equal(steps.at(-1),3);console.log('PASS expired verification preserves the chosen visit mode.');
