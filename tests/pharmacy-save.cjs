const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../frontdoor.html','utf8');
const extract=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const tick=()=>new Promise(r=>setImmediate(r));
async function selectedDetails(){
 const els={},listeners={};
 for(const id of ['pharmacy','pharmacyAddress','pharmacyNpi','pharmacyPhone','pharmacyCity','pharmacyState','pharmacyZip','pharmacyNameSearch','pharmacyResults'])els[id]={value:'',textContent:'',children:[],replaceChildren(){this.children=[]},appendChild(b){this.children.push(b)},addEventListener(e,fn){listeners[id+e]=fn},dispatchEvent(e){listeners[id+e.type]?.(e)}};
 els.pharmacyZip.value='10016';els.pharmacyState.value='NY';
 const ctx={$:id=>els[id],clean:v=>String(v||'').trim(),FD:{token:'fictional',data:{officeSections:{additional:true},sectionProgress:{additional:{submittedAt:'earlier'}}}},GATEWAY_URL:'https://example.test',URLSearchParams,Event,
 setValue:(id,v)=>els[id].value=v||'',renderPharmacySelection(){},renderStatusSidebar(){},fd230Render(){},fd230Save(){},
 document:{createElement:()=>({})},fetch:async()=>({json:async()=>({success:true,results:[{name:'Example Pharmacy',address:'100 Example Street',npi:'1234567890',phone:'555-0100'}]})})};
 vm.createContext(ctx);
 vm.runInContext(html.split('\n').find(l=>l.startsWith("$('pharmacy').addEventListener('input'")),ctx);
 vm.runInContext(extract('function fd269Pharmacy(summary){','function fd269Schedule(){'),ctx);
 await ctx.fd269Pharmacy(false);els.pharmacyResults.children[0].onclick();
 assert.equal(els.pharmacy.value,'Example Pharmacy');
 assert.equal(ctx.FD.data.sectionProgress.additional.submittedAt,'','A changed pharmacy is not yet submitted');
 assert.equal(ctx.FD.data.officeSections.additional,false);
 assert.equal(els.pharmacyAddress.value,'100 Example Street','Selecting a result must retain its address');
 assert.equal(els.pharmacyNpi.value,'1234567890');assert.equal(els.pharmacyPhone.value,'555-0100');
}
async function orderedSave(){
 let finishOld,requests=[];const old=new Promise(r=>finishOld=r),els={completedMedicalCard:{appendChild(){}},cardSaveStatus:{}};
 const ctx={$:id=>els[id],qa:()=>[],collect:()=>({pharmacy:'Example New Pharmacy',pharmacyNpi:'1234567890'}),FD:{data:{}},FD230:{queue:old,timers:{},serial:{}},clearTimeout,
 fd230Request:async(action,section,data)=>{requests.push({action,section,data});return {success:true,sectionProgress:{additional:{submittedAt:'now'}}}},fd254Summary(){}};
 vm.createContext(ctx);vm.runInContext(extract('function fd330Enqueue(', 'function fd230Save('),ctx);vm.runInContext(extract('function fd269SaveCard(section){','function fd269Pharmacy(summary){'),ctx);
 const saved=ctx.fd269SaveCard('additional');await tick();
 assert.equal(requests.length,0,'Card save must wait for an earlier draft to finish');
 finishOld();await saved;
 assert.equal(requests[0].data.pharmacy,'Example New Pharmacy');assert.equal(ctx.FD.data.pharmacy,'Example New Pharmacy');
}
(async()=>{const failures=[];for(const t of [selectedDetails,orderedSave]){try{await t();console.log('PASS',t.name)}catch(e){failures.push(e);console.error('FAIL',t.name,e.message)}}if(failures.length)process.exitCode=1;})();

