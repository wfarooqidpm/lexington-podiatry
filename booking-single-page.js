/* Approved single-page booker. Reuses the existing scheduling/booking gateway.
 * Everyone enters the same details. The gateway checks them against the
 * practice's patient records and answers only "matched" (follow-up, with a
 * short-lived session) or "not matched" (first visit). No chart data reaches
 * the browser. Emailed confirmation links from earlier bookings still work. */
var fd332 = {edit:''};
var fd331 = {generation:0, busy:false, slotKey:'', sessionExpires:0};
// Patient-record check. status: '' (not checked) | checking | linked | new | error
var fd333 = {status:'', key:'', generation:0, firstName:'', viaEmail:false, message:''};
var FD333_DETAIL_IDS = ['npFirst','npLast','npDob','npPhone','npEmail'];
function fd331El(id){return document.getElementById(id);}
function fd331Verified(){return !!(state.verificationSession && fd331.sessionExpires>Date.now());}
function fd331Pickup(){return state.bookingPurpose==='ORTHOTICS_PICKUP';}
function fd333Sex(){var picked=document.querySelector('input[name="npSex"]:checked');return picked?picked.value:'';}
function fd331ValidNew(){return FD333_DETAIL_IDS.every(function(id){var e=fd331El(id);return !!e.value.trim()&&e.checkValidity();})&&!!fd333Sex()&&validBookingPhone_();}
function fd333Details(){
 return {firstName:fd331El('npFirst').value.trim(),lastName:fd331El('npLast').value.trim(),dob:fd331El('npDob').value,
  sex:fd333Sex(),phone:bookingPhoneNumber_('E164')||fd331El('npPhone').value.trim(),email:fd331El('npEmail').value.trim().toLowerCase()};
}
function fd333Key(){var d=fd333Details();return [d.firstName,d.lastName,d.dob,d.sex,d.phone,d.email].join('|');}
function fd333Matched(){return fd333.status==='linked'||fd333.status==='new';}
function fd333DurationText(type){return bookingDurationLabel(type).replace(' min',' minutes');}

function fd331CancelVerification(){
 fd331.generation++;fd331.busy=false;fd331.sessionExpires=0;
 state.verificationSession=null;state.verifiedName=null;state.verifiedEmail=null;state.verifiedPhone=null;
 if(fd331Pickup()){state.bookingPurpose='';state.websiteBookingId=null;}
}
// Any change to the details forgets the previous answer, so a new check runs.
function fd333Reset(){
 fd333.generation++;fd333.status='';fd333.key='';fd333.firstName='';fd333.viaEmail=false;fd333.message='';
 fd331CancelVerification();state.patientType=null;state.selectedSlot=null;state.bookingPayload=null;
}

async function fd333Check(){
 if(fd333.status==='checking'||state.bookingBusy||state.bookingCommitted)return;
 if(!state.visitMode){fd332.edit='mode';fd331Render();return;}
 if(!fd331ValidNew()){fd333.message='Please complete every field, including sex, before continuing.';fd331Render();return;}
 var details=fd333Details(),key=fd333Key(),generation=++fd333.generation;
 fd333.status='checking';fd333.message='';fd331Render();
 try{
  var result=await call271(Object.assign({action:'patient-match'},details));
  if(generation!==fd333.generation||key!==fd333Key())return;
  if(!result||!result.success)throw new Error((result&&result.error)||'');
  if(result.matched){
   var expires=Date.parse(result.expiresAt);
   if(!result.session||!isFinite(expires)||expires<=Date.now())throw new Error('');
   state.patientType='returning';state.verificationSession=result.session;fd331.sessionExpires=expires;
   state.verifiedName=details.firstName+' '+details.lastName;state.verifiedPhone=details.phone;state.verifiedEmail=details.email;
   fd333.status='linked';fd333.firstName=details.firstName;
  }else{
   state.patientType='new';fd333.status='new';
  }
  fd333.key=key;fd332.edit='';if(state.patientType!=='new')linkedBookingSlot=null;fd331Slots();
  var status=fd331El('patientMatchStatus');if(status&&status.focus)status.focus();
 }catch(err){
  if(generation!==fd333.generation)return;
  fd333.status='error';
  fd333.message=(err&&err.message)||'We couldn’t check your details just now. Please try again, or call (212) 510-8665 and we’ll book you.';
  fd331Render();
 }
}

function fd333RenderStatus(){
 var box=fd331El('patientMatchStatus'),button=fd331El('btnFindRecord'),note=fd331El('matchMessage');
 var checking=fd333.status==='checking';
 button.disabled=checking||state.bookingBusy||!!state.bookingCommitted;
 button.textContent=checking?'Checking our records…':fd333Matched()?'Update and check again':'Continue to appointment times';
 note.textContent=fd333.status==='error'||!fd333Matched()?fd333.message:'';
 box.hidden=!fd333Matched();
 box.className='match-card '+(fd333.status==='linked'?'match-linked':'match-new');
 if(fd333.status==='linked'){
  fd331El('matchTitle').textContent=fd331Pickup()?'Patient record linked: orthotics pickup':'Patient found and linked';
  fd331El('matchBody').textContent=(fd333.firstName?'Welcome back, '+fd333.firstName+'. ':'Welcome back. ')+
   (fd333.viaEmail?'Your email confirmation linked this booking to your patient record. ':'Your details match your patient record, and this booking is linked to it. ')+
   (fd331Pickup()?'You’re booking your orthotics pickup.':'You’re booking a follow-up visit ('+fd333DurationText('returning')+').');
 }else if(fd333.status==='new'){
  fd331El('matchTitle').textContent='Welcome to Lexington Podiatry';
  fd331El('matchBody').textContent='You’re booking a first visit ('+fd333DurationText('new')+'). Seen Dr. Farooqi before? Check that your name, date of birth, phone and email are the ones we have on file, or call (212) 510-8665.';
 }
}

function fd331Render(){
 var returning=state.patientType==='returning';
 document.querySelectorAll('#newModeGrid .mode-card, #bookingSlotModes button').forEach(function(b){var selected=b.getAttribute('data-mode')===state.visitMode;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
 var ready=!!state.selectedSlot&&!!state.visitMode&&fd333Matched()&&(returning?fd331Verified():state.patientType==='new'&&fd331ValidNew());
 fd331El('btnSubmit').disabled=state.bookingBusy||(!state.bookingCommitted&&!ready);
 fd331El('bookingSelection').textContent=fd333Matched()?((fd331Pickup()?'Orthotics pickup':returning?'Follow-up':'First visit')+' · '+(state.visitMode||'Choose visit mode')+(state.selectedSlot?' · '+state.selectedSlot.label:'')):'Choose your visit details above.';
 fd333RenderStatus();
 fd332Flow();
}
function fd331Slots(){
 var allowed=fd333Matched()&&!!state.visitMode&&(state.patientType==='new'||fd331Verified());
 var key=allowed?[state.patientType,state.visitMode,state.verificationSession||''].join('|'):'';
 if(!allowed){++slotLoadGeneration;fd331.slotKey='';state.selectedSlot=null;fd331El('slotContainer').innerHTML='<p class="no-slots">Enter your details to see available times.</p>';}
 else if(key!==fd331.slotKey){fd331.slotKey=key;state.selectedSlot=null;loadSlots('slotContainer');}
 fd331Render();
}
function fd331SelectMode(button){
 if(state.bookingBusy||state.bookingCommitted||fd331Pickup())return;
 fd332.edit='';var mode=button.getAttribute('data-mode');
 if(state.visitMode===mode){fd331Render();return;}
 if(state.visitMode){linkedBookingSlot=null;fd331El('bookingSlotNotice').textContent='';}
 state.visitMode=mode;state.selectedSlot=null;state.bookingPayload=null;fd331Slots();
 if(!fd333Matched()){var first=fd331El('npFirst');if(first&&first.focus&&!first.value)first.focus();}
}
// A follow-up session that lapses (or a slot lookup that rejects it) sends the
// patient back to their filled-in details for a fresh check.
function fd331VerificationExpired(message){
 fd333Reset();fd333.message=message||'Please confirm your details again to see follow-up times.';fd332.edit='';fd331Slots();
}
function fd331SetStep(n){
 state.currentStep=n;if(n===5){fd331El('bookingInputs').hidden=true;fd331El('bookingFinish').hidden=true;fd331El('panel5').hidden=false;}
 fd331Render();
}
function fd331Submit(){
 if(state.bookingBusy)return;
 if(!state.bookingCommitted){
  if(state.patientType==='returning'&&!fd331Verified()){fd331VerificationExpired();return;}
  if(!fd333Matched()||!state.selectedSlot||!state.visitMode||(state.patientType==='new'&&!fd331ValidNew())){fd331El('bookingMessage').textContent='Complete your details and choose an appointment time.';fd331Render();return;}
 }
 state.bookingBusy=true;fd331El('bookingInputs').disabled=true;fd331El('btnSubmit').textContent=state.bookingCommitted?'Opening registration…':'Booking your appointment…';fd331El('bookingMessage').textContent='';fd331Render();
 if(!state.bookingPayload)state.bookingPayload=buildWebsiteBookingPayload();
 if(!state.websiteBookingId)state.websiteBookingId=newWebsiteBookingId();
 verifyFrontDoorGatewayVersion().then(function(){return reserveWebsiteAndStartFrontDoor();}).catch(function(err){
  fd331El('bookingMessage').textContent=(err&&err.message)||'Unable to complete booking. Please try again or call the office.';
 }).finally(function(){state.bookingBusy=false;fd331El('bookingInputs').disabled=!!state.bookingCommitted;fd331El('btnSubmit').textContent=state.bookingCommitted?'Continue registration':'Book appointment';fd331Render();});
}
// Emailed confirmation links (sent before this change, and orthotics pickup
// invitations) open scheduling in this tab. Tokens remain in memory only.
function fd331Approval(){
 var fragment=window.lexBookingVerificationFragment||location.hash;delete window.lexBookingVerificationFragment;
 var match=fragment.match(/^#verify=(VR-[a-f0-9]{32})\.([a-f0-9]{64})(?:\.(ip|vv))?$/);if(!match)return false;
 history.replaceState(null,'',location.pathname);
 document.querySelector('main').insertAdjacentHTML('beforeend','<section class="booking-section" id="fd331Approval" style="margin:0 28px 28px"><div class="booking-eyebrow">CONTINUE YOUR BOOKING</div><h2 id="fd331ApprovalTitle">Welcome back</h2><p id="fd331OpeningNote">We’re opening your appointment times…</p><button class="btn btn-ink" id="fd331Approve" type="button" hidden>Try again</button><p id="fd331ApprovalStatus" role="status"></p><p><a href="booking.html">Start again</a></p></section>');
 document.querySelector('.booking-main').hidden=true;
 fd331El('fd331Approve').onclick=async function(){
  var button=fd331El('fd331Approve');if(button.disabled)return;button.disabled=true;button.hidden=true;fd331El('fd331ApprovalStatus').textContent='Confirming…';
  try{
   var result=await call271({action:'magic-approve',requestId:match[1],token:match[2],continuationVersion:2});
   if(result.success&&result.booked){fd331El('fd331OpeningNote').hidden=true;fd331El('fd331ApprovalTitle').textContent='Booking already received';fd331El('fd331ApprovalStatus').textContent='This link has already been used for a booking. Please check your confirmation. Need help? Call (212) 510-8665.';return;}
   if(!result.success||!result.approved||!result.verified||!result.session)throw new Error(result.error||'We could not continue your booking. Please try again.');
   var expiry=Date.parse(result.expiresAt);if(!isFinite(expiry)||expiry<=Date.now())throw new Error('This confirmation expired. Please start again.');
   state.websiteBookingId=result.websiteBookingId;
   // The private router sets the pickup purpose after confirming the email link.
   state.bookingPurpose=result.bookingPurpose||'';
   state.patientType='returning';state.visitMode=fd331Pickup()||match[3]==='ip'?'In Person':match[3]==='vv'?'Virtual':null;
   state.verificationSession=result.session;state.verifiedName=result.firstName+' '+result.lastName;state.verifiedEmail='';state.verifiedPhone='';fd331.sessionExpires=expiry;
   ['First','Last','Dob'].forEach(function(part){var value=part==='First'?result.firstName:part==='Last'?result.lastName:result.dob;fd331El('np'+part).value=value;fd331El('rp'+part).value=value;});
   fd333.status='linked';fd333.viaEmail=true;fd333.firstName=result.firstName;fd333.key=fd333Key();
   fd331El('fd331Approval').hidden=true;document.querySelector('.booking-main').hidden=false;
   fd331Initialize();fd331Slots();
  }catch(err){fd331El('fd331OpeningNote').hidden=true;fd331El('fd331ApprovalStatus').textContent=err.message;button.disabled=false;button.hidden=false;}
 };
 fd331El('fd331Approve').onclick();
 return true;
}
// Bubble choices edit the existing draft; no writes or navigation.
function fd332Edit(section){
 if(state.bookingBusy||state.bookingCommitted||(fd331Pickup()&&section!=='time'&&section!=='confirm'))return;
 if(section==='confirm'){
  fd332.edit='';fd331Render();fd331El('btnSubmit').focus();return;
 }
 fd332.edit=section;fd331Render();
}
function renderBookingProgress({type,mode,matched,ready,showBooking,details,confirming,done}){
 // Details come first: they decide whether this is a first visit or a follow-up.
 var pickup=fd331Pickup();
 var identity={section:'info',text:!matched?'Your details':type==='returning'?'Record linked':'First visit',disabled:pickup,controls:'identitySection'};
 var time={section:'time',text:state.selectedSlot?.label||'Choose a time',disabled:!matched,controls:'panel3'};
 var confirm={section:'confirm',disabled:!ready||!state.selectedSlot,controls:'bookingFinish'};
 var current=!showBooking?'':confirming?'confirm':details?'info':'time';

 fd331El('bookingPath').hidden=!mode||done;
 fd331El('pathTrack').hidden=!mode;
 fd331El('pathType').hidden=!matched;
 fd331El('pathType').textContent=pickup?'Orthotics pickup':type==='returning'?'Follow-up':'First visit';
 fd331El('pathType').disabled=true;
 fd331El('pathMode').textContent=mode==='Virtual'?'Video visit':mode?'In person':'Choose visit mode';
 fd331El('pathMode').disabled=pickup;
 fd331El('pathFirstText').textContent=identity.text;
 fd331El('pathSecondText').textContent=time.text;

 [['pathFirst',identity],['pathSecond',time],['pathConfirm',confirm]].forEach(function([id,step]){
  var button=fd331El(id);
  button.dataset.section=step.section;
  button.disabled=step.disabled;
  button.setAttribute('aria-controls',step.controls);
  button.setAttribute('aria-current',step.section===current?'step':'false');
  button.classList.toggle('current',step.section===current);
 });
}
function fd332Flow(){
 var done=state.currentStep===5,type=state.patientType,mode=state.visitMode,matched=fd333Matched();
 var ready=matched&&!!mode&&(type==='returning'?fd331Verified():fd331ValidNew());
 var askMode=!mode||fd332.edit==='mode';
 var showBooking=!askMode&&!done;
 var details=!matched||fd332.edit==='info';
 var showTimes=matched&&fd332.edit!=='info';
 var showConfirmation=showBooking&&showTimes&&ready&&!!state.selectedSlot&&fd332.edit!=='time';
 fd331El('visitModeQuestion').hidden=!askMode;
 fd331El('identitySection').hidden=!showBooking||!details;
 fd331El('panel2New').hidden=false;
 fd331El('panel2Returning').hidden=true;
 fd331El('patientMatchStatus').hidden=!showBooking||!matched;
 fd331El('panel3').hidden=!showBooking||!showTimes;
 fd331El('bookingSlotModes').hidden=!matched||fd331Pickup();
 fd331El('bookingSlotTimeZone').textContent=type==='new'?'First-visit times · Eastern time':type==='returning'?'Follow-up times · Eastern time':'All times are Eastern.';
 fd331El('bookingFinish').hidden=!showConfirmation;
 renderBookingProgress({type,mode,matched,ready,showBooking,details,confirming:showConfirmation&&fd332.edit!=='info',done});
 fd331El('bookingConnectionStatus').hidden=askMode;
}
// Compatibility hooks used by the shared slot renderer and booking response handler.
renderBookingCards=fd331Render;setStep=fd331SetStep;showReturningVerification_=fd331VerificationExpired;updatePatientSummary=fd331Render;
function fd331Initialize(){
 FD333_DETAIL_IDS.concat(['rpFirst','rpLast','rpDob']).forEach(function(id){fd331El(id).addEventListener('input',fd333DetailsChanged);});
 document.querySelectorAll('input[name="npSex"]').forEach(function(input){input.addEventListener('change',fd333DetailsChanged);});
 initialiseInternationalPhone_();loadBookingConfig();fd331Render();
}
function fd333DetailsChanged(){
 if(state.bookingBusy||state.bookingCommitted)return;
 state.bookingPayload=null;
 if(fd333.status&&fd333.status!=='error'){fd333Reset();fd332.edit='info';fd331Slots();return;}
 if(fd333.status==='error'){fd333.status='';fd333.message='';}
 fd331Render();
}

// Shared booking links preselect the visit mode. Whether the visit is a first
// visit or a follow-up is decided by the record check, not by the link.
function applyBookingLinkPreferences(search){
 const params=new URLSearchParams(search);
 const visit=params.get('visit')??'new';
 if(visit!=='new'&&visit!=='returning')return;
 const mode=params.get('mode');
 if(mode!=='in-person'&&mode!=='video')return;
 const slot=params.get('slot');
 if(visit==='new' && slot && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(slot)) linkedBookingSlot=Date.parse(slot)||null;
 const option=document.querySelector(mode==='in-person'?'#newModeGrid [data-mode="In Person"]':'#newModeGrid [data-mode="Virtual"]');
 if(option)fd331SelectMode(option);
}

if(!fd331Approval()){
 fd331Initialize();
 applyBookingLinkPreferences(location.search||'');
}
