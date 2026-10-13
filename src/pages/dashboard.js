import MODULES from "../data/modules.json";
import LESSONS from "../data/lessons.json";
import {dayStreak, store, S, $, esc, pad2, dailyState, dailyList, levelInfo} from "../core.js";
import {go} from "../main.js";
import {QS, Q, pct} from "./quiz.js";
import {progOf, isDone} from "./lesson.js";
import {badgeCard} from "./badges.js";
import {liveTopo, topoLegend} from "./netview.js";

const modPct=id=>progOf(id);
const TOPO='<svg class="dh-art" viewBox="0 0 272 90" role="img" aria-label="Topologi: PC, switch, router, PC"><g stroke="#12b8d6" stroke-width="2" stroke-linecap="round" fill="none"><path d="M36 45H92M128 45H174M210 45H236"/></g><g fill="#0b1f3a" stroke="#fff" stroke-width="2"><rect x="10" y="30" width="26" height="30" rx="5"/><rect x="92" y="32" width="36" height="26" rx="5"/><circle cx="192" cy="45" r="18"/><rect x="236" y="30" width="26" height="30" rx="5"/></g><g fill="#34d399"><circle cx="23" cy="72" r="4"/><circle cx="110" cy="72" r="4"/><circle cx="192" cy="72" r="4"/><circle cx="249" cy="72" r="4"/></g></svg>';
const greet=()=>{const h=new Date().getHours();return h<12?"Good morning":h<18?"Good afternoon":"Good evening"};
function dailyCard(){
 const dq=dailyList(),ds=dailyState(),n=dq.filter(q=>ds.done[q.id]).length;
 return `<section class="pan"><div class="lbl-row"><p class="lbl">Daily Quest</p><span class="muted" style="font-size:.82rem">${n} / ${dq.length} Completed</span></div><div class="xpbar" style="margin-bottom:6px"><i data-w="${Math.round(n/dq.length*100)}" style="width:0"></i></div>${dq.map(q=>{const c=Math.min(ds.cnt[q.ev]||0,q.n),ok=!!ds.done[q.id];return `<div class="dq${ok?" ok":""}"><i aria-hidden="true">${ok?"✓":""}</i><span>${q.t}${q.n>1?" ("+c+"/"+q.n+")":""}</span><b>+${q.xp} XP</b></div>`}).join("")}</section>`;
}
function learnedBlock(cur){const ls=LESSONS[cur.id],dn=ls.filter((_,i)=>isDone(cur.id,i)),nx=ls.find((_,i)=>!isDone(cur.id,i));return `<p class="lbl">Kamu sudah memahami</p><ul class="learned" style="margin:4px 0 8px">${dn.slice(-3).map(x=>`<li>✓ ${esc(x[0])}</li>`).join("")||`<li class="muted" style="color:var(--mute)">Belum ada. Mulai dari langkah pertama.</li>`}</ul>${nx?`<p style="margin:0 0 10px"><span class="muted">Berikutnya:</span> <b>→ ${esc(nx[0])}</b></p>`:""}`}
function contCard(cur){
 if(!cur)return `<section class="pan allok"><p class="lbl">All Modules Completed</p><h2 class="h2">Semua Modul Selesai 🎉</h2><p class="muted" style="margin:0">Kamu sudah menyelesaikan seluruh modul NETLAB.</p><div class="seg" style="margin-top:14px"><button class="act alt" style="width:auto;flex:1" data-go="modul">Review Modul</button><button class="act" style="width:auto;flex:1" data-dash="exam">Exam Mode →</button></div></section>`;
 const p=modPct(cur.id);
 return `<section class="pan"><p class="lbl">Continue Learning</p><h2 class="h2">${cur.title}</h2><p class="muted" style="margin:0 0 10px">${cur.cat} · ${cur.level} · ${cur.min} min</p>${learnedBlock(cur)}<div class="bar" role="progressbar" aria-label="Progres modul" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"><i style="width:${p}%"></i></div><div class="prog-foot"><span>Progress</span><span>${p}%</span></div><button class="go" data-start="${cur.id}">${p>0?"Lanjutkan Modul →":"Mulai Modul →"}</button></section>`;
}
document.addEventListener("click",e=>{if(e.target.closest("[data-dash=exam]")){Q.exam=true;Q.run=null;go("kuis")}});
const SKILLS=[
 {k:"IP Address",q:["Dasar Cisco"],m:[[5,[0]]],weak:["Format IPv4","Bagian network dan host"],qz:"Dasar Cisco",mod:5},
 {k:"Subnetting",q:["Subnetting"],m:[[5,[1,2,3]]],weak:["Network Address","Broadcast Address","Host Range"],qz:"Subnetting",mod:5},
 {k:"VLAN",q:["VLAN"],m:[[2,[0,1,2,3,4]]],weak:["Access vs Trunk","Native VLAN","Verifikasi VLAN"],qz:"VLAN",mod:2},
 {k:"Routing",q:["Routing","OSPF"],m:[[3,null],[4,null]],weak:["Routing table","Static route","OSPF, RIP, EIGRP"],qz:"Routing",mod:3},
 {k:"NAT",q:["Layanan"],m:[[7,[1]]],weak:["Inside dan Outside","PAT overload"],qz:"Layanan",mod:7},
 {k:"ACL",q:["Layanan"],m:[[7,[2]]],weak:["Urutan aturan","Implicit deny","Arah ACL"],qz:"Layanan",mod:7},
 {k:"Linux",q:["Linux"],m:[[9,null],[10,null]],weak:["Filesystem","Permission","Instalasi"],qz:"Linux",mod:9},
 {k:"Troubleshooting",q:["Troubleshooting"],m:[[6,null],[11,null]],weak:["Diagnosis berurutan","Membaca show command"],qz:"Troubleshooting",mod:6}];
function skillStat(s){
 let d=0,t=0;s.m.forEach(([mid,ls])=>(ls||LESSONS[mid].map((_,i)=>i)).forEach(i=>{t++;if(isDone(mid,i))d++}));
 let ok=0,tot=0;s.q.forEach(c=>{const v=(QS.cat||{})[c];if(v){ok+=v[0];tot+=v[1]}});
 const lp=t?d/t:0,qa=tot>=3?ok/tot:null;
 return{pct:Math.round(qa===null?lp*70:lp*50+qa*50),lp:Math.round(lp*100),qa:qa===null?null:Math.round(qa*100),tot};
}
function skillCard(){
 return `<p class="lbl sp">Skill Mastery</p><section class="pan"><div class="skillbars">${SKILLS.map(s=>{const x=skillStat(s);return `<div class="sk"><div class="sk-h"><b>${s.k}</b><span>${x.pct}%</span></div><div class="bar" role="progressbar" aria-label="Skill ${s.k}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${x.pct}"><i style="width:${x.pct}%"></i></div><small class="muted">materi ${x.lp}% · quiz ${x.qa===null?"belum cukup data":x.qa+"%"}</small></div>`}).join("")}</div><p class="muted" style="font-size:.8rem;margin:10px 0 0">Dihitung dari progres materi (50%) dan akurasi kuis (50%). Tanpa data kuis, skor maksimal 70%.</p></section>`;
}
function adaptiveCard(){
 const all=SKILLS.map(s=>({s,x:skillStat(s)})).sort((a,b)=>a.x.pct-b.x.pct),weak=all.filter(r=>r.x.pct<70).slice(0,2);
 if(!weak.length)return `<section class="pan" style="margin-top:14px"><p class="lbl">Rekomendasi belajar</p><p class="muted" style="margin:0">Semua skill di atas 70%. Coba Exam mode, Topology Builder, atau Network Project.</p></section>`;
 return `<section class="pan" style="margin-top:14px"><p class="lbl">⚠️ Rekomendasi belajar</p>${weak.map(({s,x})=>`<div class="rec"><p style="margin:0 0 4px">${x.qa!==null&&x.qa<65?`Kamu masih sering salah di <b>${s.k}</b> (akurasi kuis ${x.qa}%).`:`Materi <b>${s.k}</b> baru ${x.lp}% selesai.`} Fokus pada:</p><ul class="parts">${s.weak.map(w=>`<li>${w}</li>`).join("")}</ul><div class="seg"><button class="chip s" data-sr="qz" data-v="${s.qz}">Latihan ${s.k}</button><button class="chip s" data-start="${s.mod}">Pelajari materi</button></div></div>`).join("")}</section>`;
}
function renderDashboard(){
 const lv=levelInfo(S.xp),last=store.get("lastModule",null),done=MODULES.filter(m=>modPct(m.id)===100).length,acc=pct(QS.ok,QS.ans);
 const inprog=MODULES.filter(m=>modPct(m.id)>0&&modPct(m.id)<100),cur=inprog.find(m=>m.id===last)||inprog[0]||MODULES.find(m=>modPct(m.id)===0)||null;
 const weak=Object.entries(QS.cat||{}).filter(([,v])=>v[1]>=3).map(([c,v])=>[c,Math.round(v[0]/v[1]*100)]).sort((a,b)=>a[1]-b[1])[0];
 const recs=MODULES.filter(m=>modPct(m.id)<100&&m.id!==(cur&&cur.id)).slice(0,2);
 const row=(t,s,b,a)=>`<div class="cc"><div style="min-width:0"><b>${t}</b><div class="cd">${s}</div></div><button class="cpy" ${a}>${b}</button></div>`;
 const st=[["Modules Completed",done+" / "+MODULES.length],["Quiz Completed",store.get("quizHistory",[]).length],["Total XP",S.xp],["Accuracy",QS.ans?acc+"%":"–"]];
 $("#view").innerHTML=`<div class="dash-head"><h1 class="pg dh-t">${greet()}, ${lv.name} 👋</h1><p class="muted" style="margin:4px 0 0">Pilih materi untuk belajar, atau buka Sandbox untuk langsung mencoba command.</p></div>
 <div class="dash-grid">
 <section class="pan"><p class="lbl">User Progress</p><div class="prog-row"><div><div class="lvbig">LEVEL ${pad2(lv.n)}</div><b style="font-size:1.15rem">${lv.name}</b></div><div class="streak">🔥 ${dayStreak()} Day Streak</div></div>
  <div class="xpbar" role="progressbar" aria-label="XP progress to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${lv.pct}"><i data-w="${lv.pct}" style="width:0"></i></div>
  <div class="prog-foot"><span>${S.xp}${lv.next?" / "+lv.next:""} XP</span><span>${lv.next?(lv.next-S.xp)+" XP to Level "+pad2(lv.n+1):"Max level"}</span></div></section>
 ${contCard(cur)}</div>
 <p class="lbl sp">Statistics</p><div class="stats4">${st.map(x=>`<div class="stat"><b>${x[1]}</b><span>${x[0]}</span></div>`).join("")}</div>
 <p class="lbl sp">Network Activity</p><section class="pan"><div id="dtopo">${liveTopo()}</div>${topoLegend()}</section>
 <div class="dash-grid">${dailyCard()}<section class="pan"><p class="lbl">Recommended</p>${weak&&weak[1]<75?row("Review: "+esc(weak[0]),"Quiz accuracy "+weak[1]+"%","Practice",`data-sr="qz" data-v="${esc(weak[0])}"`):""}${recs.map(m=>row(esc(m.title),m.level+" · "+m.min+" min","Open",`data-start="${m.id}"`)).join("")||(weak?"":'<p class="muted">All modules completed. Try Exam mode in Quiz.</p>')}</section></div>
 ${skillCard()}${adaptiveCard()}${badgeCard()}`;
 requestAnimationFrame(()=>document.querySelectorAll(".xpbar i[data-w]").forEach(b=>{b.style.width=b.dataset.w+"%"}));
}

export {dailyCard, learnedBlock, contCard, skillStat, skillCard, adaptiveCard, renderDashboard, modPct, TOPO, greet, SKILLS};
