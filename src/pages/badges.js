import {store, $, esc} from "../core.js";
import {QS} from "./quiz.js";
import {QK} from "./quest.js";
import {progOf, unlocked} from "./lesson.js";
import {LABDONE} from "./lab.js";

const BADGES=[
{id:"cfg",i:"🏅",n:"First Configuration",d:"Atur IP address di Sandbox.",ok:()=>(store.get("ach",{}).ip||0)>=1},
{id:"vlan",i:"🏅",n:"VLAN Master",d:"Selesaikan Quest Buat VLAN.",ok:()=>!!QK.done[3]},
{id:"route",i:"🏅",n:"Routing Beginner",d:"Selesaikan Quest Static Route.",ok:()=>!!QK.done[2]},
{id:"trb",i:"🏅",n:"Troubleshooter",d:"Selesaikan 2 lab troubleshooting.",ok:()=>Object.keys(LABDONE).length>=2},
{id:"sub",i:"🏅",n:"Subnetting Expert",d:"Selesaikan modul Subnetting dan capai akurasi 80% (min. 5 soal).",ok:()=>{const c=(QS.cat||{}).Subnetting;return progOf(5)===100&&!!c&&c[1]>=5&&c[0]/c[1]>=.8}},
{id:"bld",i:"🏅",n:"Network Builder",d:"Kirim packet antar perangkat di Topology Builder.",ok:()=>!!store.get("bldPing",false)},
{id:"ospf",i:"🏅",n:"OSPF Neighbor",d:"Buat neighbor OSPF FULL di Topology Builder.",ok:()=>!!store.get("bldOspf",false)},
{id:"proj",i:"🏅",n:"Network Project",d:"Selesaikan Network Project Jaringan Sekolah.",ok:()=>!!store.get("netproj",{}).done},
{id:"neteng",i:"🏆",n:"Network Engineer",d:"Raih ketiga badge Topology Builder.",ok:()=>!!store.get("bldPing",false)&&!!store.get("bldOspf",false)&&!!store.get("netproj",{}).done},
{id:"linst",i:"🏅",n:"First Linux Install",d:"Selesaikan Linux Installation Lab.",ok:()=>!!store.get("inst",{}).xpGiven},
{id:"qm",i:"🏅",n:"Quiz Master",d:"Skor 90% atau lebih pada ujian 10 soal ke atas.",ok:()=>store.get("quizHistory",[]).some(x=>x.exam&&x.total>=10&&x.score/x.total>=.9)}];
const earned=()=>store.get("badges",{});
function showBadge(b){
 const el=document.createElement("div");
 el.className="bpop";el.setAttribute("role","status");
 el.innerHTML="<span>"+b.i+"</span><div><b>Badge unlocked!</b><br>"+esc(b.n)+"</div>";
 document.body.appendChild(el);setTimeout(()=>el.remove(),3800);
}
function checkBadges(){
 const e=earned();let ch=false;
 BADGES.forEach(b=>{if(!e[b.id]&&b.ok()){e[b.id]=Date.now();ch=true;showBadge(b)}});
 if(ch)store.set("badges",e);
}
const badgeCard=()=>{
 const e=earned();
 return `<article class="dcard" style="margin-top:14px"><h2 class="dh2">Badge (${Object.keys(e).length}/${BADGES.length})</h2><div class="bgrid">${BADGES.map(b=>`<div class="badge${e[b.id]?" on":""}"><span aria-hidden="true">${b.i}</span><b>${b.n}</b><small>${e[b.id]?"Diraih":esc(b.d)}</small></div>`).join("")}</div></article>`;
};
document.addEventListener("click",()=>setTimeout(checkBadges,60));
document.addEventListener("keydown",e=>{if(e.key==="Enter")setTimeout(checkBadges,60)});

export {showBadge, checkBadges, BADGES, earned, badgeCard};
