const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../frontdoor.html','utf8');
const source=html.slice(html.indexOf('function fd269Pharmacy(summary){'),html.indexOf('\nfunction fd269Schedule(){'));
async function run(name,zip,city,summary=false){
 const elements={pharmacyNameSearch:{value:name},pharmacyZip:{value:zip},pharmacyCity:{value:city},pharmacyState:{value:'NY'},pharmacyResults:{replaceChildren(){}}};
 if(summary){elements['edit-pharmZip']={value:zip};elements['edit-pharmCity']={value:city};elements['edit-pharmState']={value:'NY'};elements.summaryPharmResults={replaceChildren(){}};}
 let url;const ctx={$:id=>elements[id],clean:v=>String(v||'').trim(),FD:{token:'fictional'},GATEWAY_URL:'https://example.test',URLSearchParams,fetch:async u=>{url=u;return {json:async()=>({success:true,results:[]})};}};
 vm.createContext(ctx);vm.runInContext(source,ctx);await ctx.fd269Pharmacy(summary);return url&&new URL(url).searchParams;
}
(async()=>{
 const named=await run(' Parkchester ','10462','');assert.equal(named.get('name'),'Parkchester');assert.equal(named.get('zip'),'10462');
 const city=await run('Parkchester','','Bronx');assert.equal(city.get('name'),'Parkchester');assert.equal(city.get('city'),'Bronx');
 const broad=await run('','10462','');assert.equal(broad.get('name'),'');assert.equal(broad.get('zip'),'10462');
 const summary=await run('stale intake name','10462','',true);assert.equal(summary.get('name'),'','Summary search must not inherit a hidden intake name');
 assert.equal(await run('Parkchester','',''),undefined);console.log('Pharmacy name/location query tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
