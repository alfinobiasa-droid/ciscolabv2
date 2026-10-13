import CMDS from "../data/commands.json";
import GLOSS from "../data/glossary.json";
import {$, esc, copyText, toast} from "../core.js";

/* Format: [kategori, command, keterangan] */

/* Format: [istilah, definisi, contoh, command terkait] */

const CH={cat:"Semua",q:""},KG={q:"",cat:"Semua"};
const TCAT={VLAN:"Switching",Trunk:"Switching","Access Port":"Switching",Switch:"Switching","MAC Address":"Switching",ARP:"Switching",Router:"Routing",Gateway:"Routing","Default Route":"Routing",OSPF:"Routing",RIP:"Routing",EIGRP:"Routing",Routing:"Routing","Subnet Mask":"Addressing",CIDR:"Addressing","IP Address":"Addressing",VLSM:"Addressing",DNS:"Services",DHCP:"Services",NAT:"Services","Proxy Server":"Services",ACL:"Security","DoS / DDoS":"Security","IP Spoofing":"Security","Packet Sniffing":"Security"};
const has=(q,...f)=>!q||f.join(" ").toLowerCase().includes(q.toLowerCase());
const emptyBox=`<div class="empty"><div style="font-size:2.4rem">🔎</div><b>Tidak ada hasil</b><p style="color:var(--mute);margin:6px 0 0">Coba kata kunci lain.</p></div>`;
const searchBox=(id,ph,val)=>`<input class="inp" id="${id}" type="search" placeholder="${ph}" value="${esc(val)}" autocomplete="off" aria-label="Cari" style="margin:0 0 12px">`;

function cheatDraw(){
 const r=CMDS.filter(c=>(CH.cat==="Semua"||c[0]===CH.cat)&&has(CH.q.trim(),c[0],c[1],c[2]));
 $("#chlist").innerHTML=`<div class="count">${r.length} command</div>`+(r.length?`<div class="cgrid">${r.map(c=>`<div class="cmd"><div class="cmd-top"><code>${esc(c[1])}</code><button class="cpy" data-cp="${esc(c[1])}" aria-label="Copy ${esc(c[1])}">COPY</button><button class="cpy" data-insert="${esc(c[1])}" aria-label="Insert ${esc(c[1])}">INSERT</button></div><p class="cd">${esc(c[2])}</p><pre class="ex">${c[0]==="Linux"?"root@debian:~#":/^(show|ping|traceroute|copy|simulate)/.test(c[1])?"R1#":"R1(config)#"} ${esc(c[1])}</pre></div>`).join("")}</div>`:emptyBox);
}
function renderCheat(){
 $("#view").innerHTML=`<h1 class="pg" style="margin:4px 0 6px">Cheat Sheet</h1><p style="color:var(--mute);margin:0 0 12px">Command Cisco IOS yang sering dipakai. Ketuk Salin untuk menyalin.</p>
 ${searchBox("ch-q","Cari command atau fungsi...",CH.q)}
 <div class="chips">${["Semua","Basic IOS","Switch","VLAN","Routing","OSPF","Layanan","Linux","Troubleshooting"].map(c=>`<button class="chip" data-ch="${c}" aria-pressed="${c===CH.cat}">${c}</button>`).join("")}</div><div id="chlist"></div>`;
 cheatDraw();
}
function kamusDraw(){
 const r=GLOSS.filter(g=>has(KG.q.trim(),g[0],g[1],g[2],g[3])&&(KG.cat==="Semua"||(TCAT[g[0]]||"Basics")===KG.cat));
 $("#kglist").innerHTML=`<div class="count">${r.length} istilah</div>`+(r.length?`<div class="grid">${r.map(g=>`<article class="mod" style="--c:var(--cyan)"><h3>${esc(g[0])}</h3><p style="margin:0">${esc(g[1])}</p><small style="color:var(--mute)">Contoh: ${esc(g[2])}</small>${g[3]?`<button class="cpy" data-cp="${esc(g[3])}" style="text-align:left;font:600 .82rem ui-monospace,Menlo,Consolas,monospace;padding:8px 12px;height:auto;word-break:break-word" aria-label="Salin ${esc(g[3])}">${esc(g[3])}</button>`:""}</article>`).join("")}</div>`:emptyBox);
}
function renderKamus(){
 $("#view").innerHTML=`<h1 class="pg" style="margin:4px 0 6px">Dictionary</h1><p style="color:var(--mute);margin:0 0 12px">Istilah jaringan beserta contoh dan command terkait.</p>
 ${searchBox("kg-q","Search terms: VLAN, OSPF, NAT...",KG.q)}<div class="chips">${["Semua","Basics","Switching","Routing","Addressing","Services","Security"].map(c=>`<button class="chip" data-kc="${c}" aria-pressed="${c===KG.cat}">${c==="Semua"?"All":c}</button>`).join("")}</div><div id="kglist"></div>`;
 kamusDraw();
}
document.addEventListener("input",e=>{
 if(e.target.id==="ch-q"){CH.q=e.target.value;cheatDraw()}
 else if(e.target.id==="kg-q"){KG.q=e.target.value;kamusDraw()}
});
document.addEventListener("click",e=>{
 const ins=e.target.closest("[data-insert]");if(ins){window.dispatchEvent(new CustomEvent("netlab:insert-command",{detail:{command:ins.dataset.insert}}));toast("Command dikirim ke terminal aktif");return}
 const cp=e.target.closest("[data-cp]");
 if(cp){const v=cp.dataset.cp;copyText(v).then(ok=>toast(ok?"Tersalin: "+v:"Tidak bisa menyalin otomatis. Salin manual: "+v));return}
 const t=e.target.closest("[data-ch]");if(!t)return;
 CH.cat=t.dataset.ch;renderCheat();
});
document.addEventListener("click",e=>{const t=e.target.closest("[data-kc]");if(!t)return;KG.cat=t.dataset.kc;renderKamus()});

export {cheatDraw, renderCheat, kamusDraw, renderKamus, CH, KG, TCAT, has, emptyBox, searchBox};
