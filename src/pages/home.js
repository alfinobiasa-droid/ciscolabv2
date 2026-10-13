import MODULES from "../data/modules.json";
import {CATS, store, levelOf, S, $, esc, hl} from "../core.js";
import {progOf, isDone} from "./lesson.js";

function moduleCard(m){
 const p=progOf(m.id),q=S.q.trim();
 return `<article class="mod" style="--c:${m.color}">
  <div><div class="n">Modul ${m.id}</div><h3>${hl(m.title,q)}</h3></div>
  <div class="meta"><span class="tag o">${m.level}</span><span class="tag">⏱ ${m.min} menit</span><span class="tag">${m.devices.join(" · ")}</span></div>
  <div class="topics">${m.topics.map(t=>`<span>${hl(t,q)}</span>`).join("")}</div>
  <div><div class="bar${p===100?" done":""}" role="progressbar" aria-label="Progres modul" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></div><small style="color:var(--mute)">Progress ${p}%${p===100?" · selesai":""}</small></div>
  <button class="go${p===100?" done":""}" data-start="${m.id}"${p===100?` aria-label="Modul selesai, buka untuk review"`:""}>${p===100?"✓ Buka untuk mengulang":p>0?"Lanjutkan modul →":"Mulai modul →"}</button></article>`;
}

function filtered(){
 const q=S.q.trim().toLowerCase();
 return MODULES.filter(m=>(S.cat==="Semua"||m.cat===S.cat)&&(!q||[m.title,m.cat,m.level,...m.topics,...m.devices].join(" ").toLowerCase().includes(q)));
}
const SKILL={Networking:[["IP Address",[[5,[0]]]],["Subnetting",[[5,[1,2,3]]]],["Switching",[[2,[0,1]]]],["VLAN",[[2,[2,3,4]]]],["Routing",[[3,[0,1,2,3,4,5]],[4,[0,1,2,3,4,5,6,7]]]],["ACL",[[7,[2]]]],["NAT",[[7,[1]]]]],Linux:[["Linux Basics",[[9,[0]]]],["Filesystem",[[9,[1]]]],["CLI",[[9,[4]]]],["Installation",[[10,[0,1,2]]],"inst"],["Networking",[[9,[2]]]],["Service",[[9,[3]]]],["Troubleshooting",[[11,[0,1,2]]]]]};

function pathCard(){
 const st=n=>{let d=0,t=0;n[1].forEach(([m,ls])=>ls.forEach(i=>{t++;if(isDone(m,i))d++}));if(n[2]==="inst"){t++;if(store.get("inst",{}).done)d++}return d>=t?"done":d>0?"cur":"todo"};
 const track=(name,list)=>{let nx=false;return `<div class="skill"><p class="lbl">${name}</p>${list.map((n,i)=>{const s=st(n),nextHere=!nx&&s!=="done";if(nextHere)nx=true;return `<button class="snode ${s}${nextHere?" next":""}" data-start="${n[1][0][0]}"><span>${s==="done"?"✓":s==="cur"?"●":i+1}</span><b>${n[0]}</b>${nextHere?"<em>berikutnya</em>":""}</button>${i<list.length-1?'<i class="sarr" aria-hidden="true"></i>':""}`}).join("")}</div>`};
 return `<section class="pan" style="margin-bottom:14px"><p class="lbl">Skill Map</p><div class="skills">${track("Networking",SKILL.Networking)}${track("Linux",SKILL.Linux)}</div><p class="muted" style="font-size:.8rem;margin:8px 0 0">Posisimu dalam perjalanan belajar. Kamu boleh membuka materi mana pun.</p></section>`;
}

function renderModules(){
 const lv=levelOf(S.xp);
 $("#view").innerHTML=`
 <section class="hero"><h1>Mulai belajar jaringan</h1>
 <p>Ikuti modul langkah demi langkah untuk memahami Cisco IOS, routing, switching, VLAN, subnetting, dan troubleshooting.</p>
 <p class="muted" style="margin:0 0 12px">Belum tahu mulai dari mana? Pilih modul pertama atau gunakan pencarian untuk menemukan topik tertentu.</p>
 <label class="search"><span aria-hidden="true">🔍</span><input id="q" type="search" placeholder="Cari topik, command, VLAN, OSPF, subnetting..." value="${esc(S.q)}" aria-label="Cari"><button class="clr" id="clr" aria-label="Hapus pencarian" ${S.q?"":"hidden"}>✕</button></label></section>
 <div class="stats"><div class="stat"><b>${S.xp} XP</b><span>Level ${lv.n} · ${lv.name}</span></div><div class="stat"><b>${S.streak}</b><span>Correct streak</span></div><div class="stat"><b>${MODULES.length}</b><span>Modul</span></div></div>
 ${pathCard()}<div class="chips" role="group" aria-label="Kategori">${CATS.map(c=>`<button class="chip" data-cat="${c}" aria-pressed="${c===S.cat}">${c}</button>`).join("")}</div>
 <div id="list"></div>`;
 renderList();
}

function renderList(){
 const r=filtered();
 $("#list").innerHTML=`<div class="count">${r.length} modul ditemukan</div>`+(r.length?`<div class="grid">${r.map(moduleCard).join("")}</div>`:`<div class="empty"><div style="font-size:2.4rem">🔎</div><b>Tidak ada hasil</b><p style="color:var(--mute);margin:6px 0 0">Coba kata kunci lain atau pilih kategori Semua.</p></div>`);
 const c=$("#clr");if(c)c.hidden=!S.q;
}

export {moduleCard, filtered, pathCard, renderModules, renderList, SKILL};
