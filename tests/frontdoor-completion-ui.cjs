const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../frontdoor.html','utf8');
const code=html.slice(html.indexOf('function fd230ShowRegistrationReceived(){'),html.indexOf('function fd230MedicalText('));
function fixture(submitted){
 const boxes=Object.fromEntries(['personal','insurance','contract'].map(k=>['section-'+k,{open:true}]));
 boxes.registrationReceived={classList:{add(){}}};
 const c={$:id=>boxes[id],FD:{data:{sectionProgress:submitted}},FD230:{signed:true}};
 vm.createContext(c);vm.runInContext(code,c);return {c,boxes};
}
test('signed registration keeps an unsubmitted personal section reachable',()=>{
 const {c,boxes}=fixture({insurance:{submittedAt:'2026-01-01'}});
 c.fd230ShowRegistrationReceived();
 assert.equal(boxes['section-personal'].open,true);
});
test('rendering after reopening a completed section does not close it again',()=>{
 const {c,boxes}=fixture({personal:{submittedAt:'2026-01-01'},insurance:{submittedAt:'2026-01-01'}});
 c.fd230ShowRegistrationReceived();
 assert.equal(boxes['section-personal'].open,false);
 boxes['section-personal'].open=true;
 c.fd230ShowRegistrationReceived();
 assert.equal(boxes['section-personal'].open,true);
});
