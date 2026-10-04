/* Approved single-page booker. Reuses the existing scheduling/booking gateway;
 * editing is local, and follow-up slots require possession of the registered email. */
var fd332 = {edit:''};
var fd331 = {generation:0, pending:null, emailSent:false, timer:null, busy:false, slotKey:'', sessionExpires:0};
function fd331El(id){return document.getElementById(id);}
function fd331Identity(){return {firstName:fd331El('rpFirst').value.trim(),lastName:fd331El('rpLast').value.trim(),dob:fd331El('rpDob').value};}
function fd331IdentityKey(){var p=fd331Identity();return [p.firstName,p.lastName,p.dob].join('|');}
function fd331Verified(){return !!(state.verificationSession && fd331.sessionExpires>Date.now());}
function fd331ValidNew(){return ['npFirst','npLast','npDob','npPhone','npEmail'].every(function(id){var e=fd331El(id);return !!e.value.trim()&&e.checkValidity();})&&validBookingPhone_();}
function fd331CancelVerification(){
 fd331.generation++;clearTimeout(fd331.timer);fd331.pending=null;fd331.emailSent=false;fd331.busy=false;fd331.sessionExpires=0;
 state.verificationSession=null;state.verifiedName=null;state.verifiedEmail=null;state.verifiedPhone=null;
 fd331El('btnVerify').disabled=false;fd331El('btnVerify').textContent='🔒 Confirm identity';fd331El('verifyResult').textContent='';
}
function fd331EditIdentity(){fd331CancelVerification();fd332.edit='info';fd331Slots();}
function fd331Render(){
 var waiting=fd331.emailSent&&!fd331Verified();
 fd331El('returningIdentityTitle').textContent=waiting?'Check your email':'Confirm your identity';
 fd331El('returningVerifyInstructions').textContent=waiting?'If your details match your patient record, you’ll receive an email at your registered address.':'We’ll send a confirmation link to the email address on your patient record.';
 fd331El('returningIdentityFields').hidden=waiting;
 ['emailNextSteps','editIdentityDetails','emailIdentityHelp'].forEach(function(id){fd331El(id).hidden=!waiting;});
 var returning=state.patientType==='returning',verified=returning&&fd331Verified();
 fd331El('bookingIdentityIntro').hidden=!!state.patientType;
 fd331El('panel2New').hidden=state.patientType!=='new';fd331El('panel2Returning').hidden=!returning;
 fd331El('cardNew').setAttribute('aria-pressed',String(state.patientType==='new'));
 fd331El('cardReturning').setAttribute('aria-pressed',String(returning));
 fd331El('cardNew').classList.toggle('selected',state.patientType==='new');fd331El('cardReturning').classList.toggle('selected',returning);
 document.querySelectorAll('#newModeGrid .mode-card').forEach(function(b){var selected=b.getAttribute('data-mode')===state.visitMode;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
 var ready=!!state.selectedSlot&&!!state.visitMode&&(returning?verified:state.patientType==='new'&&fd331ValidNew());
 fd331El('btnSubmit').disabled=state.bookingBusy||(!state.bookingCommitted&&!ready);
 fd331El('bookingSelection').textContent=state.patientType?((returning?'Follow-up':'First visit')+' · '+(state.visitMode||'Choose visit mode')+(state.selectedSlot?' · '+state.selectedSlot.label:'')):'Choose your visit details above.';
 if(verified){fd331El('btnVerify').textContent='🔓 Identity confirmed';fd331El('btnVerify').disabled=true;}
 fd332Flow();
}
function fd331Slots(){
 var allowed=!!state.patientType&&!!state.visitMode&&(state.patientType==='new'||fd331Verified());
 var key=allowed?[state.patientType,state.visitMode,state.verificationSession||''].join('|'):'';
 if(!allowed){++slotLoadGeneration;fd331.slotKey='';state.selectedSlot=null;fd331El('slotContainer').innerHTML='<p class="no-slots">'+(state.patientType==='returning'?'🔒 Confirm your identity to unlock appointment times.':'Choose your visit type and mode to see available times.')+'</p>';}
 else if(key!==fd331.slotKey){fd331.slotKey=key;state.selectedSlot=null;loadSlots('slotContainer');}
 fd331Render();
}
function fd331SelectType(button){
 if(state.bookingBusy||state.bookingCommitted)return;
 var type=button.getAttribute('data-type');if(type!==state.patientType){fd331CancelVerification();state.selectedSlot=null;state.bookingPayload=null;}
 state.patientType=type;fd332.edit=state.visitMode?'':'mode';fd331Slots();
}
function fd331SelectMode(button){
 if(state.bookingBusy||state.bookingCommitted)return;
 fd332.edit='';var mode=button.getAttribute('data-mode');
 if(state.visitMode===mode){fd331Render();return;}
 state.visitMode=mode;state.selectedSlot=null;state.bookingPayload=null;fd331Slots();
}
function fd331VerificationExpired(message){fd331CancelVerification();fd331El('verifyResult').textContent=message||'Your confirmation expired. Please request a new email.';fd331Slots();}
async function fd331Confirm(){
 if(fd331.busy||state.bookingBusy||state.patientType!=='returning'||fd331Verified())return;
 var identity=fd331Identity();if(!identity.firstName||!identity.lastName||!identity.dob||!fd331El('rpDob').checkValidity()){fd331El('verifyResult').textContent='Enter your first name, last name and date of birth.';return;}
 var generation=fd331.generation,key=fd331IdentityKey();fd331.busy=true;fd331El('btnVerify').disabled=true;
 try{
  var pending=fd331.pending;
  // A retry after an uncertain send reuses the same key, preventing duplicate mail.
  if(!pending||pending.sent&&Date.now()-pending.created>=60000){
   var poll=random271(32),bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('POLL|'+poll));
   if(generation!==fd331.generation)return;
   var hash=Array.from(new Uint8Array(bytes),function(b){return b.toString(16).padStart(2,'0');}).join('');
   pending={requestId:'VR-'+hash.slice(0,32),pollKey:poll,created:Date.now(),identity:key,sent:false};fd331.pending=pending;
  }
  if(pending.sent&&Date.now()-pending.created<60000){fd331El('verifyResult').textContent='Please check your email. You can request another link after one minute.';return;}
  fd331El('verifyResult').textContent='Sending confirmation…';
  var result=await call271(Object.assign({action:'magic-start',requestId:pending.requestId,pollKey:pending.pollKey,visitMode:state.visitMode},identity));
  if(generation!==fd331.generation||fd331.pending!==pending||key!==fd331IdentityKey())return;
  if(!result.success)throw new Error(result.error||'We could not send the confirmation. Please try again.');
  pending.sent=true;fd332.edit='';fd331.emailSent=true;fd331El('btnVerify').textContent='Send again';fd331Render();
  fd331El('verifyResult').textContent='You can request another link after one minute.';
  fd331Poll();
 }catch(err){if(generation===fd331.generation)fd331El('verifyResult').textContent=err.message||'Please try again.';}
 finally{if(generation===fd331.generation){fd331.busy=false;fd331El('btnVerify').disabled=false;}}
}
async function fd331Poll(){
 clearTimeout(fd331.timer);var pending=fd331.pending,generation=fd331.generation;
 if(!pending||!pending.sent)return;
 if(Date.now()-pending.created>10*60000){fd331VerificationExpired('The link expired. Please request a new confirmation email.');return;}
 try{
  var result=await call271({action:'magic-poll',requestId:pending.requestId,pollKey:pending.pollKey});
  if(generation!==fd331.generation||fd331.pending!==pending||pending.identity!==fd331IdentityKey())return;
  if(result.continued){fd331.pending=null;fd331El('verifyResult').textContent='Continue in the page opened from your email. You can close this tab.';return;}
  if(result.expired){fd331VerificationExpired();return;}
  if(!result.success)throw new Error(result.error||'The confirmation check could not complete.');
  if(result.verified&&result.session){
   var expires=Date.parse(result.expiresAt);if(!isFinite(expires)||expires<=Date.now())throw new Error('Please request a new confirmation.');
   var identity=fd331Identity();state.verificationSession=result.session;state.verifiedName=identity.firstName+' '+identity.lastName;state.verifiedEmail='';state.verifiedPhone='';fd331.sessionExpires=expires;fd331.pending=null;
   fd331El('verifyResult').textContent='🔓 Identity confirmed. Choose your appointment time.';fd331Slots();return;
  }
 }catch(err){if(generation===fd331.generation&&fd331.pending===pending)fd331El('verifyResult').textContent=err.message+' We will check again while this page is open.';}
 if(generation===fd331.generation&&fd331.pending===pending)fd331.timer=setTimeout(fd331Poll,document.hidden?15000:7000);
}
function fd331SetStep(n){
 state.currentStep=n;if(n===5){fd331El('bookingInputs').hidden=true;fd331El('bookingFinish').hidden=true;fd331El('panel5').hidden=false;}
 fd331Render();
}
function fd331Submit(){
 if(state.bookingBusy)return;
 if(!state.bookingCommitted){
  if(state.patientType==='returning'&&!fd331Verified()){fd331VerificationExpired();return;}
  if(!state.selectedSlot||!state.visitMode||(state.patientType==='new'&&!fd331ValidNew())){fd331El('bookingMessage').textContent='Complete your details and choose an appointment time.';fd331Render();return;}
 }
 state.bookingBusy=true;fd331El('bookingInputs').disabled=true;fd331El('btnSubmit').textContent=state.bookingCommitted?'Opening registration…':'Booking your appointment…';fd331El('bookingMessage').textContent='';fd331Render();
 if(!state.bookingPayload)state.bookingPayload=buildWebsiteBookingPayload();
 if(!state.websiteBookingId)state.websiteBookingId=newWebsiteBookingId();
 verifyFrontDoorGatewayVersion().then(function(){return reserveWebsiteAndStartFrontDoor();}).catch(function(err){
  fd331El('bookingMessage').textContent=(err&&err.message)||'Unable to complete booking. Please try again or call the office.';
 }).finally(function(){state.bookingBusy=false;fd331El('bookingInputs').disabled=!!state.bookingCommitted;fd331El('btnSubmit').textContent=state.bookingCommitted?'Continue registration':'Book appointment';fd331Render();});
}
// Keep the real booking DOM intact: email confirmation opens scheduling in this tab.
// Credentials live only in memory; loading the link alone never approves it.
function fd331Approval(){
 var fragment=window.lexBookingVerificationFragment||location.hash;delete window.lexBookingVerificationFragment;
 var match=fragment.match(/^#verify=(VR-[a-f0-9]{32})\.([a-f0-9]{64})(?:\.(ip|vv))?$/);if(!match)return false;
 history.replaceState(null,'',location.pathname);
 document.querySelector('main').insertAdjacentHTML('beforeend','<section class="booking-section" id="fd331Approval" style="margin:0 28px 28px"><div class="booking-eyebrow">CONTINUE YOUR BOOKING</div><h2>Welcome back</h2><p>Confirm your identity, then choose your appointment time right here.</p><button class="btn btn-ink" id="fd331Approve" type="button">🔒 Confirm &amp; choose a time</button><p id="fd331ApprovalStatus" role="status"></p><p><a href="booking.html">Start again</a></p></section>');
 document.querySelector('.booking-main').hidden=true;
 var continuationKey=random271(32);
 fd331El('fd331Approve').onclick=async function(){
  var button=this;if(button.disabled)return;button.disabled=true;fd331El('fd331ApprovalStatus').textContent='Confirming…';
  try{
   var result=await call271({action:'magic-approve',requestId:match[1],token:match[2],continuationKey:continuationKey});
   if(!result.success||!result.approved||!result.verified||!result.session)throw new Error(result.error||'We could not continue your booking. Please try again.');
   var expiry=Date.parse(result.expiresAt);if(!isFinite(expiry)||expiry<=Date.now())throw new Error('This confirmation expired. Please start again.');
   state.patientType='returning';state.visitMode=match[3]==='ip'?'In Person':match[3]==='vv'?'Virtual':null;
   state.verificationSession=result.session;state.verifiedName=result.firstName+' '+result.lastName;state.verifiedEmail='';state.verifiedPhone='';fd331.sessionExpires=expiry;
   fd331El('rpFirst').value=result.firstName;fd331El('rpLast').value=result.lastName;fd331El('rpDob').value=result.dob;
   fd331El('fd331Approval').hidden=true;document.querySelector('.booking-main').hidden=false;
   fd331El('verifyResult').textContent='🔓 Identity confirmed. Choose your appointment time.';
   fd331Initialize();fd331Slots();
  }catch(err){fd331El('fd331ApprovalStatus').textContent=err.message;button.disabled=false;}
 };
 return true;
}
// Bubble choices edit the existing draft; no writes, navigation, or new verification.
function fd332Edit(section){
 if(state.bookingBusy||state.bookingCommitted)return;
 fd332.edit=section;fd331Render();
}
function fd332Flow(){
 var done=state.currentStep===5,type=state.patientType,mode=state.visitMode;
 var ready=!!type&&!!mode&&(type==='returning'?fd331Verified():fd331ValidNew());
 var askType=!type||fd332.edit==='type';
 var askMode=!askType&&(!mode||fd332.edit==='mode');
 var details=!askType&&!askMode&&(!ready||fd332.edit==='info'||(type==='new'&&!state.selectedSlot&&fd332.edit!=='time'));
 fd331El('visitTypeQuestion').hidden=!askType;
 fd331El('visitModeQuestion').hidden=!askMode;
 fd331El('bookingIdentityIntro').hidden=true;
 fd331El('identitySection').hidden=!details||done;
 fd331El('panel3').hidden=!ready||askType||askMode||done;
 fd331El('bookingFinish').hidden=done||!ready||!state.selectedSlot||askType||askMode;
 fd331El('bookingPath').hidden=!type||done;
 fd331El('pathTypeText').textContent=type==='new'?'First visit':'Returning patient';
 fd331El('pathModeText').textContent=mode||(askType?'Visit mode':'Choose visit mode');
 fd331El('pathIdentityText').textContent=ready?(type==='returning'?'Identity confirmed':fd331El('npFirst').value.trim()+' '+fd331El('npLast').value.trim()):(type==='returning'?'Confirm identity':'Your details');
 fd331El('pathTimeText').textContent=state.selectedSlot?state.selectedSlot.label:'Choose a time';
 ['pathDown','pathBack','pathIdentity','pathTime'].forEach(function(id){fd331El(id).hidden=!mode;});
 fd331El('pathTime').disabled=!ready;
 ['pathType','pathMode','pathIdentity','pathTime'].forEach(function(id){var current=id===(askType?'pathType':askMode?'pathMode':!ready||fd332.edit==='info'?'pathIdentity':'pathTime');fd331El(id).classList.toggle('current',current);fd331El(id).setAttribute('aria-current',current?'step':'false');});
 fd331El('bookingConnectionStatus').hidden=askType||askMode;
}
// Compatibility hooks used by the shared slot renderer and booking response handler.
renderBookingCards=fd331Render;setStep=fd331SetStep;showReturningVerification_=fd331VerificationExpired;updatePatientSummary=fd331Render;
function fd331Initialize(){
 ['npFirst','npLast','npDob','npPhone','npEmail','rpFirst','rpLast','rpDob'].forEach(function(id){fd331El(id).addEventListener('input',function(){if(state.bookingBusy||state.bookingCommitted)return;state.bookingPayload=null;if(id.indexOf('rp')===0){fd331CancelVerification();fd331Slots();}else fd331Render();});});
 initialiseInternationalPhone_();loadBookingConfig();fd331Render();
}

if(!fd331Approval())fd331Initialize();
