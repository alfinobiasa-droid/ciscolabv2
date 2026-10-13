import {xpPop, dailyEvent, store, S, $, esc, hl, pad2, quietly} from "../core.js";
import {go} from "../main.js";
import {withDevice, sbInit, sbRun, RT, sbPrompt} from "../sim/engine.js";
import {RULES} from "./quest.js";
import {renderTrouble} from "./trouble.js";
import {topoSvg} from "./lesson.js";
import {has} from "./reference.js";
import {SCOL} from "./netview.js";
import {dev} from "../sim/network.js";

const LABS=[
{id:"e1",lvl:"Easy",title:"Interface router mati",dev:"router",sym:"PC1 tidak bisa menjangkau gateway 192.168.1.1.",nodes:[["PC1","pc"],["SW1","sw"],["R1","rt","bad"],["PC2","pc"]],
 setup:["enable","conf t","hostname R1","int g0/0","ip address 192.168.1.1 255.255.255.0","exit","int g0/1","ip address 10.0.0.1 255.255.255.252","no shutdown","end"],
 tools:["show ip interface brief","ping 192.168.1.10","show interfaces"],solved:{test:"iface",name:"GigabitEthernet0/0",up:true},hint:"Lihat kolom Status pada show ip interface brief.",
 exp:"Gi0/0 berstatus administratively down. Perbaikan: interface g0/0 lalu no shutdown."},
{id:"e2",lvl:"Easy",title:"IP gateway salah subnet",dev:"router",sym:"PC di LAN 192.168.1.0/24 tidak bisa di-ping dari R1.",nodes:[["PC1","pc"],["SW1","sw"],["R1","rt","bad"],["Server","srv"]],
 setup:["enable","conf t","hostname R1","int g0/0","ip address 192.168.2.1 255.255.255.0","no shutdown","exit","int g0/1","ip address 10.0.0.1 255.255.255.252","no shutdown","end"],
 tools:["show ip interface brief","ping 192.168.1.10"],solved:{test:"cmd_out",cmd:"ping 192.168.1.10",has:"!!!!!"},hint:"PC berada di 192.168.1.0/24. Apakah IP Gi0/0 sesuai?",
 exp:"Gi0/0 memakai 192.168.2.1/24, padahal LAN PC adalah 192.168.1.0/24. Perbaikan: ip address 192.168.1.1 255.255.255.0."},
{id:"m1",lvl:"Medium",title:"Internet tidak terjangkau",dev:"router",sym:"LAN bisa ping gateway, tetapi 8.8.8.8 tidak terjangkau.",nodes:[["PC1","pc"],["R1","rt","bad"],["ISP","rt"],["Internet","cloud"]],
 setup:["enable","conf t","hostname R1","int g0/0","ip address 192.168.1.1 255.255.255.0","no shutdown","exit","int g0/1","ip address 10.0.0.1 255.255.255.252","no shutdown","end"],
 tools:["ping 8.8.8.8","show ip route","traceroute 8.8.8.8"],solved:{test:"cmd_out",cmd:"ping 8.8.8.8",has:"!!!!!"},hint:"Gateway of last resort belum diatur.",
 exp:"R1 belum punya default route menuju ISP (10.0.0.2). Perbaikan: ip route 0.0.0.0 0.0.0.0 10.0.0.2 di global configuration."},
{id:"m2",lvl:"Medium",title:"Dua PC beda VLAN",dev:"switch",sym:"PC1 (Fa0/1) dan PC2 (Fa0/2) satu subnet, tetapi tidak bisa saling ping.",nodes:[["PC1","pc"],["SW1","sw","bad"],["PC2","pc"]],
 setup:["enable","conf t","hostname SW1","vlan 10","name Sales","vlan 20","name Admin","int fa0/1","switchport access vlan 10","int fa0/2","switchport access vlan 20","end"],
 tools:["show vlan brief","show running-config"],solved:{test:"ports_same_vlan",a:"FastEthernet0/1",b:"FastEthernet0/2"},hint:"Bandingkan VLAN pada Fa0/1 dan Fa0/2.",
 exp:"Fa0/2 berada di VLAN 20, sedangkan Fa0/1 di VLAN 10. Perbaikan: interface fa0/2 lalu switchport access vlan 10."},
{id:"h1",lvl:"Hard",title:"ACL memblokir seluruh LAN",dev:"router",sym:"Host 192.168.1.10 tidak bisa mengakses server 10.0.0.5.",nodes:[["PC1","pc"],["R1","rt","bad"],["Server","srv"]],
 setup:["enable","conf t","hostname R1","int g0/0","ip address 192.168.1.1 255.255.255.0","no shutdown","exit","int g0/1","ip address 10.0.0.1 255.255.255.0","no shutdown","exit","access-list 10 deny 192.168.1.0 0.0.0.255","access-list 10 permit any","int g0/1","ip access-group 10 out","end"],
 tools:["simulate 192.168.1.10 10.0.0.5 icmp","show access-lists","show running-config"],solved:{test:"cmd_out",cmd:"simulate 192.168.1.10 10.0.0.5 icmp",has:"RESULT: ALLOWED"},hint:"Periksa ACL yang terpasang pada Gi0/1 dan aturannya.",
 exp:"ACL 10 menolak seluruh LAN 192.168.1.0/24 pada Gi0/1 (out). Perbaikan: interface g0/1 lalu no ip access-group 10 out, atau ubah ACL agar hanya host tertentu yang ditolak."},
 {id:"h2",lvl:"Hard",title:"DHCP Relay Tidak Aktif",dev:"router",sym:"PC di LAN gagal mendapatkan alamat dari DHCP Server 10.0.0.100.",nodes:[["PC1","pc"],["R1","rt","bad"],["DHCP","srv"]],setup:["enable","conf t","hostname R1","int g0/0","ip address 192.168.1.1 255.255.255.0","no shutdown","exit","int g0/1","ip address 10.0.0.1 255.255.255.0","no shutdown","end"],tools:["show running-config","show ip interface brief"],solved:{test:"cmd_out",cmd:"show running-config",has:"ip helper-address 10.0.0.100"},hint:"DHCP broadcast perlu diteruskan dari interface LAN.",exp:"Tambahkan ip helper-address 10.0.0.100 pada interface g0/0."},
 {id:"m3",lvl:"Medium",title:"OSPF Area Tidak Sama",dev:"router",sym:"R1 tidak membentuk adjacency OSPF dengan R2.",nodes:[["R1","rt","bad"],["R2","rt"],["LAN2","pc"]],setup:["enable","conf t","hostname R1","int g0/0","ip address 10.0.0.1 255.255.255.252","no shutdown","exit","router ospf 1","network 10.0.0.0 0.0.0.3 area 1","end"],tools:["show ip ospf neighbor","show running-config"],solved:{test:"cmd_out",cmd:"show running-config",has:"area 0"},hint:"Pastikan network link berada di backbone area 0.",exp:"Ubah network OSPF menjadi area 0 agar sama dengan R2."},
 {id:"e3",lvl:"Easy",title:"SSH Belum Aktif",dev:"router",sym:"Admin tidak bisa melakukan SSH ke R1.",nodes:[["Admin","pc"],["R1","rt","bad"]],setup:["enable","conf t","hostname R1","ip domain-name netlab.local","line vty 0 4","transport input ssh","login local","end"],tools:["show ip ssh","show running-config"],solved:{test:"cmd_out",cmd:"show ip ssh",has:"SSH Enabled"},hint:"SSH memerlukan RSA key.",exp:"Generate RSA key dengan crypto key generate rsa setelah domain-name dikonfigurasi."}];
const LAB={on:false,id:null,obj:null,lines:[],solved:false,gain:false};
const LABDONE=store.get("labs",{});
const LCHIPS={router:["configure terminal","interface g0/0","interface g0/1","no shutdown","ip address ","no ip access-group 10 out","end"],switch:["configure terminal","interface fa0/1","interface fa0/2","switchport access vlan 10","end"]};
function labOpen(id){
 const sc=LABS.find(x=>x.id===id);
 LAB.id=id;LAB.obj={};LAB.solved=false;LAB.gain=false;LAB.hl=0;
 sbInit(LAB.obj,sc.dev);
 quietly(()=>withDevice(LAB.obj,()=>sc.setup.forEach(c=>sbRun(c))));
 LAB.obj.seen={};LAB.lines=["Masalah: "+sc.sym,"Gunakan tombol alat atau ketik command untuk mendiagnosis dan memperbaiki."];
}
function labRun(cmd){
 const sc=LABS.find(x=>x.id===LAB.id);
 LAB.lines.push(...withDevice(LAB.obj,()=>[sbPrompt()+" "+cmd,...sbRun(cmd)]));
 if(!LAB.solved&&RULES[sc.solved.test](LAB.obj,sc.solved)){
  LAB.solved=true;LAB.gain=!LABDONE[sc.id];
  if(LAB.gain){LABDONE[sc.id]=true;store.set("labs",LABDONE);S.xp+=50;store.set("xp",S.xp);xpPop(50);dailyEvent("trouble")}
  return renderLab();
 }
 labDraw();
}
function labDraw(){
 const o=$("#lout");if(!o)return;
 o.innerHTML=LAB.lines.map(l=>`<div class="tl">${esc(l)||"&nbsp;"}</div>`).join("");
 $("#lp").textContent=withDevice(LAB.obj,sbPrompt);
 const t=$("#lterm");t.scrollTop=t.scrollHeight;
}
const LPREP={e1:{goal:"Mengaktifkan kembali interface router yang mati.",need:["Status interface (up/down)","Command show ip interface brief"],items:["1 Router (R1)","1 LAN"]},e2:{goal:"Memperbaiki IP gateway agar sesuai dengan subnet LAN.",need:["IP Address","Subnet Mask","Default Gateway"],items:["1 Router","1 LAN 192.168.1.0/24"]},m1:{goal:"Membuat R1 memiliki jalan keluar ke Internet.",need:["Routing table","Default route"],items:["Router R1 dan ISP","2 network"]},m2:{goal:"Membuat dua PC pada switch yang sama bisa saling terhubung.",need:["VLAN","Access port"],items:["1 Switch","2 PC"]},h1:{goal:"Memulihkan akses PC ke server dengan memperbaiki ACL.",need:["ACL dan implicit deny","Arah ACL (in/out)"],items:["Router R1","1 LAN dan 1 server"]}};
const LCONF={e1:"Interface seperti saklar lampu: IP adalah alamat lampunya, no shutdown adalah menyalakan saklarnya.",e2:"Subnet seperti nomor RT: perangkat harus berada di RT yang sama dengan gateway-nya.",m1:"Default route seperti papan petunjuk Semua tujuan lain lewat sini.",m2:"VLAN seperti ruangan: dua PC di ruangan berbeda tidak bisa mengobrol langsung.",h1:"ACL seperti satpam dengan daftar tamu: aturan yang terlalu luas menolak semua orang."};
const LOBJ={e1:"Restore connectivity between PC1 and its gateway.",e2:"Make the LAN reachable from R1.",m1:"Restore Internet connectivity from R1.",m2:"Restore connectivity between PC1 and PC2.",h1:"Restore access from PC1 to the server."};
function renderLab(){
 const v=$("#view"),lvc={Easy:"var(--ok)",Medium:"var(--orange)",Hard:"var(--bad)"};
 const tabs=`<div class="seg" style="margin-bottom:12px"><button class="chip" data-lab="cases" aria-pressed="false">Cases</button><button class="chip" data-lab="home" aria-pressed="true">Incident Lab</button></div>`;
 if(!LAB.id&&LAB.prep){const sc=LABS.find(x=>x.id===LAB.prep),pr=LPREP[sc.id],i=LABS.indexOf(sc);v.innerHTML=`<button class="chip" data-lab="home" style="margin-bottom:10px">← Semua incident</button><div class="pan"><p class="lbl">LAB · CASE #${pad2(i+1)} · ${sc.lvl.toUpperCase()}</p><h1 class="pg" style="margin:4px 0 12px">${sc.title}</h1><p class="lbl">🎯 Tujuan</p><p style="margin:0 0 10px">${pr.goal}</p><p class="lbl">📚 Kamu perlu tahu</p><ul class="prac">${pr.need.map(x=>`<li>${x}</li>`).join("")}</ul><p class="lbl sp">⏱ Estimasi</p><p style="margin:0">5–10 menit</p><p class="lbl sp">🎒 Yang dibutuhkan</p><ul class="prac">${pr.items.map(x=>`<li>${x}</li>`).join("")}</ul><button class="act" style="width:auto;margin-top:14px" data-lab="start" data-v="${sc.id}">MULAI LAB</button></div>`;return}
 if(!LAB.id){
  v.innerHTML=`<h1 class="pg" style="margin:4px 0 4px">Network Incident Lab</h1><p class="muted" style="margin:0 0 12px">Diagnose a live simulated device, fix the fault with CLI commands, and earn +50 XP.</p>${tabs}<div class="grid">${LABS.map((sc,i)=>`<article class="mod" style="--c:${lvc[sc.lvl]}"><div class="inc-top"><span class="inc-case">CASE #${pad2(i+1)}</span><span class="diff" style="color:${lvc[sc.lvl]}">● ${sc.lvl.toUpperCase()}</span></div><h3>${sc.title}</h3><p style="margin:0" class="muted">Objective: ${LOBJ[sc.id]}</p><div class="meta"><span class="tag">${LABDONE[sc.id]?"Resolved ✓":"Open"}</span><span class="tag o">Reward +50 XP</span></div><button class="go" data-lab="open" data-v="${sc.id}">${LABDONE[sc.id]?"Replay":"Start Incident"}</button></article>`).join("")}</div>`;
  return;
 }
 const sc=LABS.find(x=>x.id===LAB.id),idx=LABS.indexOf(sc),lvc2=lvc[sc.lvl],nodes=sc.nodes.map(n=>[n[0],n[1],n[2]==="bad"&&!LAB.solved?"bad":"ok"]);
 v.innerHTML=`<button class="chip" data-lab="home" style="margin-bottom:10px">← All incidents</button><div class="pan"><div class="inc-top"><span class="inc-case">CASE #${pad2(idx+1)}</span><span class="diff" style="color:${lvc2}">● ${sc.lvl.toUpperCase()}</span></div><h1 class="pg" style="margin:6px 0">${sc.title}</h1><p style="margin:0" class="muted">Objective: ${LOBJ[sc.id]}</p>${topoSvg(nodes)}
 <div class="stlist">${nodes.map(n=>`<span><i style="background:${n[2]==="bad"?SCOL.bad:SCOL.ok}"></i>${esc(n[0])} ${n[2]==="bad"?"Problem":"Online"}</span>`).join("")}</div>
 ${LAB.solved?`<div role="status" class="fb ok"><b>✓ INCIDENT RESOLVED${LAB.gain?" · +50 XP":""}</b><p>${esc(sc.exp)}</p></div>`:`<p class="lbl">Tools</p><div class="seg" style="margin-bottom:8px">${sc.tools.map(c=>`<button class="chip" data-lab="run" data-v="${esc(c)}">${esc(c)}</button>`).join("")}</div>`}
 <div class="term" id="lterm" style="height:min(46vh,380px);margin-top:10px"><div id="lout"></div><label class="tin"><span id="lp"></span><input id="lcmd" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Lab command"></label></div>
 <div class="seg" style="margin-top:10px">${LCHIPS[sc.dev].map(c=>`<button class="chip" data-lab="fill" data-v="${esc(c)}">${esc(c)}</button>`).join("")}</div>
 ${LAB.solved?"":`<button class="chip" data-lab="hint" style="margin-top:10px">Hint</button> <button class="chip" data-lab="conf" style="margin-top:10px">🤔 Saya masih bingung</button>`}</div>`;
 labDraw();
}
document.addEventListener("click",e=>{
 const t=e.target.closest("[data-lab]");if(!t)return;
 const a=t.dataset.lab,v=t.dataset.v;
 if(a==="cases"){LAB.on=false;LAB.id=null;return renderTrouble()}
 if(a==="home"){LAB.on=true;LAB.id=null;LAB.prep=null;return renderLab()}
 if(a==="open"){LAB.on=true;LAB.id=null;LAB.prep=v;return renderLab()}
 if(a==="start"){LAB.on=true;LAB.prep=null;labOpen(v);return renderLab()}
 if(a==="run")return labRun(v);
 if(a==="fill"){const i=$("#lcmd");i.value=v;i.focus();return}
 if(a==="hint"){const sc=LABS.find(x=>x.id===LAB.id);LAB.hl=Math.min((LAB.hl||0)+1,3);LAB.lines.push(["","Hint 1: "+sc.hint,"Hint 2: Jalankan "+sc.tools[0]+" lalu baca hasilnya dengan teliti.","Hint 3 (solusi): "+sc.exp][LAB.hl]);labDraw();t.textContent=LAB.hl<3?"Hint "+(LAB.hl+1)+" ("+LAB.hl+"/3 dibuka)":"Semua hint dibuka"}
 if(a==="conf"){LAB.lines.push("Analogi: "+LCONF[LAB.id]);labDraw()}
});
document.addEventListener("keydown",e=>{
 if(e.target.id!=="lcmd"||e.key!=="Enter")return;
 const v=e.target.value.trim();e.target.value="";if(v)labRun(v);
});

export {labOpen, labRun, labDraw, renderLab, LABS, LAB, LABDONE, LCHIPS, LPREP, LCONF, LOBJ};
