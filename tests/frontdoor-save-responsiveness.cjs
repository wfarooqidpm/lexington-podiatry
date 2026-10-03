const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const source=fs.readFileSync('frontdoor.html','utf8');
function fixture(){
 const nodes={};const c={FD:{data:{sectionProgress:{}}},FD230:{signed:false,submitting:{},timers:{},serial:{},edits:{personal:1,insurance:0},keys:['personal','insurance','contract','additional'],queue:Promise.resolve()},collect:()=>({firstName:'Test',lastName:'Person',dob:'1980-01-01',phone:'2125550100',email:'test@example.invalid',address1:'New address',city:'New York',state:'NY',zip:'10016'}),$:id=>nodes[id]||(nodes[id]={textContent:'Save',setAttribute(){},removeAttribute(){}}),setTimeout:()=>1,clearTimeout(){},fd230Render(){},fd230Open(){c.opened=true},fd230Request:()=>new Promise(resolve=>c.resolve=resolve)};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function fd330Enqueue('),source.indexOf('function fd230UploadFiles(')),c);return c;
}
test('save response cannot mark newer typing as submitted or move the patient away',async()=>{
 const c=fixture();c.fd230Save('personal',true);await new Promise(setImmediate);
 c.FD230.edits.personal=2;c.FD.data.addressConfirmed=false;c.collect=()=>({address1:'Newest correction'});
 c.resolve({sectionProgress:{personal:{submittedAt:'2026-01-01'}}});await c.FD230.queue;
 assert.equal(c.FD.data.address1,'Newest correction');assert.equal(c.FD.data.sectionProgress.personal.submittedAt,'');assert.notEqual(c.opened,true);
 assert.equal(c.FD.data.addressConfirmed,false);
});
test('save in another section preserves current text and unsubmitted edits',async()=>{
 const c=fixture();c.fd230Save('insurance',false);await new Promise(setImmediate);
 c.FD230.edits.personal=2;c.collect=()=>({address1:'Typed while saving insurance'});
 c.resolve({sectionProgress:{personal:{submittedAt:'old'},insurance:{savedAt:'now'}}});await c.FD230.queue;
 assert.equal(c.FD.data.address1,'Typed while saving insurance');assert.equal(c.FD.data.sectionProgress.personal.submittedAt,'');
});

