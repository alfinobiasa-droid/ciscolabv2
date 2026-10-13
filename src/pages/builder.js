import {toast, xpPop, store, S, $, esc} from "../core.js";
import {withDevice, sbPrompt, short, natLines, dhcpLines, sbAcls} from "../sim/engine.js";
import {isIp, validMask, maskLen, pad} from "../sim/net.js";
import {KINDS, KGROUPS, kindOf, devGlyph, devIcon} from "../components/device-icons.js";
import {mkDev, routing, rtable, pingNet, devRun, cfgDiff, projCheck, genLab, genCheck, exportProject, importProject, linkProblem, buildTemplate, NET, dev, ifUp, upLinks, linkIdx, CFGT, PJ, TPLS} from "../sim/network.js";

const BU={tab:"insp",mode:"select",sel:null,cA:null,pend:null,link:null,pk:null,pkOpen:false,ns:"Interfaces",nd:null,hist:[],fut:[],drag:null,collapsed:false,dd:null,dt:"Router dasar",arm:"",res:null,msg:"",anim:0,errId:null,act:new Set(),flow:new Set(),vb:{x:0,y:0,w:640,h:400},sim:null,simTok:0,pan:null,pdrag:null,noclick:false,pmode:"real",sm:null,msel:new Set(),clip:null,band:null,evhl:new Set(),evlink:new Set(),help:false,smTimer:null,impMsg:null,last:{}};
const serNet=()=>JSON.stringify({name:NET.name,devs:NET.devs,links:NET.links,nid:NET.nid,tl:NET.tl,gen:NET.gen});
const saveNet=()=>store.set("labCur",JSON.parse(serNet()));
function loadNet(s){NET.name=s.name||"Lab 1";NET.devs=(s.devs||[]).map(d=>({...d,x:Math.max(44,Math.min(596,d.x)),y:Math.max(46,Math.min(350,d.y))}));NET.links=s.links||[];NET.nid=s.nid||1;NET.tl=s.tl||[];NET.gen=s.gen||null}
loadNet(store.get("labCur",{}));
const snap=()=>{BU.errId=null;BU.hist.push(serNet());if(BU.hist.length>40)BU.hist.shift();BU.fut=[]};
const tlog=m=>{NET.tl.push({t:new Date().toTimeString().slice(0,5),m});if(NET.tl.length>200)NET.tl.shift()};
const awardXp=n=>{S.xp+=n;store.set("xp",S.xp);xpPop(n)};
function bflags(){routing();if(NET.devs.some(d=>d.nbr&&d.nbr.ospf.some(n=>n.state==="FULL"))&&!store.get("bldOspf",false))store.set("bldOspf",true)}
function bundo(){if(!BU.hist.length)return;BU.fut.push(serNet());loadNet(JSON.parse(BU.hist.pop()));if(!dev(BU.sel))BU.sel=null;BU.link=null;BU.pend=null;saveNet();bdraw()}
function bredo(){if(!BU.fut.length)return;BU.hist.push(serNet());loadNet(JSON.parse(BU.fut.pop()));if(!dev(BU.sel))BU.sel=null;BU.link=null;saveNet();bdraw()}
function addDev(kind,px,py){
 const K=KINDS[kind];if(!K)return;snap();
 let n=NET.devs.filter(d=>(d.kind||d.type)===kind).length+1;while(NET.devs.some(d=>d.name===K.pre+n))n++;
 const c=NET.devs.length,x=px!==undefined?px:80+(c%5)*110,y=py!==undefined?py:80+Math.floor(c/5)*115;
 const d=mkDev(K.type,K.pre+n,x,y,kind);NET.devs.push(d);BU.sel=d.id;BU.msel=new Set([d.id]);BU.link=null;tlog("Added "+d.name+" ("+K.label+")");saveNet();bdraw();
}
function delDev(id){const d=dev(id);if(!d)return;snap();NET.links=NET.links.filter(l=>l.a.d!==id&&l.b.d!==id);NET.devs=NET.devs.filter(x=>x.id!==id);if(BU.sel===id)BU.sel=null;BU.msel.delete(id);BU.link=null;BU.cA=null;tlog("Deleted "+d.name);saveNet();bdraw()}
const freeIfs=d=>Object.keys(d.o.ifs).filter(i=>!NET.links.some(l=>(l.a.d===d.id&&l.a.i===i)||(l.b.d===d.id&&l.b.i===i)));
const linkOf=(d,i)=>NET.links.findIndex(l=>(l.a.d===d.id&&l.a.i===i)||(l.b.d===d.id&&l.b.i===i));
const SCOLB={ok:"#22C55E",warn:"#F59E0B",bad:"#EF4444",off:"#64748B"},SNAMEB={ok:"Online",warn:"Warning",bad:"Error",off:"Offline"};
function bStatus(d){
 if(BU.errId===d.id)return"bad";
 const f=Object.entries(d.o.ifs),linked=f.some(([i])=>linkOf(d,i)>=0),live=upLinks().some(l=>l.a.d===d.id||l.b.d===d.id);
 if(d.type==="switch")return linked&&live?"ok":linked?"warn":"off";
 const ip=f.filter(([,x])=>x.ip);if(!ip.length)return"off";
 return ip.every(([i])=>ifUp(d,i))&&(d.type==="router"||(linked&&live))?"ok":"warn";
}
function devTip(d){
 const ips=Object.entries(d.o.ifs).filter(([,f])=>f.ip).map(([i,f])=>(d.type==="router"?short(i)+" ":"")+f.ip),n=Object.keys(d.o.ifs).length,u=Object.keys(d.o.ifs).filter(i=>linkOf(d,i)>=0).length;
 return[d.name,kindOf(d).label,"IP: "+(ips.slice(0,3).join(", ")||"belum diatur"),"Status: "+SNAMEB[bStatus(d)],"Port: "+u+"/"+n+" terhubung"];
}
function anchorOf(d,tx,ty){const dx=tx-d.x,dy=ty-d.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,rx=34,ry=26,k=1/Math.sqrt(ux*ux/(rx*rx)+uy*uy/(ry*ry));return[d.x+ux*k,d.y-4+uy*k]}
function devSvg(d){
 const st=bStatus(d),k=KINDS[d.kind]?d.kind:(KINDS[d.type]?d.type:"pc"),f=Object.values(d.o.ifs).find(x=>x.ip),sub=f?f.ip+(f.mask&&validMask(f.mask)?"/"+maskLen(f.mask):""):"";
 return `<g class="bdev st-${st} ${d.type}${d.id===BU.sel||BU.msel.has(d.id)?" sel":""}${BU.cA===d.id||(BU.pend||[]).includes(d.id)?" pick":""}${BU.act.has(d.id)?" act":""}${BU.evhl.has(d.id)?" evhl":""}" data-dev="${d.id}" data-kind="${k}" transform="translate(${d.x},${d.y})" tabindex="0" role="button" aria-label="${esc(d.name)}, ${esc(kindOf(d).label)}, ${SNAMEB[st]}${sub?", "+esc(sub):""}"><rect class="hit" x="-40" y="-40" width="80" height="76" fill="transparent"/><ellipse class="dsel" cx="0" cy="23" rx="42" ry="14"/>${devGlyph(k)}<circle class="sdot ${st}" cx="30" cy="-24" r="5.5"/><text class="dl" y="46">${esc(d.name)}</text>${sub?`<text class="ds" y="58">${esc(sub)}</text>`:""}</g>`;
}
function drawMini(){
 const m=$("#bmini");if(!m)return;
 m.innerHTML=`<rect width="640" height="400" fill="rgba(8,14,26,.75)"/>`+NET.links.map(l=>{const a=dev(l.a.d),b=dev(l.b.d);return a&&b?`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${ifUp(a,l.a.i)&&ifUp(b,l.b.i)?"#3B82F6":"#EF4444"}" stroke-width="5" opacity=".85"/>`:""}).join("")+NET.devs.map(d=>`<circle cx="${d.x}" cy="${d.y}" r="12" fill="${kindOf(d).acc}" stroke="${SCOLB[bStatus(d)]}" stroke-width="4"/>`).join("")+`<rect x="${BU.vb.x}" y="${BU.vb.y}" width="${BU.vb.w}" height="${BU.vb.h}" fill="rgba(34,211,238,.1)" stroke="#22D3EE" stroke-width="6"/>`;
}
function drawSvg(){
 const g=$("#bg-main");if(!g)return;
 const at=(A,B,t)=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t];
 g.innerHTML=NET.links.map((l,i)=>{
  const a=dev(l.a.d),b=dev(l.b.d);if(!a||!b)return"";
  const up=ifUp(a,l.a.i)&&ifUp(b,l.b.i),A=anchorOf(a,b.x,b.y),B=anchorOf(b,a.x,a.y),[ax,ay]=at(A,B,.2),[bx,by]=at(A,B,.8),fl=(BU.flow.has(i)||BU.evlink.has(i))&&up,col=up?(fl?"#22D3EE":"#3B82F6"):"#EF4444",ln=c=>`<line class="${c}" x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="${c==="hit"?"transparent":col}"/>`;
  return `<g class="blink ${up?"up":"down"}${fl?" flow":""}${BU.evlink.has(i)?" evl":""}${BU.link===i?" sel":""}" data-link="${i}">${ln("glow")}${ln("vis")}${fl?ln("fl"):""}${ln("hit")}<circle class="jack" cx="${A[0]}" cy="${A[1]}" r="3.4" stroke="${col}"/><circle class="jack" cx="${B[0]}" cy="${B[1]}" r="3.4" stroke="${col}"/><text x="${ax}" y="${ay-6}" class="ifl" text-anchor="middle">${esc(short(l.a.i))}</text><text x="${bx}" y="${by-6}" class="ifl" text-anchor="middle">${esc(short(l.b.i))}</text></g>`}).join("")+NET.devs.map(devSvg).join("");
 const e=$("#bempty");if(e)e.hidden=NET.devs.length>0;
 drawMini();
}
function vbSet(v){const w=Math.max(220,Math.min(640,v.w)),h=w*400/640,x=Math.max(0,Math.min(640-w,v.x)),y=Math.max(0,Math.min(400-h,v.y));BU.vb={x,y,w,h};const s=$("#bsvg");if(s)s.setAttribute("viewBox",x+" "+y+" "+w+" "+h);drawMini()}
function zoomBy(f,cx,cy){const v=BU.vb;cx=cx===undefined?v.x+v.w/2:cx;cy=cy===undefined?v.y+v.h/2:cy;const w=v.w/f;vbSet({x:cx-(cx-v.x)*(w/v.w),y:cy-(cy-v.y)*(w/v.w),w})}
function markAct(res,ms=4500){
 BU.act=new Set(res.ids||[]);BU.flow=new Set();
 for(let i=0;i<(res.ids||[]).length-1;i++){const k=NET.links.findIndex(l=>(l.a.d===res.ids[i]&&l.b.d===res.ids[i+1])||(l.a.d===res.ids[i+1]&&l.b.d===res.ids[i]));if(k>=0)BU.flow.add(k)}
 clearTimeout(markAct.t);markAct.t=setTimeout(()=>{BU.act=new Set();BU.flow=new Set();drawSvg()},ms);
}
function animPkt(res){
 return new Promise(done=>{
  const g=$("#bg-pkt");if(!g)return done();g.innerHTML="";
  const pts=res.ids.map(dev).filter(Boolean).map(d=>[d.x,d.y-4]);
  const stop=res.ok||res.stage==="reply"?pts.length-1:Math.max(0,res.ids.indexOf(res.atId));
  const fin=()=>{const e=pts[stop]||pts[0];if(!e)return;g.innerHTML=res.ok?`<circle class="pkt ok" cx="${e[0]}" cy="${e[1]-36}" r="8" data-pkt="1"/>`:`<text class="pktx" x="${e[0]}" y="${e[1]-32}" text-anchor="middle" data-pkt="1">✖</text>`};
  if(matchMedia("(prefers-reduced-motion: reduce)").matches||pts.length<2||stop<=0){fin();return done()}
  const tok=BU.anim=BU.anim+1;let seg=0,t0=null;
  const frame=ts=>{if(BU.anim!==tok){done();return}if(t0===null)t0=ts;const p=Math.min(1,(ts-t0)/380),a=pts[seg],b=pts[seg+1];g.innerHTML=`<circle class="pkt" cx="${a[0]+(b[0]-a[0])*p}" cy="${a[1]+(b[1]-a[1])*p}" r="7" data-pkt="1"/>`;if(p>=1){seg++;t0=null;if(seg>=stop){fin();done();return}}requestAnimationFrame(frame)};
  requestAnimationFrame(frame);
 });
}
async function runSim(){
 routing();
 const hs=NET.devs.filter(d=>d.type!=="switch"&&d.type!=="router"&&d.o.ifs.eth0&&d.o.ifs.eth0.ip&&d.o.ifs.eth0.mask);
 if(hs.length<2){toast("Simulasi butuh minimal 2 perangkat akhir dengan IP dan mask terisi.");return}
 const pr=[];for(let i=0;i<hs.length;i++)for(let j=i+1;j<hs.length;j++)pr.push([hs[i],hs[j]]);
 const R=pr.slice(0,8).map(([a,b])=>({a:a.name,b:b.name,res:pingNet(a,b.o.ifs.eth0.ip)}));
 BU.sim={rows:R,total:pr.length};BU.tab="pkt";BU.collapsed=false;
 const bad=R.find(r=>!r.res.ok);BU.errId=bad?bad.res.atId:null;
 if(R.some(r=>r.res.ok)&&!store.get("bldPing",false))store.set("bldPing",true);
 tlog("Simulasi: "+R.filter(r=>r.res.ok).length+"/"+R.length+" jalur berhasil");saveNet();bdraw();
 const tok=++BU.simTok;
 for(const r of R.slice(0,4)){if(tok!==BU.simTok)return;markAct(r.res,6000);drawSvg();await animPkt(r.res)}
}
const simHtml=()=>{const s=BU.sim;if(!s)return"";const ok=s.rows.filter(r=>r.res.ok).length;return `<div class="pres ${ok===s.rows.length?"ok":"no"}" role="status" style="margin-bottom:10px"><b>Simulasi: ${ok}/${s.rows.length} jalur berhasil${s.total>s.rows.length?" (dari "+s.total+" kemungkinan)":""}</b><ul class="chk-list">${s.rows.map(r=>`<li class="${r.res.ok?"ok":"no"}">${r.res.ok?"✓":"✗"} ${esc(r.a)} → ${esc(r.b)}${r.res.ok?"":` <span class="muted">${esc(r.res.at+": "+r.res.reason)}</span>`}</li>`).join("")}</ul></div>`};
const dHead=d=>{const st=bStatus(d),n=Object.keys(d.o.ifs).length;return `<div class="dhead">${devIcon(KINDS[d.kind]?d.kind:d.type,{size:64})}<div><b>${esc(d.name)}</b><div class="muted">${esc(kindOf(d).label)} · ${n} ${d.type==="switch"?"port":"interface"}</div><span class="stb ${st}"><i></i>${SNAMEB[st]}</span><div class="muted" style="font-size:.78rem;margin-top:4px">${esc(kindOf(d).sim)}</div></div></div>`};
const palHtml=()=>KGROUPS.map(([g,ks])=>`<p class="lbl">${g}</p>${ks.map(k=>`<button class="pal" data-b="add" data-v="${k}" data-pal="${k}" aria-label="Tambah ${KINDS[k].label}" title="${esc(KINDS[k].sim)}"><span class="pi">${devIcon(k,{size:44})}</span><span class="pt"><b>${KINDS[k].label}</b><small>${/^(Simulasi|Router)/.test(KINDS[k].sim)?"Simulasi":"Endpoint"}</small></span></button>`).join("")}`).join("");
const ifRow=(d,i)=>{const f=d.o.ifs[i],li=linkOf(d,i),L=li>=0?NET.links[li]:null,o=L?(L.a.d===d.id&&L.a.i===i?L.b:L.a):null,od=o?dev(o.d):null;
 const info=d.type==="switch"?(f.mode==="trunk"?"trunk · native "+f.native:"access · VLAN "+f.vlan):(f.ip?esc(f.ip)+"/"+maskLen(f.mask):"–");
 return `<tr><td><code>${esc(short(i))}</code></td><td>${info}</td><td class="${ifUp(d,i)?"okc":"badc"}">${ifUp(d,i)?"UP":"DOWN"}</td><td>${od?esc(od.name)+" "+esc(short(o.i)):"–"}</td></tr>`};
const ifTable=d=>`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Interface</th><th>${d.type==="switch"?"Mode":"IP"}</th><th>Status</th><th>Link</th></tr></thead><tbody>${Object.keys(d.o.ifs).map(i=>ifRow(d,i)).join("")}</tbody></table></div>`;
const bprompt=d=>withDevice(d.o,()=>sbPrompt());
const termLines=d=>(d.o.lines||[]).slice(-60).map(l=>`<div class="tl${/^%/.test(l)?" err":""}">${esc(l)||"&nbsp;"}</div>`).join("");
function drawTerm(d){const o=$("#bout"),p=$("#bp");if(o){o.innerHTML=termLines(d);o.scrollTop=o.scrollHeight}if(p)p.textContent=bprompt(d)}
function inspDev(d){
 const o=d.o;routing();
 let h=dHead(d)+`<label class="fld">Nama perangkat<input class="inp" data-b="rename" value="${esc(d.name)}" maxlength="16" aria-label="Nama perangkat"></label>${ifTable(d)}`;
 if(d.type==="router"){
  const dy=(d.dyn||[]).length,pr=[(o.routes||[]).length?"Static ("+o.routes.length+")":"",o.os&&o.os.pid?"OSPF "+o.os.pid:"",o.rp&&o.rp.on?"RIP":"",o.ei&&o.ei.as?"EIGRP "+o.ei.as:""].filter(Boolean);
  const acl=Object.values(o.ifs).flatMap(f=>Object.values(f.acl||{}));
  h+=`<p class="lbl sp">Routing</p><p style="margin:0">${pr.join(" · ")||"belum ada"}${dy?` · ${dy} route dinamis`:""}</p><p class="lbl sp">Services</p><p style="margin:0">NAT: ${o.nat.length?o.nat.length+" rule":"–"} · DHCP: ${Object.keys(o.dhcp.pools).length?Object.keys(o.dhcp.pools).length+" pool":"–"} · ACL: ${[...new Set(acl)].join(", ")||"–"}</p>`;
 }
 if(d.type==="switch"){const v=Object.entries(o.vlans);h+=`<p class="lbl sp">VLAN</p><p style="margin:0">${v.map(([id,x])=>esc(id+(x&&x.name?" "+x.name:""))).join(" · ")}</p>`}
 if(d.type==="router"||d.type==="switch")h+=`<p class="lbl sp">CLI · ${esc(d.name)}</p><div class="term bterm"><div class="tout" id="bout" role="log" aria-live="polite">${termLines(d)}</div><label class="tin"><span id="bp">${esc(bprompt(d))}</span><input id="bcmd" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="CLI ${esc(d.name)}"></label></div>`;
 else{const f=o.ifs.eth0;h+=`<p class="lbl sp">Konfigurasi IP</p>${["ip:IP Address","mask:Subnet Mask","gw:Default Gateway","dns:DNS"].map(x=>{const[k,l]=x.split(":");return `<label class="fld">${l}<input class="inp" id="pc-${k}" value="${esc(f[k]||"")}" autocomplete="off"></label>`}).join("")}<button class="act" style="width:auto" data-b="pcapply">Terapkan</button><div id="pcmsg" role="status"></div>`}
 return h;
}
function inspLink(){
 const l=NET.links[BU.link];if(!l)return"";const a=dev(l.a.d),b=dev(l.b.d),up=ifUp(a,l.a.i)&&ifUp(b,l.b.i);
 const why=up?"":[!ifUp(a,l.a.i)?a.name+" "+short(l.a.i)+" DOWN (jalankan no shutdown)":"",!ifUp(b,l.b.i)?b.name+" "+short(l.b.i)+" DOWN (jalankan no shutdown)":""].filter(Boolean).join("; ");
 return `<p class="lbl">Link</p><p style="margin:0 0 6px"><b>${esc(a.name)}</b> ${esc(short(l.a.i))} ↔ <b>${esc(b.name)}</b> ${esc(short(l.b.i))}</p><p>Status: <b class="${up?"okc":"badc"}">${up?"UP":"DOWN"}</b>${why?`<br><span class="muted">${esc(why)}</span>`:""}</p><button class="chip" data-b="discon">Putuskan link</button>`;
}
function inspPend(){
 const[a,b]=BU.pend.map(dev);if(!a||!b)return"";
 const opt=d=>freeIfs(d).map(i=>`<option value="${esc(i)}">${esc(short(i))}</option>`).join("")||"<option value=''>(tidak ada port kosong)</option>";
 return `<p class="lbl">Hubungkan perangkat</p><label class="fld">${esc(a.name)} · interface<select class="inp" id="cai">${opt(a)}</select></label><label class="fld">${esc(b.name)} · interface<select class="inp" id="cbi">${opt(b)}</select></label><div class="seg"><button class="act" style="width:auto" data-b="docon">Hubungkan</button><button class="chip" data-b="cancon">Batal</button></div><div id="conmsg" role="status"></div>`;
}
function tabInsp(){
 if(BU.msel.size>1&&!BU.pend)return inspMulti();
 if(BU.pend)return inspPend();if(BU.link!=null&&NET.links[BU.link])return inspLink();
 const d=dev(BU.sel);if(d)return inspDev(d);
 return `<p class="lbl">Device Inspector</p><p class="muted">Klik perangkat untuk melihat interface, routing, dan service-nya (dibaca dari state simulator). Klik garis link untuk melihat statusnya. Tambah perangkat dari toolbar.</p>`;
}
const chips=r=>r.map((x,i)=>`<span class="hopc${x[1]?" bad":""}">${esc(x[0])}${x[1]?" ❌":""}</span>${i<r.length-1?'<span class="hopa" aria-hidden="true">→</span>':""}`).join("");
function tabPkt(){
 const srcs=NET.devs.filter(d=>d.type!=="switch"),ips=NET.devs.flatMap(d=>d.type==="switch"?[]:Object.values(d.o.ifs).map(f=>f.ip).filter(Boolean));
 let h=pduForm("pk");
 if(BU.sim)h+=simHtml();
 const r=BU.pk;
 if(r){
  const idx=r.ok||r.stage==="reply"?-1:r.ids.indexOf(r.atId),hops=r.ids.map((id,i)=>[(dev(id)||{name:"?"}).name,i===idx]);
  const last=r.hops.length>1?(r.ok?r.hops[r.hops.length-2]+" → "+r.hops[r.hops.length-1]:(idx>0?r.hops[idx-1]+" → "+r.hops[idx]:r.hops[0])):r.hops[0];
  h+=`<div class="pres ${r.ok?"ok":"no"}" role="status"><b>${r.ok?"PACKET DELIVERED":"PACKET DROPPED"}</b><div class="hops">${chips(hops)}</div>${r.ok?"":`<p><b>Stopped at:</b> ${esc(r.at)}${r.stage==="reply"?" (saat reply kembali)":""}</p><p><b>Reason:</b> ${esc(r.reason)}</p>`}<button class="chip s" data-b="pkdetail">${BU.pkOpen?"Tutup detail":"Detail packet"}</button></div>`;
  if(BU.pkOpen)h+=`<div class="pan flat" style="margin-top:8px"><p class="lbl">Detail packet</p><ul class="parts"><li>Protocol: <b>${esc(r.proto)}${r.port?"/"+r.port:""}</b></li><li>Source: <b>${esc(r.src||"-")}</b></li><li>Destination: <b>${esc(r.dst)}</b></li><li>TTL: <b>${r.ttl}</b></li><li>Hop: <b>${esc(last)}</b></li><li>Status: <b>${r.ok?"DELIVERED":"DROPPED"}</b></li></ul></div>`;
 }
 return h;
}
const NSUB=["Interfaces","Routing","ARP","VLAN","ACL","NAT","DHCP"];
function tabNet(){
 const ds=NET.devs;if(!ds.length)return`<p class="muted">Belum ada perangkat.</p>`;
 if(!dev(BU.nd))BU.nd=(dev(BU.sel)||ds[0]).id;
 const d=dev(BU.nd),o=d.o;routing();
 let h=`<p class="lbl">Network Inspector</p><label class="fld">Perangkat<select class="inp" data-b="nsel">${ds.map(x=>`<option value="${x.id}"${x.id===d.id?" selected":""}>${esc(x.name)}</option>`).join("")}</select></label><div class="seg" role="tablist">${NSUB.map(s=>`<button class="chip s" data-b="nsub" data-v="${s}" aria-pressed="${BU.ns===s}">${s}</button>`).join("")}</div>`;
 const pre=l=>`<pre class="code">${l.map(esc).join("\n")||"(kosong)"}</pre>`,only=(t,ok,f)=>ok?f():`<p class="muted">Hanya tersedia untuk ${t}.</p>`;
 if(BU.ns==="Interfaces")h+=ifTable(d);
 if(BU.ns==="Routing")h+=only("router",d.type==="router",()=>{const t=rtable(d),N=d.nbr||{ospf:[],eigrp:[],rip:[]};return pre(t.map(e=>pad(e.code,3)+e.net+"/"+e.len+(e.code==="C"?" is directly connected, ":" ["+e.ad+"/"+e.metric+"] via "+e.nh+", ")+e.ifc))+`<p class="lbl sp">Neighbor</p>`+(["ospf","eigrp"].map(p=>N[p].map(n=>p.toUpperCase()+" "+n.id+" "+n.state+" via "+n.addr+" ("+n.ifc+")")).flat().join("\n")?pre(["ospf","eigrp"].map(p=>N[p].map(n=>p.toUpperCase()+" "+n.id+" "+n.state+" via "+n.addr+" ("+short(n.ifc)+")")).flat()):`<p class="muted">Belum ada neighbor.</p>`)});
 if(BU.ns==="ARP"){const e=Object.entries(d.arp||{});h+=e.length?pre(e.map(([ip,m])=>pad(ip,18)+m)):`<p class="muted">Belum ada entri. ARP terisi saat packet berhasil menemukan next hop (jalankan ping di tab Packet).</p>`}
 if(BU.ns==="VLAN")h+=only("switch",d.type==="switch",()=>pre(Object.entries(o.vlans).map(([id,x])=>pad(id,6)+pad((x&&x.name)||"VLAN"+id,14)+Object.entries(o.ifs).filter(([,p])=>p.mode==="access"&&String(p.vlan)===id).map(([i])=>short(i)).join(", "))).concat(pre(Object.entries(o.ifs).filter(([,p])=>p.mode==="trunk").map(([i,p])=>short(i)+" trunk, native "+p.native+", allowed "+p.allowed))));
 if(BU.ns==="ACL")h+=only("router",d.type==="router",()=>pre(withDevice(o,()=>sbAcls()))+pre(Object.entries(o.ifs).flatMap(([i,f])=>Object.entries(f.acl||{}).map(([dir,id])=>short(i)+": ACL "+id+" "+dir))));
 if(BU.ns==="NAT")h+=only("router",d.type==="router",()=>pre(Object.entries(o.ifs).filter(([,f])=>f.nat).map(([i,f])=>short(i)+": ip nat "+f.nat).concat(o.nat.map(r=>"rule: list "+r.acl+" interface "+r.ifc+" overload")))+pre(withDevice(o,()=>natLines())));
 if(BU.ns==="DHCP")h+=only("router",d.type==="router",()=>pre(Object.entries(o.dhcp.pools).map(([n,p])=>"pool "+n+": "+(p.net||"-")+" gw "+(p.gw||"-")+" dns "+(p.dns||"-")).concat(o.dhcp.ex.map(e=>"excluded "+e[0]+" - "+e[1])))+pre(withDevice(o,()=>dhcpLines())));
 return h;
}
function tabDiff(){
 const ds=NET.devs.filter(d=>d.type==="router"||d.type==="switch");if(!ds.length)return`<p class="muted">Tambahkan router atau switch dulu.</p>`;
 if(!ds.some(d=>d.id===BU.dd))BU.dd=ds[0].id;const d=dev(BU.dd),r=cfgDiff(d,BU.dt),good=r.filter(x=>x.ok).length;
 return `<p class="lbl">Compare Configuration</p><p class="muted" style="margin-top:0">Konfigurasi perangkat dibandingkan dengan template konfigurasi yang diharapkan.</p><label class="fld">Perangkat<select class="inp" data-b="ddsel">${ds.map(x=>`<option value="${x.id}"${x.id===d.id?" selected":""}>${esc(x.name)}</option>`).join("")}</select></label><label class="fld">Expected config<select class="inp" data-b="dtsel">${Object.keys(CFGT).map(k=>`<option${k===BU.dt?" selected":""}>${esc(k)}</option>`).join("")}</select></label><ul class="chk-list">${r.map(x=>`<li class="${x.ok?"ok":"no"}">${x.ok?"✅":"❌"} ${esc(x.sec?x.sec+" › ":"")}${esc(x.line)}${x.ok?"":`<br><span class="muted">Expected: ${esc(x.expect)}${x.actual?" · Actual: "+esc(x.actual):""}</span>`}</li>`).join("")}</ul><p><b>${good} benar</b>, <b>${r.length-good} perlu diperbaiki</b></p>`;
}
const tabTl=()=>`<p class="lbl">Network Timeline</p>${NET.tl.length?`<ul class="tlist">${NET.tl.slice().reverse().map(x=>`<li><b>${esc(x.t)}</b> ${esc(x.m)}</li>`).join("")}</ul>`:`<p class="muted">Belum ada aktivitas.</p>`}<button class="chip" data-b="tlclear">Clear History</button>`;
function tabProj(){
 const r=BU.res;let h="";
 if(NET.gen)h+=`<p class="lbl">Generated Lab #${NET.gen.seed}</p><p style="margin:0 0 6px">${"⭐".repeat(NET.gen.k)} Hubungkan seluruh LAN menggunakan <b>${NET.gen.proto}</b>. Semua PC harus bisa saling ping.</p><button class="act" style="width:auto" data-b="gcheck">Periksa objective</button>${r&&r.gen?`<ul class="chk-list">${r.gen.res.map(x=>`<li class="${x.ok?"ok":"no"}">${x.ok?"✅":"❌"} ${esc(x.a)} → ${esc(x.b)}${x.ok?"":" <span class='muted'>"+esc(x.at+": "+x.reason)+"</span>"}</li>`).join("")}</ul>${r.gen.ok?`<div class="fb ok" role="status"><b>Objective selesai!</b></div>`:""}`:""}<hr class="sep">`;
 h+=`<p class="lbl">Network Project: Jaringan Sekolah</p><p class="muted" style="margin-top:0">Bangun topologi sendiri, lalu periksa. Semua penilaian dibaca dari state simulator.</p><ul class="parts"><li>2 Router, 2 Switch, 4 PC (semua terhubung)</li><li>2 VLAN dan port access terpasang</li><li>DHCP pool</li><li>OSPF dengan neighbor FULL</li><li>Ping antar-LAN berhasil</li><li>NAT</li><li>ACL</li></ul><button class="act" style="width:auto" data-b="pcheck">Periksa Project</button>`;
 if(r&&r.proj){const p=r.proj;h+=`<ul class="chk-list">${p.items.map(x=>`<li class="${x[1]?"ok":"no"}">${x[1]?"✅":"❌"} ${esc(x[0])}${x[1]?"":`<br><span class="muted">${esc(x[2])}</span>`}</li>`).join("")}</ul><p><b>Score: ${p.score} / 100</b> (${p.passed} dari ${p.total} item)</p><p class="muted" style="font-size:.82rem">${esc(p.unsupported)}</p>${p.score===100?`<div class="fb ok" role="status"><b>NETWORK PROJECT COMPLETE</b> ${r.xp?"+"+r.xp+" XP":""}</div>`:""}`}
 return h;
}
const nm=id=>id?(dev(id)||{name:"?"}).name:"---";
const ico=p=>`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const RAIL=[["zin","Zoom in (+)",'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>'],["zout","Zoom out (-)",'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8 11h6"/>'],["zfit","Fit to screen (0)",'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'],["mode:connect","Connect (hubungkan perangkat)",'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'],["mode:delete","Delete mode",'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'],["undo","Undo (Ctrl+Z)",'<path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>'],["redo","Redo (Ctrl+Y)",'<path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3"/>'],["copy","Salin (Ctrl+C)",'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'],["paste","Tempel (Ctrl+V)",'<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h6v2M9 12h6M9 16h4"/>'],["save","Save lab",'<path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/>'],["runsim","Simulasi: uji koneksi semua perangkat akhir",'<path d="M7 4l13 8-13 8z"/>'],["help","Shortcut keyboard (?)",'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>']];
const railHtml=()=>RAIL.map(([k,t,p])=>{const m=k.split(":"),pr=m[0]==="mode"?` aria-pressed="${BU.mode===m[1]}"`:"";return `<button class="rbtn" data-b="${m[0]}"${m[1]?` data-v="${m[1]}"`:""}${pr} aria-label="${esc(t)}" title="${esc(t)}">${ico(p)}</button>`}).join("");
const KBD_HELP=[["Shift + klik / Shift + seret","Pilih beberapa perangkat"],["Seret perangkat terpilih","Pindahkan semuanya sekaligus"],["Delete","Hapus perangkat terpilih"],["Ctrl+C / Ctrl+V","Salin dan tempel (tanpa konfigurasi)"],["Ctrl+Z / Ctrl+Y","Undo / Redo"],["Ctrl+A","Pilih semua"],["+ / - / 0","Zoom in / out / fit"],["Esc","Batalkan pilihan"],["?","Tampilkan bantuan ini"]];
function delSel(){
 const ids=BU.msel.size?[...BU.msel]:(BU.sel?[BU.sel]:[]);if(!ids.length)return false;
 snap();ids.forEach(id=>{const d=dev(id);if(!d)return;NET.links=NET.links.filter(l=>l.a.d!==id&&l.b.d!==id);NET.devs=NET.devs.filter(x=>x.id!==id);tlog("Deleted "+d.name)});
 BU.msel=new Set();BU.sel=null;BU.link=null;saveNet();bdraw();return true;
}
function copySel(){
 const ids=BU.msel.size?[...BU.msel]:(BU.sel?[BU.sel]:[]),ds=ids.map(dev).filter(Boolean);if(!ds.length){toast("Pilih perangkat dulu");return false}
 BU.clip={devs:ds.map(d=>({id:d.id,type:d.type,kind:d.kind||d.type,x:d.x,y:d.y})),links:NET.links.filter(l=>ids.includes(l.a.d)&&ids.includes(l.b.d)).map(l=>JSON.parse(JSON.stringify(l))),off:0};
 toast(ds.length+" perangkat disalin (konfigurasi tidak ikut)");return true;
}
function pasteClip(){
 const c=BU.clip;if(!c){toast("Clipboard kosong. Salin perangkat dulu.");return false}
 snap();c.off+=40;const map={},nd=[];
 c.devs.forEach(s=>{const K=KINDS[s.kind];let n=NET.devs.filter(d=>(d.kind||d.type)===s.kind).length+1;while(NET.devs.some(d=>d.name===K.pre+n))n++;
  const d=mkDev(s.type,K.pre+n,Math.min(596,s.x+c.off),Math.min(350,s.y+c.off),s.kind);map[s.id]=d.id;NET.devs.push(d);nd.push(d)});
 c.links.forEach(l=>{if(map[l.a.d]&&map[l.b.d])NET.links.push({a:{d:map[l.a.d],i:l.a.i},b:{d:map[l.b.d],i:l.b.i}})});
 BU.msel=new Set(nd.map(d=>d.id));BU.sel=nd[0].id;tlog("Pasted "+nd.length+" device(s)");saveNet();bdraw();toast(nd.length+" perangkat ditempel");return true;
}
function inspMulti(){return `<p class="lbl">${BU.msel.size} perangkat dipilih</p><p class="muted">Seret salah satu untuk memindahkan semuanya. Delete menghapus, Ctrl+C lalu Ctrl+V menggandakan (tanpa konfigurasi, supaya IP tidak bentrok).</p><div class="seg"><button class="chip" data-b="copy">Salin</button><button class="chip" data-b="delsel">Hapus</button></div><ul class="parts">${[...BU.msel].map(i=>`<li>${esc(nm(i))}</li>`).join("")}</ul>`}
const pduForm=p=>{
 const L=BU.last[p]||{},srcs=NET.devs.filter(d=>d.type!=="switch"),ips=NET.devs.flatMap(d=>d.type==="switch"?[]:Object.values(d.o.ifs).map(f=>f.ip).filter(Boolean)),sim=p==="sp";
 return `<p class="lbl">${sim?"Buat paket (PDU)":"Packet Simulation"}</p><label class="fld">Sumber<select class="inp" id="${p}s">${srcs.map(d=>`<option value="${d.id}"${d.id===L.s?" selected":""}>${esc(d.name)}</option>`).join("")||"<option value=''>(belum ada PC/Server/Router)</option>"}</select></label><label class="fld">Tujuan (IP)<input class="inp" id="${p}d" list="${p}ips" autocomplete="off" placeholder="192.168.2.10" value="${esc(L.d||"")}"></label><datalist id="${p}ips">${[...new Set(ips)].map(i=>`<option value="${i}">`).join("")}</datalist><div class="seg"><label class="fld" style="flex:1">Protokol<select class="inp" id="${p}p">${["icmp","tcp","udp"].map(x=>`<option${x===L.p?" selected":""}>${x}</option>`).join("")}</select></label><label class="fld" style="flex:1">Port<input class="inp" id="${p}port" type="number" min="0" max="65535" value="${L.port||0}"></label></div><button class="act" style="width:auto" data-b="${sim?"smcreate":"pkrun"}">${sim?"Buat paket":"Kirim packet"}</button>`;
};
const SFIL={v4:["ARP","ICMP","TCP","UDP"],v4off:["DHCP","DNS"],v6:["ICMPv6","NDP"],misc:["BGP","EIGRP","HSRP","OSPF","RIP","VLAN"]};
function explainEv(e){
 if(e.kind==="ARP")return e.title.startsWith("ARP request")?"Untuk mengirim frame Ethernet, pengirim harus tahu MAC address tujuan. Karena belum ada di cache ARP, ia menyiarkan (broadcast) pertanyaan ini ke seluruh segmen L2.":e.status==="drop"?"Tidak ada perangkat yang menjawab ARP, jadi paket tidak bisa dikirim. Periksa kabel, status interface, VLAN, dan IP.":"Perangkat tujuan menjawab dengan MAC address-nya. Pengirim menyimpannya di cache ARP sehingga paket berikutnya tidak perlu ARP lagi.";
 if(e.status==="drop")return "Paket dibuang di sini. Alasan: "+e.reason;
 const t=dev(e.at);
 if(t&&t.type==="switch")return "Switch meneruskan frame berdasarkan MAC address dan VLAN. Switch tidak melihat alamat IP.";
 if(t&&t.type==="router"&&e.title.includes("meneruskan"))return "Router memeriksa ACL, mengurangi TTL, mencari route terbaik di routing table, menerapkan NAT jika ada, lalu meneruskan paket ke next hop.";
 if(e.title.startsWith("Membuat"))return "Sumber memeriksa konfigurasinya: tujuan satu subnet dikirim langsung, tujuan beda subnet dikirim ke default gateway.";
 if(e.title.startsWith("Diterima"))return e.dir==="reply"?"Balasan sampai ke pengirim asli, jadi ping berhasil.":"Paket sampai di tujuan. Perangkat tujuan akan membalas.";
 return "";
}
function evInspector(e){
 const row=(k,v)=>v?`<li><span>${k}</span><b>${esc(String(v))}</b></li>`:"";
 return `<p class="lbl sp">Event Inspector</p><div class="evi"><b>#${e.n} · ${esc(e.title)}</b> <span class="stb ${e.status==="drop"?"bad":e.status==="ok"?"ok":"off"}"><i></i>${e.status==="drop"?"Dibuang":e.status==="ok"?"Diteruskan":"Info"}</span><ul class="evl2">${row("Protokol",e.kind+(e.dir==="reply"?" (balasan)":""))}${row("Waktu (virtual)",e.t.toFixed(3)+" s")}${row("Dari → di",nm(e.last)+" → "+nm(e.at))}${row("Source IP",e.src)}${row("Destination IP",e.dst)}${row("Source MAC",e.srcMac)}${row("Destination MAC",e.dstMac)}${row("Interface masuk",e.inIf&&short(e.inIf))}${row("Interface keluar",e.outIf&&short(e.outIf))}${row("Next hop",e.nextHop)}${row("TTL",e.kind==="ARP"?"":e.ttl)}</ul><p class="lbl sp">Tahapan yang terjadi</p><ul class="chk-list">${(e.steps||[]).map(s=>`<li class="${s.ok?"ok":"no"}">${s.ok?"✓":"✗"} <b>${esc(s.k)}</b>: ${esc(s.t)}</li>`).join("")||"<li class='muted'>—</li>"}</ul>${e.reason?`<p><b>Alasan:</b> ${esc(e.reason)}</p>`:""}<div class="tipbox"><b>Penjelasan:</b> ${esc(explainEv(e))}</div></div>`;
}
function tabSim(){
 const S=BU.sm;let h=pduForm("sp");
 if(!S)return h+`<p class="muted" style="margin-top:10px">Buat paket untuk memuat event. Setiap baris berasal dari mesin simulasi (ARP, keputusan routing, ACL, NAT, forwarding). Waktu adalah waktu virtual, bukan pengukuran.</p>`;
 const vis=S.events.map((e,i)=>({e,i})).filter(x=>S.f[x.e.kind]),fl={v4:SFIL.v4,v6:[],misc:[]}[S.ft]||[];
 h+=`<p class="lbl sp">Play Controls</p><div class="pbctl"><button class="chip" data-b="sstepb" aria-label="Langkah mundur">⏮</button><button class="act" style="width:auto" data-b="splay">${S.playing?"⏸ Pause":"▶ Play"}</button><button class="chip" data-b="sstepf" aria-label="Langkah maju">⏭</button></div><label class="fld">Kecepatan: <b id="sspv">${S.speed}x</b><input type="range" min="0.25" max="4" step="0.25" value="${S.speed}" data-b="sspeed" aria-label="Kecepatan simulasi"></label>`;
 h+=`<div class="evhead"><b class="lbl" style="margin:0">Event List</b><button class="chip s" data-b="sreset">Reset Simulation</button></div><div class="tbl-wrap"><table class="tbl evt"><thead><tr><th>#</th><th title="Waktu simulasi virtual (detik)">Time</th><th>Last</th><th>At</th><th>Type</th><th></th></tr></thead><tbody>${vis.map(({e,i})=>`<tr class="${i<=S.idx?"done":"fut"}${S.sel===i?" sel":""}" data-b="sevt" data-v="${i}" tabindex="0"><td>${e.n}</td><td>${e.t.toFixed(3)}</td><td>${esc(nm(e.last))}</td><td>${esc(nm(e.at))}</td><td>${e.kind}${e.dir==="reply"?" ↩":""}</td><td><i class="evd ${e.status}" title="${e.status}"></i></td></tr>`).join("")||`<tr><td colspan="6" class="muted">Semua event tersaring.</td></tr>`}</tbody></table></div>`;
 h+=`<div class="evhead" style="margin-top:12px"><b class="lbl" style="margin:0">Event List Filter</b></div><div class="seg">${[["v4","Ipv4"],["v6","Ipv6"],["misc","Misc"]].map(([k,l])=>`<button class="chip s" data-b="sftab" data-v="${k}" aria-pressed="${S.ft===k}">${l}</button>`).join("")}</div><div class="fgrid">${S.ft==="v4"?SFIL.v4.map(k=>`<label class="fchk"><input type="checkbox" data-b="sfil" data-v="${k}" ${S.f[k]?"checked":""}> ${k}</label>`).join("")+SFIL.v4off.map(k=>`<label class="fchk off" title="Simulator belum menghasilkan event ${k}"><input type="checkbox" disabled> ${k}</label>`).join(""):(S.ft==="v6"?SFIL.v6:SFIL.misc).map(k=>`<label class="fchk off" title="Simulator belum menghasilkan event ${k}"><input type="checkbox" disabled> ${k}</label>`).join("")}</div>${S.ft==="v4"?"":`<p class="muted" style="font-size:.78rem">Event ${S.ft==="v6"?"IPv6":"routing protocol dan VLAN"} belum dimodelkan. Routing OSPF/RIP/EIGRP dihitung, tetapi pesan protokolnya tidak disimulasikan per paket.</p>`}`;
 if(S.sel!=null&&S.events[S.sel])h+=evInspector(S.events[S.sel]);else h+=`<p class="muted" style="margin-top:10px">Tekan Step atau klik baris event untuk memeriksa paket dan menyorot perangkat di kanvas.</p>`;
 return h;
}
const smVis=()=>BU.sm.events.map((e,i)=>i).filter(i=>BU.sm.f[BU.sm.events[i].kind]);
function smHl(){
 const S=BU.sm,e=S&&S.idx>=0?S.events[S.idx]:null;BU.evhl=new Set();BU.evlink=new Set();
 if(e){[e.at,e.last,...(e.path||[])].filter(Boolean).forEach(i=>BU.evhl.add(i));const ch=e.path||[e.last,e.at];for(let i=0;i<ch.length-1;i++){const k=linkIdx(ch[i],ch[i+1]);if(k>=0)BU.evlink.add(k)}}
}
function smDot(e){
 const a=dev(e.last),b=dev(e.at),g=$("#bg-pkt");if(!a||!b||!g||a===b||linkIdx(a.id,b.id)<0||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
 const tok=++BU.anim,col=e.status==="drop"?"#EF4444":e.kind==="ARP"?"#F59E0B":"#22D3EE",dur=Math.max(160,420/(BU.sm?BU.sm.speed:1));let t0=null;
 const f=ts=>{if(BU.anim!==tok)return;if(t0===null)t0=ts;const p=Math.min(1,(ts-t0)/dur);g.innerHTML=`<circle class="pkt" style="fill:${col}" cx="${a.x+(b.x-a.x)*p}" cy="${a.y-4+(b.y-a.y)*p}" r="7"/>`;if(p<1)requestAnimationFrame(f);else setTimeout(()=>{if(BU.anim===tok)g.innerHTML=""},260)};
 requestAnimationFrame(f);
}
function smGo(i){const S=BU.sm;if(!S||!S.events[i])return;S.idx=i;S.sel=i;const e=S.events[i];BU.errId=e.status==="drop"?e.at:null;smHl();drawSvg();drawPanel();const r=document.querySelector('tr[data-v="'+i+'"]');if(r&&r.scrollIntoView)r.scrollIntoView({block:"nearest"});smDot(e)}
function smStop(){if(BU.smTimer){clearTimeout(BU.smTimer);BU.smTimer=null}if(BU.sm)BU.sm.playing=false}
function smReset(){smStop();const S=BU.sm;if(!S)return;S.idx=-1;S.sel=null;BU.errId=null;BU.anim++;smHl();drawSvg();drawPanel();const g=$("#bg-pkt");if(g)g.innerHTML=""}
function smStep(d){
 const S=BU.sm;if(!S)return false;const v=smVis();let n;
 if(d>0)n=v.find(i=>i>S.idx);else{const p=v.filter(i=>i<S.idx);if(!p.length){if(S.idx>=0){smReset();return true}return false}n=p[p.length-1]}
 if(n===undefined)return false;smGo(n);return true;
}
function smPlay(){
 const S=BU.sm;if(!S)return;if(S.playing){smStop();drawPanel();return}
 S.playing=true;drawPanel();
 const tick=()=>{if(!BU.sm||!BU.sm.playing)return;if(!smStep(1)){smStop();drawPanel();toast("Simulasi selesai");return}BU.smTimer=setTimeout(tick,900/BU.sm.speed)};tick();
}
function smLoad(res){
 smStop();const o=BU.sm;BU.sm={events:res.events,idx:-1,sel:null,playing:false,speed:o?o.speed:1,f:o?o.f:{ARP:true,ICMP:true,TCP:true,UDP:true},ft:"v4"};
 BU.pk=res;BU.errId=null;BU.tab="simp";BU.collapsed=false;smHl();tlog("Simulation: "+res.proto+" "+res.src+" → "+res.dst+" ("+res.events.length+" event)");saveNet();bdraw();
}
function tabLabs(){
 const L=store.get("labs",[]),im=BU.impMsg;
 return `<p class="lbl">My Labs</p><label class="fld">Nama lab<input class="inp" id="lname" value="${esc(NET.name)}" maxlength="30"></label><div class="seg"><button class="act" style="width:auto" data-b="lsave">💾 Save Lab</button><button class="chip" data-b="lrename">✎ Ubah nama</button><button class="chip" data-b="lgen">🎲 Generate Lab</button><button class="chip" data-b="lreset">${BU.arm==="reset"?"Yakin? Ketuk lagi":"🔄 Reset"}</button></div>${L.length?`<ul class="tlist">${L.map(x=>`<li><b>${esc(x.name)}</b> <span class="muted">${esc(x.ts)}</span><div class="seg" style="margin-top:4px"><button class="chip s" data-b="lopen" data-v="${x.id}">Buka</button><button class="chip s" data-b="ldup" data-v="${x.id}">📋 Duplicate</button><button class="chip s" data-b="ldel" data-v="${x.id}">${BU.arm==="del"+x.id?"Yakin?":"🗑 Delete"}</button></div></li>`).join("")}</ul>`:`<p class="muted">Belum ada lab tersimpan.</p>`}<hr class="sep"><p class="lbl">Template</p><label class="fld">Mulai dari template<select class="inp" data-b="tplsel"><option value="">Pilih template…</option>${Object.entries(TPLS).map(([k,v])=>`<option value="${k}">${esc(v[0])}</option>`).join("")}</select></label><p class="muted" id="tpldesc" style="font-size:.82rem">Template mengganti topologi saat ini. Undo tersedia.</p><hr class="sep"><p class="lbl">Ekspor dan impor</p><div class="seg"><button class="chip" data-b="exportp">⬇ Ekspor JSON</button><button class="chip" data-b="importp">⬆ Impor JSON</button></div><input type="file" id="impfile" accept=".json,application/json" hidden data-b="impfile"><p class="muted" style="font-size:.8rem">Format: schema ${PJ.schema}, versi ${PJ.version}. File divalidasi (perangkat, port, koneksi, IP) dan tidak pernah dijalankan sebagai kode.</p>${im?`<div class="fb ${im.ok?"ok":"no"}" role="status">${im.ok?esc(im.msg):"<b>Impor ditolak.</b> "+im.errors.map(esc).join("<br>")}</div>`:""}`;
}
const BTABS=[["insp","Inspector"],["pkt","Packet"],["net","Network"],["diff","Diff"],["tl","Timeline"],["labs","Labs"],["proj","Project"]];
function drawPanel(){
 const b=$("#bbody");if(!b)return;
 const keep=document.activeElement&&document.activeElement.id==="bcmd";
 b.innerHTML={insp:tabInsp,pkt:tabPkt,net:tabNet,diff:tabDiff,tl:tabTl,labs:tabLabs,proj:tabProj,simp:tabSim}[BU.tab]();
 b.hidden=BU.collapsed;
 document.querySelectorAll("[data-b=tab]").forEach(x=>x.setAttribute("aria-selected",x.dataset.v===BU.tab));
 const o=$("#bout");if(o)o.scrollTop=o.scrollHeight;
}
function bdraw(){BU.msel=new Set([...BU.msel].filter(i=>dev(i)));bflags();drawSvg();drawPanel();const m=$("#bmsg");if(m)m.textContent=BU.msg||{select:"Seret perangkat untuk memindahkannya. Klik perangkat untuk melihat Device Inspector.",connect:"Mode Connect: klik dua perangkat untuk menghubungkannya.",delete:"Mode Delete: klik perangkat untuk menghapusnya (Undo tersedia)."}[BU.mode]}
function renderBuilder(){
 const tabs=BU.pmode==="sim"?[["simp","Simulation"],...BTABS]:BTABS;
 $("#view").innerHTML=`<div class="sb-head"><div><p class="crumb2">NETLAB / TOPOLOGY BUILDER</p><h1 class="pg" style="margin:2px 0 0">Topology Builder</h1></div><span class="devbadge" id="bname">${esc(NET.name)}</span></div>
 <div class="modebar" role="group" aria-label="Mode simulasi"><button class="mbtn" data-b="pmode" data-v="real" aria-pressed="${BU.pmode==="real"}">⏱ Real time</button><button class="mbtn" data-b="pmode" data-v="sim" aria-pressed="${BU.pmode==="sim"}">⏲ Simulation</button><span class="mhint">${BU.pmode==="sim"?"Paket dijalankan langkah demi langkah (Play, Step, Reset).":"Paket langsung dikirim dan hasilnya ditampilkan."}</span></div>
 <p class="muted" id="bmsg" role="status" style="margin:6px 0 10px"></p>
 <div class="seg bdevices" role="tablist" aria-label="Perangkat aktif">${NET.devs.length?NET.devs.map(d=>`<button class="chip s" data-b="device" data-v="${d.id}" role="tab" aria-selected="${d.id===BU.sel}">${esc(d.name)} <small>${esc(kindOf(d).label)}</small></button>`).join(""):"<span class=\"muted\">Tambahkan perangkat untuk membuka workspace CLI.</span>"}</div>
 <div class="blayout"><aside class="pan bpal" aria-label="Katalog perangkat">${palHtml()}</aside>
 <section class="pan bcanvas"><div class="bcol"><div class="trail" role="toolbar" aria-label="Alat kanvas">${railHtml()}</div><div class="bwrap"><svg id="bsvg" viewBox="${BU.vb.x} ${BU.vb.y} ${BU.vb.w} ${BU.vb.h}" role="group" aria-label="Kanvas topologi"><g id="bg-main"></g><g id="bg-pkt"></g><g id="bg-ui"></g></svg><p class="bempty" id="bempty" ${NET.devs.length?"hidden":""}>Kanvas kosong. Seret perangkat dari katalog ke sini (atau klik untuk menambah), pilih template di tab Labs, atau Generate Lab.</p></div></div><div id="btip" role="tooltip" hidden></div><div class="shelp" id="shelp" ${BU.help?"":"hidden"} role="dialog" aria-label="Shortcut keyboard"><b>Shortcut keyboard</b><ul>${KBD_HELP.map(h=>`<li><kbd>${esc(h[0])}</kbd> ${esc(h[1])}</li>`).join("")}</ul></div><div class="bfoot"><div class="blegend" aria-label="Legenda status"><span><i class="dotc ok"></i>Aktif</span><span><i class="dotc warn"></i>Warning</span><span><i class="dotc bad"></i>Error</span><span><i class="dotc off"></i>Offline</span><span><i class="ln up"></i>Link aktif</span><span><i class="ln flow"></i>Traffic</span><span><i class="ln down"></i>Link putus</span></div><svg id="bmini" viewBox="0 0 640 400" role="img" aria-label="Mini-map topologi"></svg></div></section>
 <aside class="pan bpanel"><div class="btabs" role="tablist" aria-label="Panel">${tabs.map(t=>`<button class="chip s" role="tab" data-b="tab" data-v="${t[0]}" aria-selected="${t[0]===BU.tab}">${t[1]}</button>`).join("")}<button class="chip s" data-b="collapse" aria-label="Ciutkan panel">${BU.collapsed?"▸":"▾"}</button></div><div id="bbody"></div></aside></div>`;
 bdraw();
}
const svgPt=e=>{const sv=$("#bsvg"),p=sv.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(sv.getScreenCTM().inverse())};
document.addEventListener("pointerdown",e=>{
 const pal=e.target.closest&&e.target.closest("[data-pal]");
 if(pal){BU.pdrag={k:pal.dataset.pal,sx:e.clientX,sy:e.clientY,ghost:null};return}
 const sv=e.target.closest&&e.target.closest("#bsvg");if(!sv)return;
 const tp=$("#btip");if(tp)tp.hidden=true;
 const g=e.target.closest("[data-dev]"),lk=e.target.closest("[data-link]");
 if(g){const id=g.dataset.dev;
  if(BU.mode==="delete")return delDev(id);
  if(BU.mode==="connect"){if(!BU.cA){BU.cA=id;BU.msg="Pilih perangkat kedua."}else if(BU.cA===id){BU.cA=null;BU.msg=""}else{BU.pend=[BU.cA,id];BU.cA=null;BU.msg="";BU.tab="insp";BU.collapsed=false}bdraw();return}
  if(e.shiftKey||e.ctrlKey||e.metaKey){if(BU.msel.has(id))BU.msel.delete(id);else BU.msel.add(id);BU.sel=BU.msel.size?[...BU.msel].pop():null;BU.link=null;BU.tab="insp";bdraw();return}
  if(!BU.msel.has(id))BU.msel=new Set([id]);
  BU.sel=id;BU.link=null;BU.pend=null;
  BU.drag={id,sx:e.clientX,sy:e.clientY,moved:false,snapped:false,p0:svgPt(e),g:[...BU.msel].map(i=>({id:i,x:dev(i).x,y:dev(i).y}))};
  if(BU.tab==="net")BU.nd=id;else if(BU.tab!=="simp"&&BU.tab!=="pkt")BU.tab="insp";else if(BU.tab==="pkt")BU.tab="insp";
  BU.collapsed=false;bdraw();return}
 if(lk){BU.link=+lk.dataset.link;BU.sel=null;BU.msel=new Set();BU.pend=null;BU.tab="insp";bdraw();return}
 if(e.shiftKey){const p=svgPt(e);BU.band={x0:p.x,y0:p.y,x1:p.x,y1:p.y};return}
 BU.pan={sx:e.clientX,sy:e.clientY,vx:BU.vb.x,vy:BU.vb.y,moved:false};
});
document.addEventListener("pointermove",e=>{
 const pd=BU.pdrag;
 if(pd){if(!pd.ghost&&Math.hypot(e.clientX-pd.sx,e.clientY-pd.sy)>6){const gh=document.createElement("div");gh.className="pghost";gh.innerHTML=devIcon(pd.k,{size:60});document.body.appendChild(gh);pd.ghost=gh}if(pd.ghost){pd.ghost.style.left=e.clientX-30+"px";pd.ghost.style.top=e.clientY-26+"px"}return}
 const bd=BU.band;
 if(bd){const p=svgPt(e);bd.x1=p.x;bd.y1=p.y;const u=$("#bg-ui");if(u)u.innerHTML=`<rect class="bband" x="${Math.min(bd.x0,bd.x1)}" y="${Math.min(bd.y0,bd.y1)}" width="${Math.abs(bd.x1-bd.x0)}" height="${Math.abs(bd.y1-bd.y0)}"/>`;return}
 const pn=BU.pan;
 if(pn){const dx=e.clientX-pn.sx,dy=e.clientY-pn.sy;if(!pn.moved&&Math.hypot(dx,dy)<4)return;pn.moved=true;const sv=$("#bsvg");if(!sv)return;const sc=BU.vb.w/sv.getBoundingClientRect().width;vbSet({x:pn.vx-dx*sc,y:pn.vy-dy*sc,w:BU.vb.w});return}
 const dr=BU.drag;if(!dr)return;if(!dr.moved&&Math.hypot(e.clientX-dr.sx,e.clientY-dr.sy)<4)return;
 const sv=$("#bsvg");if(!sv||!sv.getScreenCTM())return;
 if(!dr.snapped){snap();dr.snapped=true}dr.moved=true;
 const q=svgPt(e),dx=q.x-dr.p0.x,dy=q.y-dr.p0.y;
 dr.g.forEach(o=>{const d=dev(o.id);if(!d)return;d.x=Math.max(44,Math.min(596,Math.round(o.x+dx)));d.y=Math.max(46,Math.min(350,Math.round(o.y+dy)))});drawSvg();
});
document.addEventListener("pointerup",e=>{
 const pd=BU.pdrag;
 if(pd){BU.pdrag=null;if(pd.ghost){pd.ghost.remove();const sv=$("#bsvg");if(sv){const r=sv.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){const q=svgPt(e);addDev(pd.k,Math.max(60,Math.min(590,Math.round(q.x))),Math.max(60,Math.min(345,Math.round(q.y))))}}BU.noclick=true;setTimeout(()=>{BU.noclick=false},60)}return}
 if(BU.band){const b=BU.band;BU.band=null;const u=$("#bg-ui");if(u)u.innerHTML="";const x0=Math.min(b.x0,b.x1),x1=Math.max(b.x0,b.x1),y0=Math.min(b.y0,b.y1),y1=Math.max(b.y0,b.y1);
  BU.msel=new Set(NET.devs.filter(d=>d.x>=x0&&d.x<=x1&&d.y>=y0&&d.y<=y1).map(d=>d.id));BU.sel=BU.msel.size?[...BU.msel][0]:null;BU.link=null;bdraw();return}
 if(BU.pan){const pn=BU.pan;BU.pan=null;if(!pn.moved){BU.sel=null;BU.msel=new Set();BU.link=null;BU.pend=null;bdraw()}}
 if(BU.drag){if(BU.drag.moved)saveNet();BU.drag=null}
});
document.addEventListener("wheel",e=>{const sv=e.target.closest&&e.target.closest("#bsvg");if(!sv||!(e.ctrlKey||e.metaKey))return;e.preventDefault();const p=sv.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(sv.getScreenCTM().inverse());zoomBy(e.deltaY<0?1.2:1/1.2,q.x,q.y)},{passive:false});
const tipShow=(d,ev)=>{const t=$("#btip"),c=$(".bcanvas");if(!t||!c)return;const L=devTip(d);t.innerHTML=`<b>${esc(L[0])}</b><span>${esc(L[1])}</span>${L.slice(2).map(x=>`<div>${esc(x)}</div>`).join("")}`;t.hidden=false;const r=c.getBoundingClientRect(),x=(ev.clientX!==undefined?ev.clientX:r.left+r.width/2)-r.left+14,y=(ev.clientY!==undefined?ev.clientY:r.top+40)-r.top+14;t.style.left=Math.max(4,Math.min(x,r.width-200))+"px";t.style.top=Math.max(4,Math.min(y,r.height-120))+"px"};
const tipHide=()=>{const t=$("#btip");if(t)t.hidden=true};
window.addEventListener("netlab:insert-command",e=>{const i=$("#bcmd");if(!i)return;i.value=e.detail.command;i.focus()});
document.addEventListener("pointerover",e=>{const g=e.target.closest&&e.target.closest("#bsvg [data-dev]");if(g&&!BU.drag&&!BU.pan&&e.pointerType!=="touch"){const d=dev(g.dataset.dev);if(d)tipShow(d,e)}});
document.addEventListener("pointerout",e=>{if(e.target.closest&&e.target.closest("#bsvg [data-dev]"))tipHide()});
document.addEventListener("focusin",e=>{const g=e.target.closest&&e.target.closest("#bsvg [data-dev]");if(g){const d=dev(g.dataset.dev);if(d)tipShow(d,{})}});
document.addEventListener("focusout",e=>{if(e.target.closest&&e.target.closest("#bsvg [data-dev]"))tipHide()});
document.addEventListener("keydown",e=>{
 if(e.target&&e.target.id==="bcmd"){
  const d=dev(BU.sel);if(!d)return;
  if(e.key==="Enter"){const v=e.target.value;e.target.value="";snap();devRun(d,v);d.o.hist=d.o.hist||[];if(v.trim())d.o.hist.push(v);d.o.hi=d.o.hist.length;
   if(v.trim()&&!/^(show|ping|traceroute|exit|end|enable|disable|configure|conf|\?|do |simulate)/i.test(v.trim()))tlog(d.name+": "+v.trim());
   saveNet();bflags();drawSvg();drawTerm(d);return}
  if(e.key==="ArrowUp"){const h=d.o.hist||[];if(h.length){d.o.hi=Math.max(0,(d.o.hi===undefined?h.length:d.o.hi)-1);e.target.value=h[d.o.hi]||""}e.preventDefault()}
  if(e.key==="ArrowDown"){const h=d.o.hist||[];d.o.hi=Math.min(h.length,(d.o.hi||0)+1);e.target.value=h[d.o.hi]||"";e.preventDefault()}
  return}
 if(e.key==="Enter"&&e.target.closest&&e.target.closest("#bsvg")&&e.target.dataset.dev){BU.sel=e.target.dataset.dev;BU.link=null;bdraw()}
});
document.addEventListener("keydown",e=>{
 if(!$("#bsvg"))return;const t=e.target,tag=t&&t.tagName;
 if(e.key==="Enter"&&t&&t.matches&&t.matches('tr[data-b="sevt"]')){smStop();smGo(+t.dataset.v);return}
 if(tag==="INPUT"||tag==="SELECT"||tag==="TEXTAREA")return;
 const mod=e.ctrlKey||e.metaKey,k=(e.key||"").toLowerCase();
 if(k==="delete"){if(delSel())e.preventDefault();return}
 if(mod&&k==="c"){copySel();e.preventDefault();return}
 if(mod&&k==="v"){pasteClip();e.preventDefault();return}
 if(mod&&k==="a"){BU.msel=new Set(NET.devs.map(d=>d.id));BU.sel=NET.devs.length?NET.devs[0].id:null;bdraw();e.preventDefault();return}
 if(mod&&k==="z"&&!e.shiftKey){bundo();e.preventDefault();return}
 if(mod&&(k==="y"||(k==="z"&&e.shiftKey))){bredo();e.preventDefault();return}
 if(k==="escape"){BU.msel=new Set();BU.sel=null;BU.link=null;BU.pend=null;BU.cA=null;BU.mode="select";BU.help=false;renderBuilder();return}
 if(k==="?"){BU.help=!BU.help;const hp=$("#shelp");if(hp)hp.hidden=!BU.help;return}
 if(!mod&&(k==="+"||k==="=")){zoomBy(1.25);return}
 if(!mod&&k==="-"){zoomBy(1/1.25);return}
 if(!mod&&k==="0"){vbSet({x:0,y:0,w:640});return}
});
document.addEventListener("change",e=>{
 const t=e.target,a=t.dataset&&t.dataset.b;if(!a)return;
 if(a==="rename"){const d=dev(BU.sel),v=t.value.trim();if(!d||!v)return;if(NET.devs.some(x=>x!==d&&x.name===v)){toast("Nama sudah dipakai");t.value=d.name;return}snap();tlog("Renamed "+d.name+" to "+v);d.name=v;if(d.o.host!==undefined)d.o.host=v;saveNet();bdraw()}
 if(a==="sfil"){if(BU.sm){BU.sm.f[t.dataset.v]=t.checked;drawPanel()}return}
 if(a==="sspeed"){if(BU.sm){BU.sm.speed=+t.value;const s=$("#sspv");if(s)s.textContent=BU.sm.speed+"x"}return}
 if(a==="tplsel"){const k=t.value;if(!k||!TPLS[k])return;snap();buildTemplate(k);BU.sel=null;BU.msel=new Set();BU.link=null;BU.pk=null;BU.sm=null;BU.res=null;BU.errId=null;tlog("Template: "+TPLS[k][0]);saveNet();toast("Template dimuat: "+TPLS[k][0]+" (Undo tersedia)");return renderBuilder()}
 if(a==="impfile"){const f=t.files&&t.files[0];t.value="";if(!f)return;
  if(f.size>PJ.maxBytes){BU.impMsg={ok:false,errors:["File terlalu besar (maksimal 1 MB)."]};return drawPanel()}
  f.text().then(txt=>{const r=importProject(txt);if(!r.ok){BU.impMsg={ok:false,errors:r.errors};return drawPanel()}
   snap();NET.devs=r.devs;NET.links=r.links;NET.name=r.name;NET.tl=[];NET.gen=null;BU.sel=null;BU.msel=new Set();BU.link=null;BU.pk=null;BU.sm=null;BU.errId=null;BU.impMsg={ok:true,msg:"Diimpor: "+r.devs.length+" perangkat, "+r.links.length+" koneksi."};tlog("Imported project "+r.name);saveNet();renderBuilder()}).catch(()=>{BU.impMsg={ok:false,errors:["File tidak bisa dibaca."]};drawPanel()});return}
 if(a==="nsel"){BU.nd=t.value;drawPanel()}if(a==="ddsel"){BU.dd=t.value;drawPanel()}if(a==="dtsel"){BU.dt=t.value;drawPanel()}
});
document.addEventListener("click",e=>{
 const mm=e.target.closest&&e.target.closest("#bmini");if(mm){const p=mm.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(mm.getScreenCTM().inverse());return vbSet({x:q.x-BU.vb.w/2,y:q.y-BU.vb.h/2,w:BU.vb.w})}
 if(e.target.closest&&e.target.closest("[data-pkt]")){BU.pkOpen=!BU.pkOpen;BU.tab="pkt";BU.collapsed=false;return drawPanel()}
 const t=e.target.closest("[data-b]");if(!t||t.tagName==="INPUT"||t.tagName==="SELECT")return;
 const a=t.dataset.b,v=t.dataset.v;
 if(a==="add"){if(BU.noclick)return;return addDev(v)}
 if(a==="device"){const d=dev(v);if(!d)return;BU.sel=d.id;BU.msel=new Set([d.id]);BU.link=null;BU.pend=null;BU.tab="insp";BU.collapsed=false;return bdraw()}
 if(a==="pmode"){smStop();BU.pmode=v;BU.tab=v==="sim"?"simp":(BU.tab==="simp"?"insp":BU.tab);BU.collapsed=false;if(v==="real"){BU.evhl=new Set();BU.evlink=new Set();BU.errId=null;BU.anim++}return renderBuilder()}
 if(a==="splay")return smPlay();
 if(a==="sstepf"){if(!BU.sm)return toast("Buat paket dulu");if(!smStep(1))toast("Akhir simulasi");return}
 if(a==="sstepb"){if(!BU.sm)return;smStep(-1);return}
 if(a==="sreset")return smReset();
 if(a==="sevt"){smStop();return smGo(+v)}
 if(a==="sftab"){if(BU.sm){BU.sm.ft=v;drawPanel()}return}
 if(a==="smcreate"){const d=dev($("#sps").value),ip=$("#spd").value.trim(),m=$("#spp").value,port=+$("#spport").value||0;if(!d)return toast("Pilih sumber dulu");if(!isIp(ip))return toast("Tujuan harus berupa IP yang valid");BU.last.sp={s:d.id,d:ip,p:m,port};return smLoad(pingNet(d,ip,m,port))}
 if(a==="copy")return copySel();if(a==="paste")return pasteClip();if(a==="delsel"){delSel();return}
 if(a==="help"){BU.help=!BU.help;const hp=$("#shelp");if(hp)hp.hidden=!BU.help;return}
 if(a==="exportp"){const j=JSON.stringify(exportProject(),null,1),bl=new Blob([j],{type:"application/json"}),u=URL.createObjectURL(bl),el=document.createElement("a");el.href=u;el.download=(NET.name||"lab").replace(/[^A-Za-z0-9_-]+/g,"_")+".netlab.json";document.body.appendChild(el);el.click();el.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);tlog("Exported project");saveNet();return toast("Proyek diekspor ("+NET.devs.length+" perangkat)")}
 if(a==="importp"){const f=$("#impfile");if(f)f.click();return}
 if(a==="lrename"){const n=($("#lname").value.trim()||NET.name).slice(0,30);NET.name=n;saveNet();const b=$("#bname");if(b)b.textContent=n;return toast("Nama lab: "+n)}
 if(a==="zin")return zoomBy(1.25);if(a==="zout")return zoomBy(1/1.25);if(a==="zfit")return vbSet({x:0,y:0,w:640});if(a==="runsim")return runSim();
 if(a==="mode"){BU.mode=BU.mode===v?"select":v;BU.cA=null;BU.pend=null;BU.msg="";return renderBuilder()}
 if(a==="undo")return bundo();if(a==="redo")return bredo();
 if(a==="save"){BU.tab="labs";BU.collapsed=false;return drawPanel()}
 if(a==="tab"){BU.tab=v;BU.collapsed=false;return drawPanel()}
 if(a==="collapse"){BU.collapsed=!BU.collapsed;t.textContent=BU.collapsed?"▸":"▾";const b=$("#bbody");if(b)b.hidden=BU.collapsed;return}
 if(a==="nsub"){BU.ns=v;return drawPanel()}
 if(a==="docon"){const[x,y]=BU.pend,ai=$("#cai").value,bi=$("#cbi").value,m=$("#conmsg");const pb=linkProblem(dev(x),ai,dev(y),bi);if(pb){m.innerHTML='<div class="fb no" role="status"><b>Koneksi ditolak.</b> '+esc(pb)+'</div>';return}snap();NET.links.push({a:{d:x,i:ai},b:{d:y,i:bi}});tlog("Connected "+dev(x).name+" "+short(ai)+" ↔ "+dev(y).name+" "+short(bi));BU.pend=null;saveNet();return bdraw()}
 if(a==="cancon"){BU.pend=null;return bdraw()}
 if(a==="discon"){const l=NET.links[BU.link];if(!l)return;snap();tlog("Disconnected "+dev(l.a.d).name+" "+short(l.a.i)+" ↔ "+dev(l.b.d).name+" "+short(l.b.i));NET.links.splice(BU.link,1);BU.link=null;saveNet();return bdraw()}
 if(a==="pcapply"){const d=dev(BU.sel);if(!d)return;const f={};["ip","mask","gw","dns"].forEach(k=>f[k]=$("#pc-"+k).value.trim());const m=$("#pcmsg"),E=x=>{m.innerHTML='<div class="fb no" role="status">'+x+'</div>'};
  if(f.ip&&!isIp(f.ip))return E("<b>IP Address belum valid.</b> Contoh: 192.168.1.10 (setiap bagian 0–255).");
  if(f.ip&&!validMask(f.mask))return E("<b>Subnet mask belum valid.</b> Contoh: 255.255.255.0");
  if(f.gw&&!isIp(f.gw))return E("<b>Gateway belum valid.</b> Contoh: 192.168.1.1");
  if(f.dns&&!isIp(f.dns))return E("<b>DNS belum valid.</b> Contoh: 8.8.8.8");
  snap();Object.assign(d.o.ifs.eth0,f);tlog("Configured "+d.name+" IP "+f.ip+"/"+(validMask(f.mask)?maskLen(f.mask):"?")+" gw "+(f.gw||"-"));saveNet();m.innerHTML='<div class="fb ok" role="status">Tersimpan.</div>';return drawSvg()}
 if(a==="pkrun"){const d=dev($("#pks").value),ip=$("#pkd").value.trim(),m=$("#pkp").value,port=+$("#pkport").value||0;
  if(!d)return toast("Pilih sumber dulu");if(!isIp(ip))return toast("Tujuan harus berupa IP yang valid");
  BU.last.pk={s:d.id,d:ip,p:m,port};const r=pingNet(d,ip,m,port);if(BU.pmode==="sim"){smLoad(r);return}BU.pk=r;BU.pkOpen=false;tlog("Ping "+(r.ok?"SUCCESS":"FAILED")+": "+d.name+" → "+ip+(r.ok?"":" ("+r.at+")"));BU.errId=r.ok?null:r.atId;markAct(r);if(r.ok&&!store.get("bldPing",false))store.set("bldPing",true);saveNet();bdraw();return animPkt(r)}
 if(a==="pkdetail"){BU.pkOpen=!BU.pkOpen;return drawPanel()}
 if(a==="tlclear"){NET.tl=[];saveNet();return drawPanel()}
 if(a==="lsave"){const n=($("#lname").value.trim()||NET.name).slice(0,30),L=store.get("labs",[]);NET.name=n;L.unshift({id:"l"+Date.now(),name:n,ts:new Date().toLocaleString(),json:serNet()});store.set("labs",L.slice(0,30));saveNet();const b=$("#bname");if(b)b.textContent=n;toast("Lab tersimpan: "+n);return drawPanel()}
 if(a==="lopen"){const x=store.get("labs",[]).find(l=>l.id===v);if(!x)return;loadNet(JSON.parse(x.json));BU.hist=[];BU.fut=[];BU.sel=null;BU.link=null;BU.pk=null;BU.res=null;saveNet();renderBuilder();return toast("Lab dibuka: "+x.name)}
 if(a==="ldup"){const L=store.get("labs",[]),x=L.find(l=>l.id===v);if(!x)return;L.unshift({...x,id:"l"+Date.now(),name:x.name+" (copy)",ts:new Date().toLocaleString()});store.set("labs",L.slice(0,30));return drawPanel()}
 if(a==="ldel"){if(BU.arm!=="del"+v){BU.arm="del"+v;return drawPanel()}store.set("labs",store.get("labs",[]).filter(l=>l.id!==v));BU.arm="";return drawPanel()}
 if(a==="lreset"){if(BU.arm!=="reset"){BU.arm="reset";return drawPanel()}BU.arm="";snap();NET.devs=[];NET.links=[];NET.nid=1;NET.tl=[];NET.gen=null;NET.name="Lab 1";BU.sel=null;BU.link=null;BU.pk=null;BU.res=null;saveNet();return renderBuilder()}
 if(a==="lgen"){snap();genLab();BU.sel=null;BU.link=null;BU.pk=null;BU.res=null;BU.tab="proj";tlog("Generated "+NET.name);saveNet();return renderBuilder()}
 if(a==="gcheck"){const r=genCheck();BU.res=Object.assign(BU.res||{},{gen:r});const done=store.get("genDone",[]);if(r.ok&&NET.gen&&!done.includes(NET.gen.seed)){store.set("genDone",[...done,NET.gen.seed]);awardXp(100)}return drawPanel()}
 if(a==="pcheck"){const p=projCheck();let xp=0;if(p.score===100&&!store.get("netproj",{}).done){store.set("netproj",{done:true});xp=500;awardXp(500)}BU.res=Object.assign(BU.res||{},{proj:p,xp});tlog("Project check: "+p.score+"/100");saveNet();return drawPanel()}
});

export {loadNet, bflags, bundo, bredo, addDev, delDev, bStatus, devTip, anchorOf, devSvg, drawMini, drawSvg, vbSet, zoomBy, markAct, animPkt, runSim, drawTerm, inspDev, inspLink, inspPend, tabInsp, tabPkt, tabNet, tabDiff, tabProj, delSel, copySel, pasteClip, inspMulti, explainEv, evInspector, tabSim, smHl, smDot, smGo, smStop, smReset, smStep, smPlay, smLoad, tabLabs, drawPanel, bdraw, renderBuilder, BU, serNet, saveNet, snap, tlog, awardXp, freeIfs, linkOf, SCOLB, SNAMEB, simHtml, dHead, palHtml, ifRow, ifTable, bprompt, termLines, chips, NSUB, tabTl, nm, ico, RAIL, railHtml, KBD_HELP, pduForm, SFIL, smVis, BTABS, svgPt, tipShow, tipHide};
