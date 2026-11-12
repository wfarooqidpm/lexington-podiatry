/* Owner decision 2026-11-12: a booking label is not a clinical history.
 * Today's visit is required independently of optional medical information.
 * No symptom, side, duration or negative finding is selected by default. */
var FDVisit = (function(){
 var problems=['Fungal toenail','Ingrown toenail','Loose toenail','Heel pain','Painful callus','Skin lesion','Foot pain','Foot fracture / suspected fracture','Painful bunion','Painful hammertoe','Underlapping / overlapping toe','Ankle sprain','Leg cramping','Blister','Other'];
 var labels={problem:'What brings you in?',description:'Please describe your concern',side:'Which side?',location:'Where exactly?',toe:'Which toe?',border:'Which nail edge?',symptoms:'What does it feel or look like?',onset:'How did it start?',duration:'How long has this been going on?',course:'Since it started, is it…',worse:'What makes it worse?',better:'What makes it better?',treatment:'What have you tried, and did it help?'};
 function nail(h){return /toenail|hammertoe|lapping/.test(h.problem||'');}
 function keys(h){return ['problem','side','location','symptoms','onset','duration','course','worse','better','treatment'].concat(h.problem==='Other'?['description']:[],nail(h)?['toe']:[],h.problem==='Ingrown toenail'?['border']:[]);}
 function missing(h){h=h||{};return keys(h).filter(function(k){return !String(h[k]||'').trim()||(k==='problem'&&problems.indexOf(h.problem)<0);});}
 function summary(h){h=h||{};var order=['problem','description','side','location','toe','border','symptoms','onset','duration','course','worse','better','treatment'];var titles={problem:'Concern',description:'Description',side:'Side',location:'Location',toe:'Toe',border:'Nail edge',symptoms:'Symptoms',onset:'Onset',duration:'Duration',course:'Course',worse:'Worse with',better:'Better with',treatment:'Treatment tried'};return order.filter(function(k){return keys(h).indexOf(k)>=0&&String(h[k]||'').trim();}).map(function(k){return titles[k]+': '+String(h[k]).trim();}).join('\n');}
 function history(){var h={};Object.keys(labels).forEach(function(k){var el=document.getElementById('visit-'+k);if(el)h[k]=el.value.trim();});return h;}
 function install(){
  var originalBuild=fd230Build;
  fd230Build=function(){
   FD230.keys=['personal','insurance','visit','contract','additional'];FD230.labels=['My information','Insurance',"Today's visit",'Contract','Medical information'];
   // The existing builder owns all autosave and concurrent-edit listeners.
   // Give it a panel to place using its standard section structure.
   var stub=document.createElement('section');stub.className='panel';stub.dataset.panel='7';q('.layout > div').appendChild(stub);
   originalBuild();
  };
  var originalInit=fd250Init;
  fd250Init=function(){originalInit();mount();};
  var originalCollect=collect;
  collect=function(){var d=originalCollect();if(document.getElementById('visit-problem')){var h=history();d.visitHistory=h;d.visitHistoryVersion=1;d.visitReasons=h.problem?[h.problem==='Other'?'Other: '+h.description:h.problem]:[];d.hpi=summary(h)+(clean($('hpi').value)?'\nAdditional details: '+clean($('hpi').value):'');}return d;};
  var originalSave=fd230Save;
  fd230Save=function(section,submit){
   if(submit&&(section==='visit'||section==='contract')){var absent=missing(history());if(absent.length){$('sectionNote-'+section).textContent='Please complete the required questions in Today’s visit.';fd230Open('visit');var first=$('visit-'+absent[0]);if(first){first.setAttribute('aria-invalid','true');first.focus();}return;}}
   return originalSave(section,submit);
  };
  var originalReady=fd254Ready;
  fd254Ready=function(){var d=FD.data||{},p=d.sectionProgress||{};return !!(p.visit&&p.visit.submittedAt&&!missing(d.visitHistory).length&&originalReady());};
  var originalShow=fd230ShowRegistrationReceived;
  fd230ShowRegistrationReceived=function(){originalShow();var n=$('registrationReceived');if(n){var ready=FD.data.sectionProgress&&FD.data.sectionProgress.visit&&FD.data.sectionProgress.visit.submittedAt&&!missing(FD.data.visitHistory).length;n.querySelector('h2').textContent=ready?'Contract received':'Contract received · visit questions needed';n.querySelector('p').textContent=ready?'Your signed contract is saved. You can review your information below.':'Please complete Today’s visit to finish your registration.';}};
 }
 function mount(){
  if($('visit-problem'))return;
  var box=$('section-visit'),body=box.querySelector('.section-body'),content=document.createElement('div');
  content.innerHTML='<p class="intro">Tell us about the concern you want addressed. All questions below are required. You may answer “none” or “not sure” when appropriate.</p>';
  var options={problem:problems,side:['Left','Right','Both','Not sure'],onset:['Gradually','Suddenly','After an injury','Not sure'],course:['Getting worse','Getting better','About the same','Coming and going','Not sure'],toe:['Big toe','2nd toe','3rd toe','4th toe','5th toe','Multiple toes','Not sure'],border:['Edge toward the other foot','Edge toward the little toe','Both edges','Not sure']};
  var stored=FD.data.visitHistory||{};
  Object.keys(labels).forEach(function(k){var field=document.createElement('div');field.className='field';field.id='visit-field-'+k;var label=document.createElement('label');label.htmlFor='visit-'+k;label.textContent=labels[k]+' *';field.appendChild(label);var el=document.createElement(options[k]?'select':'input');el.id='visit-'+k;el.required=true;el.maxLength=500;if(options[k]){var empty=document.createElement('option');empty.value='';empty.textContent='Select';el.appendChild(empty);options[k].forEach(function(v){var o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o);});}else{el.type='text';el.placeholder=k==='duration'?'e.g., 3 weeks, several years, or not sure':k==='better'||k==='worse'||k==='treatment'?'Describe, or enter none / not sure':'';}el.value=stored[k]||'';field.appendChild(el);content.appendChild(field);});
  // Preserve pre-existing narrative separately; never infer structured findings.
  var oldChoices=$('visitReasonChoices');if(oldChoices)oldChoices.remove();var oldVisit=$('bookingReason').closest('.section');oldVisit.classList.add('hidden');
  var detail=$('hpi').closest('.field');detail.querySelector('label').textContent='Additional visit details (optional)';if(FD.data.visitHistoryVersion!==1)$('hpi').value=FD.data.hpi||'';else $('hpi').value=FD.data.visitAdditional||'';content.appendChild(detail);
  var originalCollect=collect;collect=function(){var d=originalCollect();d.visitAdditional=$('hpi').value.trim();return d;};
  body.insertBefore(content,body.firstChild);$('sectionSubmit-visit').textContent='Save visit & continue';
  $('section-contract').querySelector('.section-number').textContent='4';
  // Later optional-medical initialization uses a fixed label slot; restore keys.
  FD230.labels=['My information','Insurance',"Today's visit",'Contract','Medical information'];
  function conditional(){var h=history();['description','toe','border'].forEach(function(k){var needed=keys(h).indexOf(k)>=0;$('visit-field-'+k).classList.toggle('hidden',!needed);$('visit-'+k).required=needed;});}
  $('visit-problem').addEventListener('change',conditional);conditional();
  q('.hero p').textContent='Complete your information, insurance, today’s visit, and contract. Medical information is optional.';
  // Summary editing routes back to the required structured section.
  var baseSummary=fd254Summary;fd254Summary=function(){baseSummary();var edit=$('completedMedicalCard')&&$('completedMedicalCard').querySelector('[data-save="visit"]');if(edit){var area=edit.closest('.snapshot-edit-body');area.replaceChildren();var text=document.createElement('p');text.textContent=collect().hpi;var update=document.createElement('button');update.type='button';update.className='btn secondary';update.textContent='Update visit details';update.onclick=function(){document.body.classList.remove('medical-summary-ready');$('completedMedicalCard').classList.add('hidden');fd230Open('visit');};area.append(text,update);}};
  var refresh=$('sectionRefresh-visit');if(refresh)refresh.remove();
  fd230Render();
 }
 return {problems:problems,missing:missing,summary:summary,install:install};
})();
