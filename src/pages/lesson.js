import MODULES from "../data/modules.json";
import LESSONS from "../data/lessons.json";
import {xpPop, dailyEvent, store, S, $, esc, hl, pad2} from "../core.js";
import {render, go} from "../main.js";
import {Q, L, pct, shuffle} from "./quiz.js";
import {useDevice} from "../sim/engine.js";
import {HINT} from "./sandbox.js";
import {devAt} from "../components/device-icons.js";
import {ico} from "./builder.js";

/* Format materi: [judul, penjelasan, contoh/output, tips, pertanyaan, pilihan, indeks jawaban] */

const MD={id:null,i:0,sel:null,order:[],bad:[],msg:"",cel:false,gain:false};
const LS=store.get("lessons",{}),MDONE=store.get("modDone",{});
const doneSet=id=>LS[id]||[];
const progOf=id=>{const n=LESSONS[id].length;return Math.round(doneSet(id).filter(i=>i<n).length/n*100)};
{if(store.get("lessonsV",1)<2){const mp={0:[0,1,2],1:[3,4,5],2:[7,8,9],3:[6,10],4:[11]};if(LS[1])LS[1]=[...new Set(LS[1].flatMap(i=>mp[i]||[]))];store.set("lessons",LS);store.set("lessonsV",2)}}
const isDone=(id,i)=>doneSet(id).includes(i);
const unlocked=(id,i)=>i===0||isDone(id,i-1);
function setLesson(i){MD.i=i;MD.sel=null;MD.bad=[];MD.msg="";MD.cel=false;MD.hl=0;MD.conf=false;MD.order=shuffle(LESSONS[MD.id][i][5].map((_,k)=>k))}
function openModule(id){MD.id=id;store.set("lastModule",id);{const f=LESSONS[id].findIndex((_,i)=>!isDone(id,i));setLesson(f<0?0:f)}S.page="modul";render()}
function completeLesson(){
 const id=MD.id,n=LESSONS[id].length;
 (LS[id]=LS[id]||[]).push(MD.i);
 S.xp+=10;S.streak++;dailyEvent("lesson");xpPop(10);MD.msg="✓ Jawaban benar! +10 XP";
 const pct=Math.round(LS[id].length/n*100);S.progress[id]=pct;
 if(pct===100){MD.cel=true;MD.gain=!MDONE[id];if(MD.gain){MDONE[id]=true;S.xp+=100;MD.msg+=" · Modul selesai! +100 XP";store.set("modDone",MDONE);xpPop(100)}}
 store.set("lessons",LS);store.set("progress",S.progress);store.set("xp",S.xp);store.set("streak",S.streak);
}
function topoSvg(nodes){
 const n=nodes.length,W=n*110,cy=36;
 const ico=(t,x)=>devAt({rt:"router",sw:"switch",srv:"server",cloud:"cloud",pc:"pc"}[t]||"pc",x,cy+6,.72);
 let s="";
 nodes.forEach((nd,i)=>{
  const x=55+i*110,st=nd[2]==="ok"||nd[2]==="bad"?nd[2]:null,sub=st?nd[3]:nd[2];
  if(i)s+=`<path d="M${x-84} ${cy}H${x-26}" stroke="var(--cyan)" stroke-width="2"/>`;
  s+=`<g fill="var(--card)" stroke="currentColor" stroke-width="2">${ico(nd[1],x)}</g><text x="${x}" y="78" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">${esc(nd[0])}</text>`;
  if(sub)s+=`<text x="${x}" y="91" text-anchor="middle" font-size="9.5" fill="var(--mute)">${esc(sub)}</text>`;
  if(st)s+=`<circle cx="${x+22}" cy="${cy-18}" r="5" fill="${st==="ok"?"#22C55E":"#EF4444"}" stroke="var(--card)" stroke-width="1.5"/>`;
 });
 return `<div class="topo-wrap"><svg viewBox="0 0 ${W} 100" style="min-width:${Math.min(W,330)}px;width:100%;max-width:${W}px;display:block;margin:0 auto" role="img" aria-label="Topologi: ${esc(nodes.map(x=>x[0]).join(", "))}">${s}</svg></div>`;
}
const TRY={1:"router",2:"switch",3:"router",4:"router",5:"subnet",6:"trouble",7:"router",8:"router",9:"linux",10:"linux",11:"router"};
document.addEventListener("click",e=>{
 const t=e.target.closest("[data-try]");if(!t)return;
 const d=TRY[t.dataset.try];
 if(d==="subnet"||d==="trouble")return go(d);
 {const lsn=LESSONS[+t.dataset.try][+t.dataset.li||0],x=lsn&&lsn[7];HINT.title=lsn?lsn[0]:"";HINT.mod=+t.dataset.try;HINT.li=+t.dataset.li||0;HINT.why=x&&x.qwhy||"";HINT.cmds=x&&x.practice?x.practice:lsn?lsn[2].split("\n").map(s=>s.replace(/^\S+[#>]\s*/,"").trim()).filter(Boolean).slice(0,6):null}
 useDevice(d);go("sandbox");
});
const cmdTable=r=>`<p class="lbl sp">Penjelasan per command</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Command</th><th>Fungsinya</th></tr></thead><tbody>${r.map(c=>`<tr><td><code>${esc(c[0])}</code></td><td>${esc(c[1])}</td></tr>`).join("")}</tbody></table></div>`;
function lessonBody(m,l,tl){
 const x=l[7],sec=(h,b)=>b?`<p class="lbl sp">${h}</p><div class="sec"><p>${b}</p></div>`:"";
 const topo=m.topo?`<p class="lbl sp">Topologi</p><div class="pan flat">${topoSvg(m.topo)}</div>`:"";
 const cmd=`<p class="lbl sp">Command</p><pre class="code">${esc(l[2])}</pre><div class="seg"><button class="chip" data-cp="${esc(l[2])}">Copy</button><button class="chip" data-try="${m.id}" data-li="${MD.i}">Try in ${tl} →</button></div>`;
 if(!x)return `<p class="lbl sp">Penjelasan</p><p style="margin:0;max-width:72ch">${esc(l[1])}</p>${topo}${cmd}<div class="tipbox"><b>Tips:</b> ${esc(l[3])}</div>`;
 const tbl=x.table?`<p class="lbl sp">Perbandingan mode</p><div class="tbl-wrap"><table class="tbl"><thead><tr>${x.table[0].map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${x.table.slice(1).map(r=>`<tr>${r.map((c,i)=>`<td>${i===0?`<code>${esc(c)}</code>`:esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`:"";
 return sec("Apa itu?",esc(x.what))+sec("Kenapa digunakan?",esc(x.why))+sec("Contoh situasi",esc(x.ex))+tbl+topo+cmd+(x.cmds?cmdTable(x.cmds):"")
  +(x.res?`<p class="lbl sp">Hasil yang diharapkan</p><pre class="code res">${esc(x.res)}</pre>`:"")
  +sec("Kesalahan umum",esc(x.err))+`<div class="tipbox"><b>Tips:</b> ${esc(l[3])}</div>`
  +(x.practice?`<p class="lbl sp">Praktik di Sandbox</p><ol class="prac">${x.practice.map(c=>`<li><code>${esc(c)}</code></li>`).join("")}</ol>`:"");
}
function lessonFeedback(l,solved){
 const x=l[7]||{},why=x.qwhy||l[3];
 if(MD.msg)return `<div role="status" class="fb ok"><b>${MD.msg}</b><p><b>Kenapa benar:</b> ${esc(why)}</p></div>`;
 if(MD.bad.length&&!solved){
  const wrong=l[5][MD.order[MD.bad[MD.bad.length-1]]],learn=(x.what||l[1]).split(". ")[0].replace(/\.$/,"");
  return `<div role="status" class="fb no"><b>✗ Belum tepat.</b><p><b>Jawaban yang benar:</b> ${esc(l[5][l[6]])}</p><p><b>Kenapa:</b> ${esc(why)}</p><p><b>Pilihanmu "${esc(wrong)}"</b> belum sesuai dengan konsep di langkah ini.</p><p><b>Pelajari lagi:</b> ${esc(learn)}.</p>${MD.hl?`<div class="tipbox" role="status"><b>💡 Hint ${MD.hl}/3</b><ol class="prac">${["Arah: baca lagi bagian Apa itu. Fokus pada: "+learn,"Konsep: "+((x.why||l[3]).split(". ")[0]),"Hampir jawaban: "+(x.qwhy||l[3])].slice(0,MD.hl).map(t=>`<li>${esc(t)}</li>`).join("")}</ol></div>`:""}${MD.conf?`<div class="tipbox" role="status"><b>🤔 Bayangkan:</b> ${esc(x.ex||x.what||l[1])}</div>`:""}<div class="seg" style="margin-top:8px"><button class="chip s" data-md="hint">💡 Beri Hint${MD.hl?" ("+MD.hl+"/3)":""}</button><button class="chip s" data-md="conf">🤔 Saya masih bingung</button></div></div>`;
 }
 return "";
}
function renderCelebrate(m,ls){
 const nxt=MODULES.find(x=>x.id>m.id);
 $("#view").innerHTML=`<div class="pan celeb"><div class="cel-ico" aria-hidden="true">🎉</div><h1 class="pg">Modul Selesai!</h1><p class="muted" style="margin:6px 0">Kamu sudah menyelesaikan:</p><h2 class="h2">${esc(m.title)}</h2><p class="lbl sp">Yang sudah dipelajari</p><ul class="learned">${ls.map(x=>`<li>✓ ${esc(x[0])}</li>`).join("")}</ul>${MD.gain?`<p class="reward">Reward: +100 XP</p>`:""}<div class="seg" style="justify-content:center;margin-top:12px"><button class="act alt" style="width:auto;flex:1;max-width:220px" data-md="review">Review Modul</button>${nxt?`<button class="act" style="width:auto;flex:1;max-width:240px" data-md="nextmod" data-v="${nxt.id}">Ke Modul Berikutnya →</button>`:`<button class="act" style="width:auto;flex:1;max-width:240px" data-md="exam">Exam Mode →</button>`}</div></div>`;
 const c=$("#crumb");if(c)c.innerHTML="Modules / <b>"+esc(m.title)+"</b>";
}
function renderModule(){
 {const cm=MODULES.find(x=>x.id===MD.id);if(MD.cel&&cm)return renderCelebrate(cm,LESSONS[cm.id])}
 const m=MODULES.find(x=>x.id===MD.id),ls=LESSONS[m.id],l=ls[MD.i],done=isDone(m.id,MD.i),solved=done||MD.sel!=null;
 const pct=Math.round(doneSet(m.id).length/ls.length*100),last=MD.i===ls.length-1;
 const steps=ls.map((x,i)=>{const d=isDone(m.id,i),u=unlocked(m.id,i);return `<button class="step${i===MD.i?" cur":""}${d?" done":""}" data-md="go" data-v="${i}" ${u?"":"disabled"}><span class="sn">${d?"✓":u?pad2(i+1):"🔒"}</span><span>${esc(x[0])}</span></button>`}).join("");
 const tl=TRY[m.id]==="subnet"?"Calculator":TRY[m.id]==="trouble"?"Troubleshooting":"Sandbox";
 $("#view").innerHTML=`<div class="ws"><aside class="ws-side"><button class="chip" data-md="back">← All modules</button>
 <h1 class="pg" style="margin:12px 0 4px;line-height:1.25">${m.title}</h1><p class="muted" style="margin:0 0 10px">${m.cat} · ${m.level} · ${m.min} min</p>
 <div class="bar${pct===100?" done":""}" role="progressbar" aria-label="Progres modul" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div><div class="prog-foot"><span>Progress</span><span>${pct}%</span></div>${pct===100?`<p class="okline">✓ Modul Selesai · mode review</p>`:""}
 <p class="lbl sp">Learning goals</p><ul class="goals">${(m.goals||[]).map(g=>`<li>${esc(g)}</li>`).join("")}</ul>
 <p class="lbl sp">Steps</p><div class="steplist">${steps}</div></aside>
 <section class="ws-main pan"><p class="lbl">Step ${pad2(MD.i+1)} of ${pad2(ls.length)}</p><h2 class="h2">${esc(l[0])}</h2>
 ${lessonBody(m,l,tl)}
 <p class="lbl sp">Mini quiz</p><p style="margin:0">${esc(l[4])}</p>
 ${MD.order.map((oi,d)=>{const c=solved?(oi===l[6]?" ok":""):(MD.bad.includes(d)?" no":"");return `<button class="opt${c}" data-md="pick" data-v="${d}" ${solved||MD.bad.includes(d)?"disabled":""}><b>${L[d]}</b><span>${esc(l[5][oi])}</span></button>`}).join("")}
 ${lessonFeedback(l,solved)}
 <p class="muted" style="font-size:.85rem">${done?"✓ Step completed":"Answer the mini quiz correctly to complete this step."}</p>
 <div style="display:flex;gap:10px"><button class="act alt" style="flex:1;width:auto" data-md="prev" ${MD.i?"":"disabled"}>← Previous</button><button class="act" style="flex:1;width:auto" data-md="next" ${solved&&!last?"":"disabled"}>Next →</button></div></section></div>`;
 const c=$("#crumb");if(c)c.innerHTML="Modules / <b>"+esc(m.title)+"</b>";
}
document.addEventListener("click",e=>{
 const t=e.target.closest("[data-md]");if(!t||MD.id==null)return;
 const a=t.dataset.md,v=+t.dataset.v,l=LESSONS[MD.id][MD.i];
 if(a==="hint"){MD.hl=Math.min((MD.hl||0)+1,3);return renderModule()}
 if(a==="conf"){MD.conf=!MD.conf;return renderModule()}
 if(a==="nextmod")return openModule(v);
 if(a==="exam"){Q.exam=true;Q.run=null;MD.id=null;return go("kuis")}
 if(a==="review"){MD.cel=false;return renderModule()}
 if(a==="back")MD.id=null;
 else if(a==="go"&&unlocked(MD.id,v))setLesson(v);
 else if(a==="prev")setLesson(MD.i-1);
 else if(a==="next")setLesson(MD.i+1);
 else if(a==="pick"&&!isDone(MD.id,MD.i)){
  if(MD.order[v]===l[6]){MD.sel=v;completeLesson()}else{MD.bad.push(v);S.streak=0;store.set("streak",0)}
 }
 MD.id==null?render():renderModule();
 if(a!=="pick")window.scrollTo(0,0);
});

export {setLesson, openModule, completeLesson, topoSvg, lessonBody, lessonFeedback, renderCelebrate, renderModule, MD, LS, MDONE, doneSet, progOf, isDone, unlocked, TRY, cmdTable};
