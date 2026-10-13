import MODULES from "../data/modules.json";
import QUESTIONS from "../data/questions.json";
import CMDS from "../data/commands.json";
import GLOSS from "../data/glossary.json";
import LESSONS from "../data/lessons.json";
import {$, esc, hl} from "../core.js";
import {go} from "../main.js";
import {Q} from "./quiz.js";
import {TS, T} from "./trouble.js";
import {setLesson, openModule, renderModule, unlocked} from "./lesson.js";
import {KG, emptyBox, searchBox} from "./reference.js";
import {labOpen, LABS, LAB} from "./lab.js";

const SR={q:"",all:{}};
function searchResults(q){
 const t=q.toLowerCase();if(!t)return null;
 const m=x=>x.toLowerCase().includes(t);
 return{
  mod:MODULES.filter(x=>m([x.title,x.cat,...x.topics].join(" "))),
  les:MODULES.flatMap(md=>LESSONS[md.id].map((l,i)=>({md,i,l}))).filter(o=>m(o.l.slice(0,4).join(" "))),
  cmd:CMDS.filter(c=>m(c.join(" "))),
  gl:GLOSS.filter(g=>m(g.join(" "))),
  qs:QUESTIONS.filter(x=>m([x.question,x.code,x.category,...x.options].join(" "))),
  tr:[...TS.map(x=>({id:x.id,title:x.title,exp:x.exp})),...LABS.map(x=>({id:x.id,title:x.title,exp:x.exp,lab:1,lvl:x.lvl}))].filter(x=>m(x.title+" "+x.exp))
 };
}
function searchDraw(){
 const q=SR.q.trim(),r=searchResults(q),out=$("#gres");
 if(!r){out.innerHTML=`<div class="count">Coba cari:</div><div class="seg">${["ip route","vlan","ospf","subnet","ping","trunk"].map(x=>`<button class="chip" data-sr="try" data-v="${x}">${x}</button>`).join("")}</div>`;return}
 const total=Object.values(r).reduce((a,x)=>a+x.length,0);
 if(!total){out.innerHTML=emptyBox;return}
 const card=(main,sub,btn,attrs)=>`<div class="cc"><div style="min-width:0">${main}<div class="cd">${sub}</div></div><button class="cpy" ${attrs}>${btn}</button></div>`;
 const grp=(title,items,fn)=>{
  if(!items.length)return"";
  const all=SR.all[title],shown=all?items:items.slice(0,4);
  return `<section style="margin-top:16px"><h3 style="margin:0 0 8px">${title} <small style="color:var(--mute)">(${items.length})</small></h3><div class="cgrid">${shown.map(fn).join("")}</div>${!all&&items.length>4?`<button class="chip" style="margin-top:8px" data-sr="all" data-v="${title}">Tampilkan semua ${items.length}</button>`:""}</section>`;
 };
 out.innerHTML=`<div class="count">${total} hasil untuk "${esc(q)}"</div>`
 +grp("Modul",r.mod,x=>card(`<b>${hl(x.title,q)}</b>`,`${x.cat} · ${x.level}`,"Buka",`data-sr="mod" data-v="${x.id}"`))
 +grp("Materi",r.les,o=>card(`<b>${hl(o.l[0],q)}</b>`,`Modul ${o.md.id}: ${esc(o.md.title)}`,"Buka",`data-sr="les" data-v="${o.md.id}:${o.i}"`))
 +grp("Command",r.cmd,c=>card(`<code class="cm">${hl(c[1],q)}</code>`,hl(c[2],q),"Salin",`data-cp="${esc(c[1])}"`))
 +grp("Istilah",r.gl,g=>card(`<b>${hl(g[0],q)}</b>`,hl(g[1],q),"Lihat",`data-sr="gl" data-v="${esc(g[0])}"`))
 +grp("Troubleshooting",r.tr,x=>card(`<b>${hl(x.title,q)}</b>`,x.lab?"Lab interaktif · "+x.lvl:"Kasus pilihan ganda","Buka",`data-sr="tr" data-v="${x.lab?"lab:"+x.id:"case:"+x.id}"`))
 +grp("Soal",r.qs,x=>card(`<b>${hl(x.question+(x.code?" "+x.code.replace(/\n/g," "):""),q)}</b>`,`${x.category} · Jawaban: ${esc(x.options[x.answer])}`,"Kuis",`data-sr="qz" data-v="${x.category}"`));
}
function renderSearch(){
 $("#view").innerHTML=`<h1 class="pg" style="margin:4px 0 6px">Cari</h1><p style="color:var(--mute);margin:0 0 12px">Cari modul, materi, command, istilah, dan soal sekaligus.</p>
 ${searchBox("gq","Cari: ip route, VLAN, OSPF, subnetting...",SR.q)}<div id="gres"></div>`;
 searchDraw();
}
document.addEventListener("input",e=>{if(e.target.id==="gq"){SR.q=e.target.value;SR.all={};searchDraw()}});
document.addEventListener("click",e=>{
 const t=e.target.closest("[data-sr]");if(!t)return;
 const a=t.dataset.sr,v=t.dataset.v;
 if(a==="try"){SR.q=v;SR.all={};return renderSearch()}
 if(a==="all"){SR.all[v]=true;return searchDraw()}
 if(a==="mod")return openModule(+v);
 if(a==="les"){const[id,i]=v.split(":").map(Number);openModule(id);if(unlocked(id,i))setLesson(i);return renderModule()}
 if(a==="gl"){KG.q=v;return go("kamus")}
 if(a==="qz"){Q.cat=v;Q.run=null;return go("kuis")}
 if(a==="tr"){const[k,id]=v.split(":");if(k==="lab"){LAB.on=true;labOpen(id)}else{LAB.on=false;T.cur=+id;T.sel=null;T.gain=false}return go("trouble")}
});

export {searchResults, searchDraw, renderSearch, SR};
