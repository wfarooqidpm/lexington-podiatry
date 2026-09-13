var bridge271={channel:null,ready:null,peer:null,origin:null,pending:{},next:0};
function random271(n){var b=new Uint8Array(n);crypto.getRandomValues(b);return Array.from(b,function(v){return v.toString(16).padStart(2,'0');}).join('');}
function connect271(){
  if(bridge271.ready)return bridge271.ready;
  bridge271.channel=random271(16);
  bridge271.ready=new Promise(function(resolve,reject){
    var timer=setTimeout(function(){bridge271.ready=null;reject(new Error('The booking connection is taking longer than expected. Please try again.'));},25000);
    function listener(e){var m=e.data;if(!m||m.channel!==bridge271.channel||!/^https:\/\/[a-z0-9-]+[.-]script\.googleusercontent\.com$/.test(e.origin))return;
      if(m.type==='booking-ready'){clearTimeout(timer);bridge271.peer=e.source;bridge271.origin=e.origin;resolve();}
      if(m.type==='booking-result'&&e.source===bridge271.peer&&e.origin===bridge271.origin){var pending=bridge271.pending[m.id];if(pending){delete bridge271.pending[m.id];clearTimeout(pending.timer);pending.resolve(m.data);}}
    }
    window.addEventListener('message',listener);
    var frame=document.createElement('iframe');frame.hidden=true;frame.title='Secure booking connection';frame.src=GATEWAY_URL+'?action=booking-bridge&channel='+bridge271.channel;document.body.appendChild(frame);
  });return bridge271.ready;
}
function call271(request){return connect271().then(function(){return new Promise(function(resolve,reject){var id=String(++bridge271.next);bridge271.pending[id]={resolve:resolve,timer:setTimeout(function(){delete bridge271.pending[id];reject(new Error('The response is taking longer than expected. Your request may still be processing.'));},45000)};bridge271.peer.postMessage({type:'booking-call',channel:bridge271.channel,id:id,request:request},bridge271.origin);});});}
function bookingFetch271(url,options){var req;if(options&&options.method==='POST'){req=JSON.parse(options.body);}else{req={};new URL(url).searchParams.forEach(function(v,k){req[k]=v;});}return call271(req).then(function(data){return {ok:true,status:200,json:function(){return Promise.resolve(data);}};});}
