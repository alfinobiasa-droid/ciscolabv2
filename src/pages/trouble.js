import {xpPop, dailyEvent, store, S, $, esc} from "../core.js";
import {go} from "../main.js";
import {renderLab, LAB} from "./lab.js";

const CAUSES=[
["VLAN salah","bandingkan VLAN kedua port dengan show vlan brief."],
["IP address salah","pastikan tiap perangkat punya IP unik di subnet yang benar."],
["Subnet mask salah","hitung network address dari IP dan mask, lalu pastikan gateway ada di subnet yang sama."],
["Gateway salah","gateway harus sama dengan IP interface router di LAN tersebut."],
["Interface shutdown","cek show ip interface brief; status harus up/up."],
["Routing belum dibuat","cek show ip route di setiap router, termasuk route baliknya."]];
const TS=[
{id:1,title:"PC2 tidak terjangkau dari PC1",ans:4,
 topo:[["💻","PC1",["192.168.1.10/24","GW 192.168.1.1"]],["🌐","R1",["Gi0/0 192.168.1.1/24","Gi0/1 192.168.2.1/24"]],["💻","PC2",["192.168.2.10/24","GW 192.168.2.1"]]],
 out:"R1#show ip interface brief\nGi0/0  192.168.1.1  up  up\nGi0/1  192.168.2.1  administratively down  down",
 exp:"Gi0/1 berstatus administratively down, sehingga LAN PC2 tidak aktif. Perbaikan: interface g0/1 lalu no shutdown."},
{id:2,title:"Dua LAN di balik dua router",ans:5,
 topo:[["💻","PC1",["192.168.1.10/24","GW 192.168.1.1"]],["🌐","R1",["Gi0/0 192.168.1.1/24","Gi0/1 10.0.0.1/30"]],["🌐","R2",["Gi0/0 10.0.0.2/30","Gi0/1 192.168.3.1/24"]],["💻","PC2",["192.168.3.10/24","GW 192.168.3.1"]]],
 out:"R1#show ip route\nC  10.0.0.0/30 is directly connected, Gi0/1\nC  192.168.1.0/24 is directly connected, Gi0/0",
 exp:"R1 tidak punya route ke 192.168.3.0/24, dan R2 juga belum punya route balik ke 192.168.1.0/24. Tambahkan static route (atau OSPF) di kedua router."},
{id:3,title:"Ping ke LAN sebelah gagal",ans:3,
 topo:[["💻","PC1",["192.168.1.10/24","GW 192.168.1.254"]],["🌐","R1",["Gi0/0 192.168.1.1/24","Gi0/1 192.168.2.1/24"]],["💻","PC2",["192.168.2.10/24","GW 192.168.2.1"]]],out:"",
 exp:"Gateway PC1 seharusnya 192.168.1.1 (IP Gi0/0 di R1). Alamat 192.168.1.254 tidak ada, sehingga paket ke luar subnet tidak punya jalan keluar."},
{id:4,title:"PC1 tidak bisa menjangkau router",ans:2,
 topo:[["💻","PC1",["192.168.1.10","Mask 255.255.255.252","GW 192.168.1.1"]],["🌐","R1",["Gi0/0 192.168.1.1/24","Gi0/1 192.168.2.1/24"]],["💻","PC2",["192.168.2.10/24","GW 192.168.2.1"]]],out:"",
 exp:"Dengan mask /30, PC1 berada di 192.168.1.8/30 (host .9 dan .10), sehingga gateway .1 berada di luar subnetnya. Mask seharusnya 255.255.255.0."},
{id:5,title:"Dua PC di satu switch",ans:1,
 topo:[["💻","PC1",["192.168.1.10/24"]],["🔀","Switch",["VLAN 1 (semua port)"]],["💻","PC2",["192.168.1.10/24"]]],out:"",
 exp:"Kedua PC memakai IP 192.168.1.10 (IP conflict). Ubah salah satunya, misalnya PC2 menjadi 192.168.1.20."},
{id:6,title:"Satu subnet tapi tetap gagal",ans:0,
 topo:[["💻","PC1",["192.168.10.10/24","Fa0/1"]],["🔀","Switch",["VLAN 10: Fa0/1","VLAN 20: Fa0/2"]],["💻","PC2",["192.168.10.20/24","Fa0/2"]]],
 out:"Switch#show vlan brief\n10  Sales   Fa0/1\n20  Admin   Fa0/2",
 exp:"PC2 berada di VLAN 20, padahal harus satu VLAN dengan PC1. Perbaikan: interface fa0/2 lalu switchport access vlan 10."},
{"id":7,"title":"Server di balik dua router","ans":5,"topo":[["💻","PC1",["192.168.1.10/24","GW 192.168.1.1"]],["🌐","R1",["Gi0/0 192.168.1.1/24","Gi0/1 203.0.113.1/30"]],["🌐","ISP",["Gi0/0 203.0.113.2/30","Gi0/1 198.51.100.1/24"]],["🖥️","Server",["198.51.100.10/24","GW 198.51.100.1"]]],"out":"R1#show ip route\nGateway of last resort is not set\nC  192.168.1.0/24 is directly connected, Gi0/0\nC  203.0.113.0/30 is directly connected, Gi0/1","exp":"R1 tidak punya route menuju 198.51.100.0/24. Tambahkan default route: ip route 0.0.0.0 0.0.0.0 203.0.113.2."},
{"id":8,"title":"Link antar router mati","ans":4,"topo":[["💻","PC1",["192.168.1.10/24","GW 192.168.1.1"]],["🌐","R1",["Gi0/1 10.0.0.1/30 (up/up)"]],["🌐","R2",["Gi0/0 10.0.0.2/30"]],["💻","PC2",["192.168.3.10/24","GW 192.168.3.1"]]],"out":"R2#show ip interface brief\nGi0/0  10.0.0.2  YES manual  administratively down  down","exp":"Gi0/0 di R2 dimatikan (administratively down), sehingga link ke R1 tidak aktif. Perbaikan: interface g0/0 lalu no shutdown."},
{"id":9,"title":"Ping berangkat tapi tidak kembali","ans":3,"topo":[["💻","PC1",["192.168.1.10/24","GW 192.168.1.1"]],["🌐","R1",["Gi0/0 192.168.1.1/24","Gi0/1 192.168.2.1/24"]],["💻","PC2",["192.168.2.10/24","GW 192.168.2.11"]]],"out":"","exp":"Gateway PC2 salah ketik (.11, seharusnya .1), sehingga balasan tidak bisa keluar dari LAN 192.168.2.0/24."},
{"id":10,"title":"Router tidak terjangkau dari PC2","ans":2,"topo":[["💻","PC1",["192.168.1.10/24","GW 192.168.1.1"]],["🌐","R1",["Gi0/0 192.168.1.1/24","Gi0/1 192.168.2.1/24"]],["💻","PC2",["192.168.2.200","Mask 255.255.255.128","GW 192.168.2.1"]]],"out":"","exp":"Mask /25 membuat PC2 berada di 192.168.2.128/25, sehingga gateway 192.168.2.1 berada di luar subnetnya. Mask seharusnya 255.255.255.0."}
];
const T={cur:null,sel:null,gain:false};
const TK=store.get("trouble",{done:{}});
function renderTrouble(){
 if(LAB.on)return renderLab();
 const v=$("#view"),d=Object.keys(TK.done).length;
 if(T.cur==null){
  v.innerHTML=`<h1 class="pg" style="margin:4px 0 6px">Troubleshooting</h1><div class="seg" style="margin-bottom:12px"><button class="chip" data-lab="cases" aria-pressed="true">Cases</button><button class="chip" data-lab="home" aria-pressed="false">Incident Lab</button></div><p style="color:var(--mute);margin:0 0 14px">Baca topologi dan output, lalu tentukan penyebabnya. ${d} dari ${TS.length} kasus selesai.</p>
  <div class="grid">${TS.map(t=>{const ok=TK.done[t.id];return `<article class="mod" style="--c:${ok?"#1a9b5c":"var(--orange)"}"><div><div class="n">Kasus ${t.id}</div><h3>${t.title}</h3></div><div class="meta"><span class="tag">${ok?"Selesai ✓":"Belum selesai"}</span><span class="tag o">+10 XP</span></div><button class="go" data-tb="open" data-v="${t.id}">${ok?"Ulangi Kasus":"Buka Kasus"}</button></article>`}).join("")}</div>`;
  return;
 }
 const t=TS.find(x=>x.id===T.cur),fin=T.sel!=null,ok=fin&&T.sel===t.ans;
 const fb=fin?`<div role="status" class="fb ${ok?"ok":"no"}"><b>${ok?"✓ Benar! "+(T.gain?"+10 XP":"XP kasus ini sudah didapat."):"✗ Bukan "+CAUSES[T.sel][0]+"."}</b>
  ${ok?"":`<p>Cara memeriksa ${CAUSES[T.sel][0]}: ${CAUSES[T.sel][1]}</p><p>Penyebab sebenarnya: <b>${CAUSES[t.ans][0]}</b>.</p>`}<p>${esc(t.exp)}</p></div>
  <button class="act" data-tb="next">${TS.some(x=>x.id>t.id)?"Kasus Berikutnya":"Selesai"}</button>`:"";
 v.innerHTML=`<button class="chip" data-tb="list" style="margin-bottom:10px">← Semua kasus</button>
 <div class="qcard"><div class="qtop"><span>Kasus ${t.id} / ${TS.length}</span></div>
 <h1 class="pg" style="margin:8px 0 0;font-size:1.15rem">PC1 tidak dapat melakukan ping ke PC2.</h1>
 <div class="topo">${t.topo.map((n,i)=>`${i?'<span class="link"></span>':""}<div class="node"><div style="font-size:1.6rem">${n[0]}</div><b>${n[1]}</b>${n[2].map(l=>`<small>${esc(l)}</small>`).join("")}</div>`).join("")}</div>
 ${t.out?`<pre class="code">${esc(t.out)}</pre>`:""}
 <b>Apa penyebabnya?</b>
 ${CAUSES.map((c,i)=>{const cl=fin?(i===t.ans?" ok":i===T.sel?" no":""):"";return `<button class="opt${cl}" data-tb="pick" data-v="${i}" ${fin?"disabled":""}><span>${c[0]}</span></button>`}).join("")}${fb}</div>`;
}
document.addEventListener("click",e=>{
 const t=e.target.closest("[data-tb]");if(!t)return;
 const a=t.dataset.tb,v=+t.dataset.v;
 if(a==="open"){T.cur=v;T.sel=null;T.gain=false}
 else if(a==="list")T.cur=null;
 else if(a==="pick"&&T.sel==null){
  const s=TS.find(x=>x.id===T.cur);T.sel=v;
  if(v===s.ans){S.streak++;dailyEvent("trouble");if(!TK.done[s.id]){TK.done[s.id]=true;T.gain=true;S.xp+=10;xpPop(10);store.set("xp",S.xp);store.set("trouble",TK)}}else S.streak=0;
  store.set("streak",S.streak);
 }
 else if(a==="next"){const nx=TS.find(x=>x.id>T.cur);T.cur=nx?nx.id:null;T.sel=null;T.gain=false}
 renderTrouble();window.scrollTo(0,0);
});

export {renderTrouble, CAUSES, TS, T, TK};
