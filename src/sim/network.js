import {S, $} from "../core.js";
import {withDevice, sbInit, aclEval, sbConfig, sbRun, SW, netHooks, sbPrompt, short} from "./engine.js";
import {isIp, ip2n, validMask, maskLen, netOf, sameNet, pad} from "./net.js";
import {KINDS} from "../components/device-icons.js";

const NET={name:"Lab 1",devs:[],links:[],nid:1,tl:[],gen:null};
const dev=id=>NET.devs.find(d=>d.id===id);
const ifUp=(d,i)=>{const f=d.o.ifs[i];return!!f&&f.up!==false};
const upLinks=()=>NET.links.filter(l=>{const a=dev(l.a.d),b=dev(l.b.d);return a&&b&&ifUp(a,l.a.i)&&ifUp(b,l.b.i)});
const macOf=d=>"aaaa.bbbb."+String(d.id.replace("d","")).padStart(4,"0");
function mkDev(type,name,x,y,kind){
 const o={};
 if(type==="router"||type==="switch"){
  sbInit(o,type);o.host=name;
  if(type==="router")o.ifs["GigabitEthernet0/2"]={ip:"",mask:"",up:false,nat:"",acl:{}};
  else["FastEthernet0/1","FastEthernet0/2","FastEthernet0/3","FastEthernet0/4","GigabitEthernet0/1"].forEach(k=>o.ifs[k]={up:true,mode:"access",vlan:1,native:1,allowed:"all"});
 }else Object.assign(o,{dev:type,host:name,ifs:{eth0:{ip:"",mask:"",gw:"",dns:"",up:true}},lines:[],hist:[],hi:0});
 return{id:"d"+(NET.nid++),type,kind:kind||type,name,x,y,o};
}
function segments(){
 const par={},f=x=>par[x]===undefined||par[x]===x?(par[x]=x):(par[x]=f(par[x])),u=(a,b)=>{par[f(a)]=f(b)};
 const vx=(d,i)=>{const dd=dev(d);if(dd.type!=="switch")return"e:"+d+":"+i;const p=dd.o.ifs[i];return p.mode==="trunk"?null:"s:"+d+":"+p.vlan};
 const ok=(p,v)=>p.allowed==="all"||String(p.allowed).split(",").map(x=>x.trim()).includes(String(v));
 upLinks().forEach(l=>{
  const A=dev(l.a.d),B=dev(l.b.d),pa=A.o.ifs[l.a.i],pb=B.o.ifs[l.b.i];
  if(A.type==="switch"&&B.type==="switch"&&pa.mode==="trunk"&&pb.mode==="trunk"){
   const vl=new Set([...Object.keys(A.o.vlans),...Object.keys(B.o.vlans)]);
   vl.forEach(v=>{if(ok(pa,v)&&ok(pb,v))u("s:"+A.id+":"+v,"s:"+B.id+":"+v)});
  }else if(A.type==="switch"&&B.type==="switch"&&pa.mode==="access"&&pb.mode==="access"&&pa.vlan===pb.vlan)u("s:"+A.id+":"+pa.vlan,"s:"+B.id+":"+pb.vlan);
  else{const x=vx(A.id,l.a.i),y=vx(B.id,l.b.i);if(x&&y)u(x,y)}
 });
 return{seg:(d,i)=>{const v=vx(d,i);return v?f(v):null}};
}
function owners(ip){const r=[];NET.devs.forEach(d=>{if(d.type==="switch")return;Object.entries(d.o.ifs).forEach(([i,f])=>{if(f.ip===ip&&ifUp(d,i))r.push({d,i})})});return r}
function swPath(a,b){
 if(a===b)return[];const q=[[a]],seen=new Set([a]),L=upLinks();
 while(q.length){const p=q.shift(),cur=p[p.length-1];
  for(const l of L){const o=l.a.d===cur?l.b.d:l.b.d===cur?l.a.d:null;if(!o||seen.has(o))continue;
   if(o===b)return p.slice(1);
   if(dev(o).type==="switch"){seen.add(o);q.push([...p,o])}}}
 return[];
}
const classNet=ip=>{const a=+ip.split(".")[0];return netOf(ip,a<128?"255.0.0.0":a<192?"255.255.0.0":"255.255.255.0")};
const rid=r=>{const o=r.o.os;if(o&&o.rid)return o.rid;const ips=Object.values(r.o.ifs).map(f=>f.ip).filter(Boolean).sort((a,b)=>ip2n(b)-ip2n(a));return ips[0]||"0.0.0.0"};
function routing(){
 const S=segments(),R=NET.devs.filter(d=>d.type==="router");
 R.forEach(r=>{r.dyn=[];r.nbr={ospf:[],eigrp:[],rip:[]}});
 const nn=n=>String(n).replace(/\D*(\d+\/\d+)/,"$1"),wild=(a,w,ip)=>(((ip2n(ip)^ip2n(a))&~ip2n(w))>>>0)===0;
 const items=r=>Object.entries(r.o.ifs).filter(([i,f])=>f.ip&&ifUp(r,i)).map(([i,f])=>({r,i,f,seg:S.seg(r.id,i),net:netOf(f.ip,f.mask),len:maskLen(f.mask)}));
 const P={
  ospf:it=>{const o=it.r.o.os;if(!o||!o.pid)return null;const n=o.nets.map(s=>s.split(" ")).find(a=>wild(a[0],a[1],it.f.ip));return n?{area:n[3],passive:(o.pass||[]).some(x=>nn(x)===nn(it.i))}:null},
  rip:it=>{const o=it.r.o.rp;return o&&o.on&&o.nets.some(n=>classNet(it.f.ip)===n)?{}:null},
  eigrp:it=>{const o=it.r.o.ei;if(!o||!o.as)return null;return o.nets.some(s=>{const a=s.split(" ");return a[1]?wild(a[0],a[1],it.f.ip):classNet(it.f.ip)===a[0]})?{as:o.as}:null}};
 const CODE={ospf:"O",rip:"R",eigrp:"D"},AD={ospf:110,rip:120,eigrp:90},best=new Map();
 ["ospf","rip","eigrp"].forEach(p=>{
  const all=[];R.forEach(r=>items(r).forEach(it=>{const pa=P[p](it);if(pa)all.push({...it,pa})}));
  const adj={};R.forEach(r=>adj[r.id]=[]);
  for(let a=0;a<all.length;a++)for(let b=a+1;b<all.length;b++){
   const x=all[a],y=all[b];
   if(x.r===y.r||x.pa.passive||y.pa.passive||!x.seg||x.seg!==y.seg||x.net!==y.net||x.len!==y.len)continue;
   if(p==="ospf"&&x.pa.area!==y.pa.area)continue;if(p==="eigrp"&&x.pa.as!==y.pa.as)continue;
   adj[x.r.id].push({n:y.r,ia:x,ib:y});adj[y.r.id].push({n:x.r,ia:y,ib:x});
   x.r.nbr[p].push({id:rid(y.r),addr:y.f.ip,ifc:x.i,state:p==="ospf"?"FULL":"UP"});
   y.r.nbr[p].push({id:rid(x.r),addr:x.f.ip,ifc:y.i,state:p==="ospf"?"FULL":"UP"});
  }
  R.forEach(src=>{
   const dist={[src.id]:0},first={},q=[src],mine=items(src);
   while(q.length){const c=q.shift();adj[c.id].forEach(e=>{if(dist[e.n.id]!==undefined)return;if(p==="rip"&&dist[c.id]+1>=15)return;dist[e.n.id]=dist[c.id]+1;first[e.n.id]=c===src?e:first[c.id];q.push(e.n)})}
   all.forEach(it=>{
    if(it.r===src||dist[it.r.id]===undefined||!first[it.r.id])return;
    if(mine.some(m=>m.net===it.net&&m.len===it.len))return;
    if((src.o.routes||[]).some(x=>x.net===it.net&&maskLen(x.mask)===it.len))return;
    const e=first[it.r.id],key=src.id+"|"+it.net+"|"+it.len,cur=best.get(key),rec={code:CODE[p],net:it.net,mask:it.f.mask,ad:AD[p],metric:dist[it.r.id]+1,nh:e.ib.f.ip,ifc:e.ia.i,r:src};
    if(!cur||rec.ad<cur.ad||(rec.ad===cur.ad&&rec.metric<cur.metric))best.set(key,rec);
   });
  });
 });
 best.forEach(x=>{const r=x.r;delete x.r;r.dyn.push(x)});
}
function rtable(r){
 const o=r.o,E=[];
 Object.entries(o.ifs).forEach(([i,f])=>{if(f.ip&&ifUp(r,i))E.push({code:"C",net:netOf(f.ip,f.mask),mask:f.mask,ifc:i,nh:null,ad:0,metric:0})});
 const cn=E.slice();
 (o.routes||[]).forEach(x=>{const c=cn.find(y=>sameNet(o.ifs[y.ifc].ip,x.nh,y.mask));if(c)E.push({code:x.net==="0.0.0.0"&&x.mask==="0.0.0.0"?"S*":"S",net:x.net,mask:x.mask,ifc:c.ifc,nh:x.nh,ad:1,metric:0})});
 (r.dyn||[]).forEach(x=>E.push({...x}));
 return E.map(e=>({...e,len:maskLen(e.mask)}));
}
function lookup(r,ip){let b=null;rtable(r).forEach(e=>{if(netOf(ip,e.mask)!==e.net)return;if(!b||e.len>b.len||(e.len===b.len&&e.ad<b.ad))b=e});return b}
const arpSet=(d,ip,own)=>{d.arp=d.arp||{};d.arp[ip]=macOf(own)};
const nnum=n=>String(n).replace(/\D*(\d+\/\d+)/,"$1");
const ifOn=(l,id)=>l.a.d===id?l.a.i:l.b.i;
const linkIdx=(a,b)=>NET.links.findIndex(l=>(l.a.d===a&&l.b.d===b)||(l.a.d===b&&l.b.d===a));
function fwd(sd,si,dstIp0,srcIp,proto,port,ev,dir,tag){
 let dstIp=dstIp0;
 const ids=[sd.id],names=[sd.name],l3=[],pkt={src:srcIp,dst:dstIp,proto,port:port||0},KIND=(proto||"icmp").toUpperCase(),PRN=KIND+(pkt.port?"/"+pkt.port:"");
 const what=KIND==="ICMP"?(dir==="reply"?"ICMP echo reply":"ICMP echo request"):(dir==="reply"?KIND+" reply":KIND+" segment");
 let ttl=64,prev=null,natTag=null;
 const E=(status,at,title,x={})=>{if(ev)ev.push({kind:KIND,dir,status,at:at.id,last:prev,title,src:pkt.src,dst:pkt.dst,ttl,...x});prev=at.id};
 const fail=(d,reason,steps,noEv)=>{if(!noEv)E("drop",d,"Paket dibuang di "+d.name,{reason,steps:steps||[]});return{ok:false,ids,hops:names,at:d.name,atId:d.id,reason,ttl,l3,src:pkt.src}};
 const done=(d,i,extra)=>({ok:true,ids,hops:names,ttl,to:d,ti:i,l3:extra||l3,src:pkt.src,srcSeen:pkt.src,natTag});
 const step=(from,fi,nextIp)=>{
  const S=segments(),sg=S.seg(from.id,fi),hop=sg&&owners(nextIp).find(o=>!(o.d===from&&o.i===fi)&&S.seg(o.d.id,o.i)===sg),cached=!!(from.arp&&from.arp[nextIp]),fip=from.o.ifs[fi].ip;
  if(!hop){const m="ARP failed: no device answers for "+nextIp+" on "+short(fi)+". Check the cable, interface status (no shutdown), VLAN, and IP address.";if(!cached)E("drop",from,"ARP request tanpa jawaban",{kind:"ARP",src:fip,dst:nextIp,srcMac:macOf(from),dstMac:"ffff.ffff.ffff",outIf:fi,reason:m,steps:[{k:"ARP",ok:false,t:"Tidak ada perangkat dengan IP "+nextIp+" di segmen L2 ini"}]});return{err:m,noEv:!cached}}
  const pth=swPath(from.id,hop.d.id),chain=[from.id,...pth,hop.d.id];
  if(!cached){
   E("info",hop.d,"ARP request: siapa memiliki "+nextIp+"?",{kind:"ARP",last:from.id,src:fip,dst:nextIp,srcMac:macOf(from),dstMac:"ffff.ffff.ffff",outIf:fi,path:chain,steps:[{k:"ARP",ok:true,t:"Cache ARP belum punya "+nextIp+", mengirim broadcast"}]});
   E("ok",from,"ARP reply: "+nextIp+" ada di "+macOf(hop.d),{kind:"ARP",last:hop.d.id,src:nextIp,dst:fip,srcMac:macOf(hop.d),dstMac:macOf(from),path:[...chain].reverse(),steps:[{k:"ARP",ok:true,t:"Entri ARP disimpan: "+nextIp+" = "+macOf(hop.d)}]});
  }
  prev=from.id;
  pth.forEach((sid,k)=>{const sw=dev(sid),inL=NET.links[linkIdx(chain[k],sid)],outL=NET.links[linkIdx(sid,chain[k+2])],inIf=ifOn(inL,sid),outIf=ifOn(outL,sid),p=sw.o.ifs[inIf],vl=p.mode==="trunk"?"trunk":"VLAN "+p.vlan;
   ids.push(sid);names.push(sw.name);E("ok",sw,"Frame diteruskan oleh "+sw.name,{inIf,outIf,srcMac:macOf(from),dstMac:macOf(hop.d),steps:[{k:"Switching",ok:true,t:"Masuk "+short(inIf)+" ("+vl+"), keluar "+short(outIf)}]})});
  ids.push(hop.d.id);names.push(hop.d.name);
  arpSet(from,nextIp,hop.d);arpSet(hop.d,fip,from);
  return{hop,chain};
 };
 let cur,curIf;
 if(sd.type!=="router"){
  const f=sd.o.ifs[si],st=[];
  if(!f.ip||!isIp(f.ip)){st.push({k:"Konfigurasi sumber",ok:false,t:"IP address belum diatur"});return fail(sd,"Source has no valid IP address.",st)}
  st.push({k:"Konfigurasi sumber",ok:true,t:f.ip+"/"+(f.mask&&validMask(f.mask)?maskLen(f.mask):"?")});
  const same=f.mask&&sameNet(f.ip,dstIp,f.mask),nh=same?dstIp:f.gw;
  if(!nh||!isIp(nh)){st.push({k:"Subnet",ok:false,t:dstIp+" di luar subnet dan tidak ada default gateway"});return fail(sd,"No default gateway is configured, so "+dstIp+" (outside the local network) cannot be reached.",st)}
  if(!f.mask||!sameNet(f.ip,nh,f.mask)){st.push({k:"Subnet",ok:false,t:"Gateway "+nh+" tidak satu jaringan dengan "+f.ip});return fail(sd,"Default gateway "+nh+" is not in the same network as "+f.ip+".",st)}
  st.push({k:"Subnet",ok:true,t:same?"Tujuan satu subnet, dikirim langsung":"Tujuan beda subnet, dikirim ke gateway "+nh});
  E("info",sd,"Membuat "+what,{srcMac:macOf(sd),nextHop:nh,outIf:si,steps:st});
  const r=step(sd,si,nh);if(r.err)return fail(sd,r.err,[],r.noEv);
  const h=r.hop;
  if(h.d.type!=="router"){const ok=h.d.o.ifs[h.i].ip===dstIp;if(!ok)return fail(h.d,"Destination "+dstIp+" does not match this device.",[]);E("ok",h.d,"Diterima oleh "+h.d.name+": "+what,{inIf:h.i,steps:[{k:"Tujuan",ok:true,t:"IP tujuan cocok dengan "+short(h.i)},{k:"Pemrosesan",ok:true,t:KIND==="ICMP"?(dir==="reply"?"Echo reply diterima":"Akan membalas dengan echo reply"):"Simulator tidak memodelkan layanan di port; paket dianggap diterima"}]});return done(h.d,h.i,[{name:h.d.name,ip:dstIp}])}
  cur=h.d;curIf=h.i;
 }else{cur=sd;curIf=null;E("info",sd,"Membuat "+what,{steps:[{k:"Asal",ok:true,t:"Paket berasal dari router ini"}]})}
 for(let n=0;n<16;n++){
  const R=cur,ar=curIf?R.o.ifs[curIf]:null,steps=[];
  l3.push({name:R.name,ip:ar?ar.ip:""});
  if(ar)steps.push({k:"Interface masuk",ok:true,t:short(curIf)+" ("+ar.ip+"/"+maskLen(ar.mask)+")"});
  if(ar){const id=(ar.acl||{}).in;if(id){const v=withDevice(R.o,()=>aclEval(id,pkt));steps.push({k:"ACL masuk",ok:v.ok,t:"ACL "+id+": "+(v.ok?"PERMIT":"DENY")+" ("+v.line+")"});if(!v.ok)return fail(R,"ACL "+id+" denied "+PRN+" on "+short(curIf)+" (in): "+v.line,steps)}}
  let self=Object.entries(R.o.ifs).find(([i,f])=>f.ip===dstIp&&ifUp(R,i));
  if(self){const tab=(R.o.nattab||[]).find(e=>e.pro===(proto||"icmp")&&e.ig.split(":")[0]===dstIp&&(!tag||e.ig===tag)&&e.ol.split(":")[0]===pkt.src);if(tab){const il=tab.il.split(":")[0];steps.push({k:"NAT",ok:true,t:"Reverse NAT: "+tab.ig+" → "+tab.il});dstIp=il;pkt.dst=il;self=null}}
  if(self){steps.push({k:"Tujuan",ok:true,t:"IP tujuan adalah milik "+R.name+" ("+short(self[0])+")"});E("ok",R,"Diterima oleh "+R.name+": "+what,{inIf:curIf,steps});return done(R,self[0])}
  ttl--;steps.push({k:"TTL",ok:ttl>0,t:"TTL "+(ttl+1)+" → "+ttl});if(ttl<=0)return fail(R,"TTL expired.",steps);
  const rt=lookup(R,dstIp);
  if(!rt){steps.push({k:"Routing",ok:false,t:"Tidak ada route cocok untuk "+dstIp});return fail(R,"No route to destination "+dstIp+". "+R.name+" has no matching entry in its routing table.",steps)}
  const of=R.o.ifs[rt.ifc];if(!pkt.src)pkt.src=of.ip;
  steps.push({k:"Routing",ok:true,t:"Route "+rt.code+" "+rt.net+"/"+rt.len+(rt.nh?" via "+rt.nh:" (connected)")+", keluar "+short(rt.ifc)});
  {const id=(of.acl||{}).out;if(id){const v=withDevice(R.o,()=>aclEval(id,pkt));steps.push({k:"ACL keluar",ok:v.ok,t:"ACL "+id+": "+(v.ok?"PERMIT":"DENY")+" ("+v.line+")"});if(!v.ok)return fail(R,"ACL "+id+" denied "+PRN+" on "+short(rt.ifc)+" (out): "+v.line,steps)}}
  if(ar&&ar.nat==="inside"&&of.nat==="outside"){
   const rule=(R.o.nat||[]).find(r=>nnum(r.ifc)===nnum(rt.ifc)&&R.o.acls[r.acl]&&withDevice(R.o,()=>aclEval(r.acl,pkt)).ok);
   if(rule){const il=pkt.src;R.o.nattab=R.o.nattab||[];let e=R.o.nattab.find(x=>x.pro===(proto||"icmp")&&x.il.split(":")[0]===il&&x.ol.split(":")[0]===dstIp);
    if(!e){const k=R.o.nattab.length;e={pro:proto||"icmp",il:il+":"+(49152+k),ig:of.ip+":"+(30001+k),ol:dstIp+":"+(pkt.port||"-"),og:dstIp+":"+(pkt.port||"-")};R.o.nattab.push(e);if(R.o.nattab.length>40)R.o.nattab.shift()}
    pkt.src=of.ip;natTag=e.ig;steps.push({k:"NAT",ok:true,t:"PAT overload: "+e.il+" → "+e.ig})}
   else steps.push({k:"NAT",ok:true,t:"Tidak ada rule NAT yang cocok, paket diteruskan apa adanya"});
  }
  const nh=rt.nh||dstIp;steps.push({k:"Next hop",ok:true,t:nh});
  E("ok",R,R.name+" meneruskan paket ke "+nh,{inIf:curIf,outIf:rt.ifc,nextHop:nh,srcMac:macOf(R),steps});
  const r=step(R,rt.ifc,nh);if(r.err)return fail(R,r.err,[],r.noEv);
  const h=r.hop;
  if(h.d.type!=="router"){const ok=h.d.o.ifs[h.i].ip===dstIp;if(!ok)return fail(h.d,"Destination "+dstIp+" does not match this device.",[]);E("ok",h.d,"Diterima oleh "+h.d.name+": "+what,{inIf:h.i,steps:[{k:"Tujuan",ok:true,t:"IP tujuan cocok dengan "+short(h.i)},{k:"Pemrosesan",ok:true,t:KIND==="ICMP"?(dir==="reply"?"Echo reply diterima":"Akan membalas dengan echo reply"):"Simulator tidak memodelkan layanan di port; paket dianggap diterima"}]});return done(h.d,h.i,[...l3,{name:h.d.name,ip:dstIp}])}
  cur=h.d;curIf=h.i;
 }
 return fail(cur,"TTL expired (possible routing loop).",[]);
}
function pingNet(sd,dstIp,proto="icmp",port=0){
 routing();const ev=[];
 const si=sd.type==="router"?null:Object.keys(sd.o.ifs)[0],srcIp=si?sd.o.ifs[si].ip:null,num=()=>ev.forEach((e,i)=>{e.n=i+1;e.t=+((i+1)*0.001).toFixed(3)});
 const f=fwd(sd,si,dstIp,srcIp,proto,port,ev,"request"),base={src:f.src||srcIp||"",dst:dstIp,proto:proto.toUpperCase(),port,events:ev};
 if(!f.ok){num();return{...base,ok:false,stage:"request",ids:f.ids,hops:f.hops,at:f.at,atId:f.atId,reason:f.reason,ttl:f.ttl,l3:f.l3}}
 const rv=fwd(f.to,f.to.type==="router"?null:f.ti,f.srcSeen,dstIp,proto,port,ev,"reply",f.natTag);num();
 if(!rv.ok)return{...base,ok:false,stage:"reply",ids:f.ids,hops:f.hops,rids:rv.ids,at:rv.at,atId:rv.atId,reason:"The request arrived, but the reply could not return: "+rv.reason,ttl:f.ttl,l3:f.l3};
 if(rv.to.id!==sd.id)return{...base,ok:false,stage:"reply",ids:f.ids,hops:f.hops,rids:rv.ids,at:rv.to.name,atId:rv.to.id,reason:"The reply reached "+rv.to.name+" instead of "+sd.name+" (possible duplicate IP address).",ttl:f.ttl,l3:f.l3};
 return{...base,ok:true,stage:"done",ids:f.ids,hops:f.hops,rids:rv.ids,ttl:f.ttl,l3:f.l3};
}
const fmtPing=(r,t)=>["Type escape sequence to abort.","Sending 5, 100-byte ICMP Echos to "+t+", timeout is 2 seconds:",r.ok?"!!!!!":/No route/.test(r.reason)?"UUUUU":".....","Success rate is "+(r.ok?"100 percent (5/5)":"0 percent (0/5)"),...(r.ok?[]:["% Dropped at "+r.at+": "+r.reason])];
Object.assign(netHooks,{
 ping:(o,t)=>{const d=NET.devs.find(x=>x.o===o);return d?fmtPing(pingNet(d,t),t):["% Device is not part of the topology."]},
 trace:(o,t)=>{const d=NET.devs.find(x=>x.o===o);if(!d)return["% Device is not part of the topology."];const r=pingNet(d,t),L=["Type escape sequence to abort.","Tracing the route to "+t,""];(r.l3||[]).filter(x=>x.name!==d.name).forEach((x,i)=>L.push("  "+(i+1)+" "+(x.ip||x.name)+" ("+x.name+") 4 msec"));if(!r.ok)L.push("  * * *  % Dropped at "+r.at+": "+r.reason);return L},
 dyn:o=>{routing();const d=NET.devs.find(x=>x.o===o);return d&&d.dyn?d.dyn.map(x=>x.code+"    "+x.net+"/"+maskLen(x.mask)+" ["+x.ad+"/"+x.metric+"] via "+x.nh+", "+x.ifc):[]},
 nbr:(o,p)=>{routing();const d=NET.devs.find(x=>x.o===o),L=p==="ospf"?["Neighbor ID     Pri   State           Dead Time   Address         Interface"]:["Address         Interface              State"];if(!d||!d.nbr)return L;d.nbr[p].forEach(n=>L.push(p==="ospf"?pad(n.id,16)+pad("1",6)+pad(n.state+"/-",16)+pad("00:00:34",12)+pad(n.addr,16)+n.ifc:pad(n.addr,16)+pad(n.ifc,23)+n.state));return L}
});
function devRun(d,v){
 const o=d.o;o.lines=o.lines||[];routing();netHooks.active=true;
 let out;try{out=withDevice(o,()=>{const p=sbPrompt(),r=sbRun(v);return[p+" "+v,...r]})}finally{netHooks.active=false}
 o.lines.push(...out);return out;
}
const CFGT={"Router dasar":[["","hostname R1","has"],["interface GigabitEthernet0/0","ip address 192.168.1.1 255.255.255.0","has"],["interface GigabitEthernet0/0","shutdown","absent"]],"OSPF area 0":[["router ospf 1","router-id 1.1.1.1","has"],["router ospf 1","network 192.168.1.0 0.0.0.255 area 0","has"]],"Switch VLAN 10":[["","hostname SW1","has"],["vlan 10","name STAFF","has"],["interface FastEthernet0/1","switchport access vlan 10","has"]]};
function cfgDiff(d,key){
 const text=withDevice(d.o,()=>sbConfig()),S={"":[]};let cur="";
 text.forEach(l=>{if(/^(interface|router|vlan|line) /.test(l)){cur=l;S[cur]=S[cur]||[]}else if(l==="!"){cur=""}else if(l&&!/^(Building|Current)/.test(l)&&l!=="end"){(S[cur]=S[cur]||[]).push(l.trim())}});
 return(CFGT[key]||[]).map(([sec,line,mode])=>{
  const lines=S[sec]||[],has=lines.includes(line);
  const act=mode==="has"&&!has?(lines.find(x=>x.split(" ")[0]===line.split(" ")[0])||"(tidak ada)"):"";
  return{sec,line,mode,ok:mode==="has"?has:!has,expect:mode==="has"?line:"tidak ada: "+line,actual:act||(mode==="absent"&&has?line:"")};
 });
}
function projCheck(){
 routing();
 const D=NET.devs,R=D.filter(d=>d.type==="router"),SW=D.filter(d=>d.type==="switch"),PC=D.filter(d=>d.type==="pc");
 const linked=D.length>0&&D.every(d=>NET.links.some(l=>l.a.d===d.id||l.b.d===d.id));
 const vl=new Set();SW.forEach(s=>Object.keys(s.o.vlans).forEach(v=>{if(v!=="1")vl.add(v)}));
 const used=SW.reduce((a,s)=>a+Object.values(s.o.ifs).filter(p=>p.mode==="access"&&p.vlan!==1).length,0);
 const dhcp=R.some(r=>Object.values(r.o.dhcp.pools).some(p=>p.net&&p.gw));
 const full=R.some(r=>r.nbr&&r.nbr.ospf.some(n=>n.state==="FULL"));
 const nat=R.some(r=>r.o.nat.length&&Object.values(r.o.ifs).some(f=>f.nat==="inside")&&Object.values(r.o.ifs).some(f=>f.nat==="outside"));
 const acl=R.some(r=>Object.values(r.o.ifs).some(f=>Object.keys(f.acl||{}).length));
 const pcs=PC.filter(p=>p.o.ifs.eth0.ip&&p.o.ifs.eth0.mask);let pair=null;
 pcs.forEach(a=>pcs.forEach(b=>{if(!pair&&a!==b&&!sameNet(a.o.ifs.eth0.ip,b.o.ifs.eth0.ip,a.o.ifs.eth0.mask))pair=[a,b]}));
 const pr=pair?pingNet(pair[0],pair[1].o.ifs.eth0.ip):null;
 const items=[
  ["Topologi",R.length>=2&&SW.length>=2&&PC.length>=4&&linked,"Butuh minimal 2 router, 2 switch, 4 PC (sekarang "+R.length+"/"+SW.length+"/"+PC.length+") dan semua perangkat harus terhubung."],
  ["VLAN",vl.size>=2&&used>=2,"Buat minimal 2 VLAN (selain VLAN 1) dan pasang minimal 2 port access ke VLAN tersebut (VLAN: "+vl.size+", port: "+used+")."],
  ["DHCP",dhcp,"Belum ada pool DHCP yang lengkap (network dan default-router) di router mana pun."],
  ["Routing (OSPF)",full,"Belum ada neighbor OSPF berstatus FULL. Periksa network statement, area, dan link antar router."],
  ["Konektivitas antar-LAN",!!pr&&pr.ok,pr?"Ping "+pair[0].name+" ke "+pair[1].name+" gagal di "+pr.at+": "+pr.reason:"Butuh minimal dua PC di subnet berbeda dengan IP dan mask terisi."],
  ["NAT",nat,"Belum ada rule NAT dengan interface inside dan outside di router mana pun."],
  ["ACL",acl,"Belum ada ACL yang dipasang pada interface router."]];
 const passed=items.filter(x=>x[1]).length;
 return{items,passed,total:items.length,score:Math.round(passed/items.length*100),unsupported:"Inter-VLAN routing: belum didukung engine (router-on-a-stick/SVI), sehingga tidak dinilai."};
}
function genLab(){
 const k=2+Math.floor(Math.random()*2),proto=["OSPF","RIP","EIGRP"][Math.floor(Math.random()*3)],seed=1000+Math.floor(Math.random()*9000);
 NET.devs=[];NET.links=[];NET.nid=1;NET.tl=[];NET.name="Generated Lab #"+seed;NET.gen={seed,k,proto};
 const setIf=(d,i,ip,mask)=>Object.assign(d.o.ifs[i],{ip,mask,up:true});
 for(let i=1;i<=k;i++){
  const r=mkDev("router","R"+i,110+(i-1)*190,100),p=mkDev("pc","PC"+i,110+(i-1)*190,250);
  setIf(r,"GigabitEthernet0/0","192.168."+i+".1","255.255.255.0");
  Object.assign(p.o.ifs.eth0,{ip:"192.168."+i+".10",mask:"255.255.255.0",gw:"192.168."+i+".1"});
  NET.devs.push(r,p);NET.links.push({a:{d:p.id,i:"eth0"},b:{d:r.id,i:"GigabitEthernet0/0"}});
 }
 const R=NET.devs.filter(d=>d.type==="router");
 for(let i=0;i<k-1;i++){setIf(R[i],"GigabitEthernet0/1","10.0."+(i+1)+".1","255.255.255.252");setIf(R[i+1],"GigabitEthernet0/2","10.0."+(i+1)+".2","255.255.255.252");NET.links.push({a:{d:R[i].id,i:"GigabitEthernet0/1"},b:{d:R[i+1].id,i:"GigabitEthernet0/2"}})}
 return NET.gen;
}
function genCheck(){
 routing();const pcs=NET.devs.filter(d=>d.type==="pc"),res=[];
 pcs.forEach(a=>pcs.forEach(b=>{if(a!==b){const r=pingNet(a,b.o.ifs.eth0.ip);res.push({a:a.name,b:b.name,ok:r.ok,reason:r.reason||"",at:r.at||""})}}));
 return{res,ok:res.length>0&&res.every(x=>x.ok)};
}
const PJ={schema:"netlab-topology",version:1,maxDevs:60,maxLinks:120,maxBytes:1048576},TRANSIENT=["lines","hist","hi"];
function exportProject(){
 return{schema:PJ.schema,version:PJ.version,name:NET.name,exportedAt:new Date().toISOString(),devices:NET.devs.map(d=>{const c=JSON.parse(JSON.stringify(d.o));TRANSIENT.forEach(k=>delete c[k]);return{id:d.id,type:d.type,kind:d.kind||d.type,name:d.name,x:Math.round(d.x),y:Math.round(d.y),config:c}}),links:NET.links.map(l=>({a:{dev:l.a.d,port:l.a.i},b:{dev:l.b.d,port:l.b.i}}))};
}
function plainCopy(v,depth){
 if(v===null||typeof v==="boolean")return v;
 if(typeof v==="number"){if(!Number.isFinite(v))throw new Error("angka tidak valid");return v}
 if(typeof v==="string"){if(v.length>300)throw new Error("teks terlalu panjang");return v}
 if(depth>7)throw new Error("struktur terlalu dalam");
 if(Array.isArray(v)){if(v.length>200)throw new Error("daftar terlalu besar");return v.map(x=>plainCopy(x,depth+1))}
 if(typeof v==="object"){const ks=Object.keys(v),o={};if(ks.length>200)throw new Error("objek terlalu besar");ks.forEach(k=>{if(k==="__proto__"||k==="constructor"||k==="prototype")throw new Error("kunci terlarang '"+k+"'");o[k]=plainCopy(v[k],depth+1)});return o}
 throw new Error("tipe data tidak didukung");
}
function mergeCfg(dst,src,depth,path){
 Object.keys(src).forEach(k=>{
  if(TRANSIENT.includes(k))return;
  if(k==="__proto__"||k==="constructor"||k==="prototype")throw new Error("kunci terlarang '"+k+"' pada "+path);
  const dv=dst[k],sv=src[k],p=path+"."+k;
  if(dv===undefined){dst[k]=plainCopy(sv,depth+1);return}
  if(Array.isArray(dv)){if(!Array.isArray(sv))throw new Error("field "+p+" harus berupa daftar");dst[k]=plainCopy(sv,depth+1);return}
  if(dv&&typeof dv==="object"){if(!sv||typeof sv!=="object"||Array.isArray(sv))throw new Error("field "+p+" harus berupa objek");mergeCfg(dv,sv,depth+1,p);return}
  if(dv===null){dst[k]=plainCopy(sv,depth+1);return}
  if(typeof sv!==typeof dv)throw new Error("field "+p+" bertipe salah");
  dst[k]=plainCopy(sv,depth+1);
 });
}
function importProject(text){
 const bad=m=>({ok:false,errors:[m]});
 if(typeof text!=="string"||text.length>PJ.maxBytes)return bad("File terlalu besar (maksimal 1 MB).");
 let j;try{j=JSON.parse(text)}catch(e){return bad("File bukan JSON yang valid: "+e.message)}
 if(!j||typeof j!=="object"||Array.isArray(j))return bad("Isi file harus berupa objek JSON.");
 const forbidden=["__proto__","constructor","prototype"].find(k=>Object.prototype.hasOwnProperty.call(j,k));
 if(forbidden)return bad("Kunci terlarang '"+forbidden+"'.");
 if(j.schema!==PJ.schema)return bad('Bukan file topologi NETLAB (schema harus "'+PJ.schema+'").');
 if(!Number.isInteger(j.version)||j.version<1)return bad("Versi file tidak valid.");
 if(j.version>PJ.version)return bad("File dibuat oleh versi NETLAB yang lebih baru (v"+j.version+"). Perbarui aplikasi untuk membukanya.");
 if(!Array.isArray(j.devices)||!Array.isArray(j.links))return bad("Field devices dan links harus berupa daftar.");
 if(j.devices.length>PJ.maxDevs||j.links.length>PJ.maxLinks)return bad("Topologi terlalu besar (maksimal "+PJ.maxDevs+" perangkat dan "+PJ.maxLinks+" koneksi).");
 const name=typeof j.name==="string"&&j.name.trim()?j.name.trim().slice(0,40):"Imported Lab",saveNid=NET.nid;NET.nid=1;
 try{
  const devs=[],ids=new Set(),names=new Set();
  j.devices.forEach((d,i)=>{
   const w="Perangkat #"+(i+1)+(d&&typeof d.name==="string"?" ("+d.name.slice(0,16)+")":"");
   if(!d||typeof d!=="object"||Array.isArray(d))throw new Error(w+": bukan objek.");
   if(typeof d.id!=="string"||!/^d\d{1,5}$/.test(d.id))throw new Error(w+": id tidak valid (contoh: d1).");
   if(ids.has(d.id))throw new Error(w+": id ganda "+d.id+".");
   const K=Object.prototype.hasOwnProperty.call(KINDS,d.kind)?KINDS[d.kind]:null;
   if(!K)throw new Error(w+": jenis perangkat '"+String(d.kind).slice(0,20)+"' tidak dikenal.");
   if(K.type!==d.type)throw new Error(w+": type '"+String(d.type).slice(0,12)+"' tidak cocok dengan jenis "+d.kind+".");
   if(typeof d.name!=="string"||!/^[A-Za-z0-9_-]{1,16}$/.test(d.name))throw new Error(w+": nama harus 1-16 karakter huruf, angka, - atau _.");
   if(names.has(d.name))throw new Error(w+": nama ganda.");
   if(!Number.isFinite(d.x)||!Number.isFinite(d.y))throw new Error(w+": posisi x dan y harus angka.");
   const nd=mkDev(d.type,d.name,Math.max(44,Math.min(596,d.x)),Math.max(46,Math.min(350,d.y)),d.kind);nd.id=d.id;
   if(d.config!==undefined){if(!d.config||typeof d.config!=="object"||Array.isArray(d.config))throw new Error(w+": config harus berupa objek.");try{mergeCfg(nd.o,d.config,0,"config")}catch(e){throw new Error(w+": "+e.message)}}
   Object.entries(nd.o.ifs).forEach(([pn,f])=>{
    if(f.ip&&!isIp(f.ip))throw new Error(w+": IP '"+String(f.ip).slice(0,20)+"' pada "+short(pn)+" tidak valid.");
    if(f.mask&&!validMask(f.mask))throw new Error(w+": subnet mask '"+String(f.mask).slice(0,20)+"' pada "+short(pn)+" tidak valid.");
    if(f.gw&&!isIp(f.gw))throw new Error(w+": gateway '"+String(f.gw).slice(0,20)+"' tidak valid.");
    if(f.dns&&!isIp(f.dns))throw new Error(w+": DNS '"+String(f.dns).slice(0,20)+"' tidak valid.");
   });
   if(nd.o.host!==undefined)nd.o.host=d.name;
   ids.add(d.id);names.add(d.name);devs.push(nd);
  });
  const used=new Set(),links=[];
  j.links.forEach((l,i)=>{
   const w="Koneksi #"+(i+1);
   if(!l||!l.a||!l.b||typeof l.a!=="object"||typeof l.b!=="object")throw new Error(w+": harus punya sisi a dan b.");
   const A=devs.find(x=>x.id===l.a.dev),B=devs.find(x=>x.id===l.b.dev);
   if(!A||!B)throw new Error(w+": perangkat tidak ditemukan ("+String(l.a.dev).slice(0,10)+" / "+String(l.b.dev).slice(0,10)+").");
   if(A===B)throw new Error(w+": perangkat tidak boleh terhubung ke dirinya sendiri.");
   if(!Object.prototype.hasOwnProperty.call(A.o.ifs,l.a.port))throw new Error(w+": port '"+String(l.a.port).slice(0,24)+"' tidak ada di "+A.name+".");
   if(!Object.prototype.hasOwnProperty.call(B.o.ifs,l.b.port))throw new Error(w+": port '"+String(l.b.port).slice(0,24)+"' tidak ada di "+B.name+".");
   const ka=A.id+"|"+l.a.port,kb=B.id+"|"+l.b.port;
   if(used.has(ka)||used.has(kb))throw new Error(w+": port sudah dipakai koneksi lain.");
   used.add(ka);used.add(kb);links.push({a:{d:A.id,i:l.a.port},b:{d:B.id,i:l.b.port}});
  });
  NET.nid=devs.reduce((m,d)=>Math.max(m,+d.id.slice(1)),0)+1;
  return{ok:true,name,devs,links};
 }catch(e){NET.nid=saveNid;return bad(e.message)}
}
function linkProblem(a,ai,b,bi){
 if(!a||!b)return"Perangkat tidak ditemukan.";
 if(a===b)return"Perangkat tidak bisa dihubungkan ke dirinya sendiri.";
 if(!ai||!bi)return"Pilih interface di kedua perangkat.";
 const used=(d,i)=>NET.links.some(l=>(l.a.d===d.id&&l.a.i===i)||(l.b.d===d.id&&l.b.i===i));
 if(used(a,ai)||used(b,bi))return"Port sudah dipakai koneksi lain. Putuskan link lama dulu.";
 const host=d=>d.type!=="router"&&d.type!=="switch";
 if(a.kind==="cloud"&&b.kind==="cloud")return"Dua cloud/Internet tidak bisa dihubungkan langsung.";
 if(host(a)&&host(b)&&NET.links.some(l=>(l.a.d===a.id&&l.b.d===b.id)||(l.a.d===b.id&&l.b.d===a.id)))return"Dua perangkat akhir ini sudah terhubung.";
 return"";
}
const TPLS={
 "dua-lan":["Dua LAN dengan static route","2 router, 2 switch, 2 PC. Static route sudah dikonfigurasi di kedua router."],
 "ospf-3":["Tiga router dengan OSPF","3 router berantai, 1 PC per LAN, OSPF area 0 sudah aktif."],
 "vlan-sekolah":["VLAN sekolah (demo isolasi)","1 switch, VLAN 10 dan 20, 4 PC dalam satu subnet. Inter-VLAN routing belum didukung, jadi antar-VLAN memang terisolasi."],
 "nat-pat":["LAN dengan NAT/PAT ke Internet","1 router (inside/outside), 2 PC, dan cloud Internet. PAT overload sudah aktif."]
};
function buildTemplate(id){
 if(!TPLS[id])return false;
 NET.devs=[];NET.links=[];NET.nid=1;NET.tl=[];NET.gen=null;NET.name=TPLS[id][0];
 const A=(k,n,x,y)=>{const d=mkDev(KINDS[k].type,n,x,y,k);NET.devs.push(d);return d},L=(a,ai,b,bi)=>NET.links.push({a:{d:a.id,i:ai},b:{d:b.id,i:bi}});
 const H=(d,ip,gw,m)=>Object.assign(d.o.ifs.eth0,{ip,mask:m||"255.255.255.0",gw}),cli=(d,c)=>c.forEach(x=>devRun(d,x));
 const G="GigabitEthernet0/",F="FastEthernet0/";
 if(id==="dua-lan"){
  const r1=A("router","R1",190,120),r2=A("router","R2",450,120),s1=A("switch","SW1",110,230),s2=A("switch","SW2",530,230),p1=A("pc","PC1",70,320),p2=A("pc","PC2",570,320);
  L(p1,"eth0",s1,F+"1");L(s1,F+"2",r1,G+"0");L(r1,G+"1",r2,G+"1");L(r2,G+"0",s2,F+"2");L(s2,F+"1",p2,"eth0");H(p1,"192.168.1.10","192.168.1.1");H(p2,"192.168.2.10","192.168.2.1");
  cli(r1,["enable","configure terminal","interface g0/0","ip address 192.168.1.1 255.255.255.0","no shutdown","interface g0/1","ip address 10.0.0.1 255.255.255.252","no shutdown","exit","ip route 192.168.2.0 255.255.255.0 10.0.0.2","end"]);
  cli(r2,["enable","configure terminal","interface g0/0","ip address 192.168.2.1 255.255.255.0","no shutdown","interface g0/1","ip address 10.0.0.2 255.255.255.252","no shutdown","exit","ip route 192.168.1.0 255.255.255.0 10.0.0.1","end"]);
 }
 if(id==="ospf-3"){
  const R=[1,2,3].map(i=>A("router","R"+i,100+(i-1)*220,110)),P=[1,2,3].map(i=>A("pc","PC"+i,100+(i-1)*220,260));
  R.forEach((r,i)=>{L(P[i],"eth0",r,G+"0");H(P[i],"192.168."+(i+1)+".10","192.168."+(i+1)+".1");
   cli(r,["enable","configure terminal","interface g0/0","ip address 192.168."+(i+1)+".1 255.255.255.0","no shutdown"].concat(i<2?["interface g0/1","ip address 10.0."+(i+1)+".1 255.255.255.252","no shutdown"]:[],i>0?["interface g0/2","ip address 10.0."+i+".2 255.255.255.252","no shutdown"]:[],["exit","router ospf 1","router-id "+(i+1)+"."+(i+1)+"."+(i+1)+"."+(i+1),"network 192.168."+(i+1)+".0 0.0.0.255 area 0","network 10.0.0.0 0.0.255.255 area 0","end"]))});
  L(R[0],G+"1",R[1],G+"2");L(R[1],G+"1",R[2],G+"2");
 }
 if(id==="vlan-sekolah"){
  const s=A("switch","SW1",320,120),P=[1,2,3,4].map(i=>A("pc","PC"+i,100+(i-1)*140,290));
  P.forEach((p,i)=>{L(p,"eth0",s,F+(i+1));H(p,"192.168.1."+(11+i),"192.168.1.1")});
  cli(s,["enable","configure terminal","vlan 10","name STAFF","vlan 20","name SISWA","interface fa0/1","switchport mode access","switchport access vlan 10","interface fa0/2","switchport mode access","switchport access vlan 10","interface fa0/3","switchport mode access","switchport access vlan 20","interface fa0/4","switchport mode access","switchport access vlan 20","end"]);
 }
 if(id==="nat-pat"){
  const r=A("router","R1",250,130),s=A("switch","SW1",120,230),p1=A("pc","PC1",60,320),p2=A("pc","PC2",190,320),c=A("cloud","INET1",500,130);
  L(p1,"eth0",s,F+"1");L(p2,"eth0",s,F+"2");L(s,F+"3",r,G+"0");L(r,G+"1",c,"eth0");H(p1,"192.168.1.10","192.168.1.1");H(p2,"192.168.1.11","192.168.1.1");H(c,"203.0.113.2","203.0.113.1","255.255.255.252");
  cli(r,["enable","configure terminal","interface g0/0","ip address 192.168.1.1 255.255.255.0","ip nat inside","no shutdown","interface g0/1","ip address 203.0.113.1 255.255.255.252","ip nat outside","no shutdown","exit","access-list 1 permit 192.168.1.0 0.0.0.255","ip nat inside source list 1 interface g0/1 overload","end"]);
 }
 return true;
}

export {mkDev, segments, owners, swPath, routing, rtable, lookup, fwd, pingNet, devRun, cfgDiff, projCheck, genLab, genCheck, exportProject, plainCopy, mergeCfg, importProject, linkProblem, buildTemplate, NET, dev, ifUp, upLinks, macOf, classNet, rid, arpSet, nnum, ifOn, linkIdx, fmtPing, CFGT, PJ, TRANSIENT, TPLS};
