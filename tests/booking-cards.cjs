const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../booking.html'),'utf8');
function fn(name){const start=html.indexOf('function '+name+'(');assert(start>=0,'Missing '+name);const tail=html.slice(start);const next=tail.slice(1).search(/^function /m);return next<0?tail.split('</script>')[0]:tail.slice(0,next+1);}
const elements={};const el=id=>elements[id]||(elements[id]={textContent:'',value:'',hidden:false,disabled:false});
const c={state:{currentStep:3,patientType:'new',selectedSlot:{label:'Monday at 10 AM'},visitMode:'In Person'},document:{getElementById:el},bookingPhoneNumber_:()=>'(212) 555-0100'};vm.createContext(c);vm.runInContext(fn('renderBookingCards'),c);
c.renderBookingCards();assert.equal(el('bookingAppointmentStatus').textContent,'Selected · not booked yet');assert.equal(el('bookingInfoCard').hidden,true);
for(const [id,value] of Object.entries({npFirst:'<img src=x>',npLast:'Morgan',npDob:'1988-04-12',npPhone:'2125550100',npEmail:'alex@example.com'}))el(id).value=value;
c.state.currentStep=4;c.renderBookingCards();assert.equal(el('bookingInfoCard').hidden,false);assert.equal(el('bookingInfoName').textContent,'<img src=x> Morgan');assert.equal(el('bookingInfoStatus').textContent,'Ready to submit');
c.state.bookingCommitted=true;c.renderBookingCards();assert.equal(el('bookingAppointmentStatus').textContent,'✓ Appointment booked');assert.equal(el('bookingEditAppointment').disabled,true);
c.state.currentStep=1;c.renderBookingCards();assert.equal(el('bookingCompletedCards').hidden,true);
c.state.currentStep=2;c.state.patientType='returning';c.state.verifiedName='Verified Patient';c.state.verificationSession='verified';c.renderBookingCards();assert.equal(el('bookingInfoName').textContent,'Verified Patient');
console.log('PASS: summary cards distinguish selected from booked, hide incomplete details, render patient text safely, and lock edits after booking.');
c.state.bookingCommitted=false;c.state.currentStep=3;c.state.patientType='new';c.state.selectedSlot={label:'Old slot'};c.renderBookingCards();assert.equal(el('bookingAppointmentCard').hidden,false);
c.slotDateOrder=['Monday','Tuesday'];c.activeSlotContainerId='slotContainer';c.document.querySelector=()=>null;c.document.querySelectorAll=()=>[];vm.runInContext(fn('jumpToDay'),c);c.jumpToDay('day-1');assert.equal(c.state.selectedSlot,null);assert.equal(el('bookingAppointmentCard').hidden,true);assert.equal(el('btnStep3Next').disabled,true);
console.log('PASS: changing calendar day clears the prior appointment card and disables continuation.');
