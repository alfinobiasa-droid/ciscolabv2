import QUESTS from "../data/quests.json";
import {toast, xpPop, store, S, $} from "../core.js";
import {go} from "../main.js";
import {withDevice, sbRun, RT, SW, LX, lxAt} from "../sim/engine.js";
import {sameNet} from "../sim/net.js";
import {has} from "./reference.js";
import {dailyCard} from "./dashboard.js";
import {badgeCard} from "./badges.js";
import {dev, rid} from "../sim/network.js";

const QK=store.get("quests",{done:{}});
const RULES={
 hostname:(o,r)=>o.host===r.value,
 iface:(o,r)=>{const i=o.ifs[r.name];return!!i&&(r.ip===undefined||i.ip===r.ip)&&(r.mask===undefined||i.mask===r.mask)&&(r.up===undefined||i.up===r.up)&&(!r.hasIp||!!i.ip)},
 static_route:(o,r)=>{const i=o.ifs[r.name];return i.up&&!!i.ip&&o.routes.some(x=>sameNet(i.ip,x.nh,i.mask))},
 default_route:o=>o.routes.some(x=>x.net==="0.0.0.0"&&x.mask==="0.0.0.0"),
 seen:(o,r)=>!!o.seen[r.what],
 vlan_exists:(o,r)=>!!o.vlans[r.id],
 access_vlan:(o,r)=>Object.values(o.ifs).some(p=>p.mode==="access"&&p.vlan===r.id),
 any_trunk:o=>Object.values(o.ifs).some(p=>p.mode==="trunk"),
 trunk_native:(o,r)=>Object.values(o.ifs).some(p=>p.mode==="trunk"&&p.native===r.value),
 secret:o=>!!o.secret,
 console_login:o=>!!o.con.pw&&o.con.login,
 banner:o=>!!o.banner,
 saved:o=>!!o.saved,
 dhcp_excluded:o=>o.dhcp.ex.length>0,
 dhcp_pool:o=>Object.values(o.dhcp.pools).some(p=>p.net&&p.gw),
 acl_exists:o=>Object.keys(o.acls).length>0,
 nat_if:(o,r)=>Object.values(o.ifs).some(i=>i.nat===r.value),
 nat_acl:o=>o.nat.some(r=>o.acls[r.acl]),
 acl_deny:o=>Object.values(o.acls).some(r=>r.some(x=>x.act==="deny")&&r.some(x=>x.act==="permit"&&x.txt==="any")),
 acl_applied:o=>Object.values(o.ifs).some(i=>Object.keys(i.acl||{}).length>0),
 acl_ext_web:o=>Object.values(o.acls).some(r=>r.some(x=>x.act==="deny"&&x.proto==="tcp"&&x.port===80)&&r.some(x=>x.act==="permit"&&x.proto==="ip")),
 rip_v2:o=>o.rp.on&&o.rp.ver===2,
 rip_net:o=>o.rp.nets.length>0,
 rip_noauto:o=>o.rp.on&&!o.rp.auto,
 ospf_on:o=>!!o.os.pid,
 ospf_rid:o=>!!o.os.rid,
 ospf_net:o=>o.os.nets.some(x=>/ area 0$/.test(x)),
 eigrp_on:o=>!!o.ei.as,
 eigrp_net:o=>o.ei.nets.length>0,
 eigrp_noauto:o=>!!o.ei.as&&!o.ei.auto,
 path:(o,r)=>{const n=lxAt(o,r.path);return!!n&&n.t===r.type},
 mode:(o,r)=>{const n=lxAt(o,r.path);return!!n&&(n.m&0o777)===parseInt(r.value,8)},
 owner:(o,r)=>{const n=lxAt(o,r.path);return!!n&&n.o===r.value},
 user:(o,r)=>o.users.includes(r.value),
 linux_installed:()=>!!store.get("inst",{}).done,
 linux_login:()=>!!LX.installed,
 cmd_out:(o,r)=>withDevice(o,()=>{const m=o.mode,c=o.cur;o.mode="priv";const out=sbRun(r.cmd);o.mode=m;o.cur=c;return out}).join("\n").includes(r.has),
 ports_same_vlan:(o,r)=>{const a=o.ifs[r.a],b=o.ifs[r.b];return a.mode==="access"&&b.mode==="access"&&a.vlan===b.vlan}
};
const check=r=>RULES[r.test](r.dev==="linux"?LX:r.dev==="switch"?SW:RT,r);

function questCard(q){
 const st=q.obj.map(o=>check(o.rule)),done=!!QK.done[q.id],n=done?q.obj.length:st.filter(Boolean).length;
 return `<article class="mod" style="--c:${done?"#1a9b5c":"var(--orange)"}"><div><div class="n">Quest ${q.id}</div><h3>${q.title}</h3></div>
 <p style="margin:0;color:var(--mute)">${q.desc}</p>
 <div>${q.obj.map((o,i)=>{const ok=done||st[i];return `<div class="obj${ok?" ok":""}"><i>${ok?"✓":""}</i><span>${o.t}</span></div>`}).join("")}</div>
 <div class="bar"><i style="width:${n/q.obj.length*100}%"></i></div>
 <small style="color:var(--mute)">${q.hint}</small>
 <div class="meta"><span class="tag o">+${q.xp} XP</span><span class="tag">${done?"Selesai ✓":n+"/"+q.obj.length+" target"}</span></div>
 ${done?"":`<button class="go" data-qk="${q.id}">Periksa &amp; Klaim</button>`}<button class="go" style="background:var(--soft);color:var(--ink)" data-go="sandbox">Buka Sandbox</button></article>`;
}
function renderQuest(){
 const d=Object.keys(QK.done).length;
 $("#view").innerHTML=`<h1 class="pg" style="margin:4px 0 6px">Quest</h1><p style="color:var(--mute);margin:0 0 14px">Kerjakan konfigurasi di Sandbox, lalu kembali ke sini untuk klaim hadiah. ${d} dari ${QUESTS.length} quest selesai.</p>
 ${dailyCard()}${badgeCard()}<p class="lbl sp">Quests</p><div class="grid">${QUESTS.map(questCard).join("")}</div>`;
}
document.addEventListener("click",e=>{
 const t=e.target.closest("[data-qk]");if(!t)return;
 const q=QUESTS.find(x=>x.id==t.dataset.qk);
 if(q.obj.every(o=>check(o.rule))){QK.done[q.id]=true;S.xp+=q.xp;xpPop(q.xp);store.set("xp",S.xp);store.set("quests",QK);toast(`Quest selesai! +${q.xp} XP`)}
 else toast("Target belum lengkap. Cek di Sandbox lalu coba lagi.");
 renderQuest();
});

export {questCard, renderQuest, QK, RULES, check};
