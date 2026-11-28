/* Restricted HTML-service response channel for the public booking page. */
function fd271BookingBridgePage_(p) {
  var channel=String(p.channel||'');if(!/^[a-f0-9]{32}$/.test(channel))throw new Error('Invalid channel.');
  var script='(function(){var channel='+JSON.stringify(channel)+',origin="https://lexingtonpodiatry.nyc";function send(m){m.channel=channel;window.top.postMessage(m,origin);}window.addEventListener("message",function(e){var m=e.data;if(e.origin!==origin||e.source!==window.top||!m||m.channel!==channel||m.type!=="booking-call")return;google.script.run.withSuccessHandler(function(data){send({type:"booking-result",id:m.id,data:data});}).withFailureHandler(function(){send({type:"booking-result",id:m.id,data:{success:false,error:"The connection could not complete. Please try again."}});}).bookingBridge271(m.request);});send({type:"booking-ready"});})();';
  return HtmlService.createHtmlOutput('<!doctype html><html><head><meta name="referrer" content="no-referrer"></head><body><script>'+script+'</script></body></html>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function bookingBridge271(request) {
  try {
    if(!request||JSON.stringify(request).length>25000)throw new Error('Invalid request.');
    var a=String(request.action||'');
    if(a==='booking-match')return fdg160PrivateRouterCall_(a,request);
    // 2026-11-28: the website no longer asks first visit or returning. OS2 checks the
    // details against Charm and answers only matched (with a follow-up session) or not.
    if(a==='patient-match')return fd280PatientMatch_(request);
    if(a==='frontdoor-route')return fd272FrontDoorRoute_(request);
    if(['health','booking-config','slots','load'].indexOf(a)>=0)return JSON.parse(doGet({parameter:request}).getContent());
    if(['magic-start','magic-approve','magic-poll'].indexOf(a)>=0)return fdg160PrivateRouterCall_(a,request);
    if(['followup-verification-start','followup-verification-confirm','website-book'].indexOf(a)>=0)return JSON.parse(doPost({postData:{contents:JSON.stringify(request)}}).getContent());
    throw new Error('Unsupported booking request.');
  } catch(err){return {success:false,error:fdg080PublicError_(err)};}
}

// Token-bound check; no patient identifiers or booking-supplied completion claims are trusted.
function fd272FrontDoorRoute_(request) {
  var token=fdg080ValidateToken_(request.token||request.t||'');
  var context={startedAt:Date.now(),timings:{},sheets:{},ok:false};
  var source=fdg080FindSourceByToken_(token,context);
  if(!fdg120IsFollowUpSource_(source))return {success:true,medicalCard:false};
  var current=fdg080ReadIntake_(token,context);
  var resolved=fdg240Prefill_(source,current,context).intake;
  return {success:true,medicalCard:fd272CardReady_(resolved)};
}
function fd272CardReady_(intake) {
  if(!intake||intake.parseError||!intake.agreementPdfFileId)return false;
  var p=(intake.data||{}).sectionProgress||{};
  return !!intake.completedAt||['personal','insurance','additional'].every(function(k){return !!(p[k]&&p[k].submittedAt);});
}

function fd280PatientMatch_(request) {
  if(!fdg160WebsiteVerificationEnabled_())throw new Error('Online follow-up booking is unavailable. Please call the office.');
  var r=fdg160PrivateRouterCall_('patient-match',{
    firstName:fdg080Clean_(request.firstName),lastName:fdg080Clean_(request.lastName),
    dob:fdg080DateOnly_(request.dob),phone:fdg080Clean_(request.phone),email:fdg080Clean_(request.email).toLowerCase()
  });
  if(!r||r.success!==true)return {success:false,error:(r&&r.error)||'We couldn’t check your details just now. Please try again or call (212) 510-8665.'};
  // Pass on only the decision; nothing else from OS2 reaches the browser.
  if(r.matched!==true)return {success:true,matched:false};
  if(!/^[a-f0-9]{64}$/.test(String(r.session||''))||!r.expiresAt)return {success:false,error:'We couldn’t check your details just now. Please try again or call (212) 510-8665.'};
  return {success:true,matched:true,session:r.session,expiresAt:String(r.expiresAt)};
}
