import {toast, touchDay, store, S, $, esc, copyText} from "../core.js";
import {useDevice, lxInit, sbInit, sbReset, sbRun, RT, SW, LX, SB, LXHELP, LXCHIPS, CHIPS, HELP, sbPrompt, HELPSW, SWCHIPS} from "../sim/engine.js";
import {isIp, validMask} from "../sim/net.js";
import {check} from "./quest.js";
import {setLesson, openModule, renderModule} from "./lesson.js";
import {devStatus, liveTopo, topoLegend} from "./netview.js";
import {dev} from "../sim/network.js";

const CMDLIST={
 "r:user":"enable|ping |traceroute |show ip interface brief|show ip route|show interfaces|show ip protocols|simulate ",
 "r:priv":"disable|configure terminal|ping |traceroute |show running-config|show startup-config|show ip interface brief|show ip route|show interfaces|show ip protocols|show access-lists|copy running-config startup-config|simulate |exit",
 "r:config":"hostname |interface |ip route |no ip route |ip dhcp pool |ip dhcp excluded-address |ip nat inside source list |access-list |no access-list |router rip|router ospf |router eigrp |enable secret |banner motd |line console 0|do show |end|exit",
 "r:if":"ip address |no ip address|no shutdown|shutdown|ip nat inside|ip nat outside|ip access-group |no ip access-group |exit|end",
 "r:line":"password |login|exit|end","r:router":"network |version 2|no auto-summary|router-id |passive-interface |exit|end","r:dhcp":"network |default-router |dns-server |exit|end",
 "s:user":"enable|show vlan brief|show interfaces trunk","s:priv":"disable|configure terminal|show vlan brief|show interfaces trunk|show interfaces|show running-config|show startup-config|copy running-config startup-config",
 "s:config":"hostname |vlan |no vlan |interface |enable secret |banner motd |line console 0|do show |end|exit",
 "s:if":"switchport mode access|switchport mode trunk|switchport access vlan |switchport trunk native vlan |switchport trunk allowed vlan |shutdown|no shutdown|exit|end","s:vlan":"name |exit|end","s:line":"password |login|exit|end",
 "l":"pwd|cd |ls |ls -l |mkdir |touch |cp |cp -r |mv |rm |rm -r |rmdir |chmod |chown |useradd |passwd|whoami|cat |help|clear"};
function sbComplete(inp){
 const v=inp.value.replace(/^\s+/,""),low=v.toLowerCase();
 const list=(CMDLIST[SB.dev==="linux"?"l":(SB.dev==="switch"?"s":"r")+":"+SB.mode]||"").split("|").filter(Boolean);
 const c=list.filter(x=>x.startsWith(low));
 if(!c.length)return;
 if(c.length===1){inp.value=c[0];return}
 let p=c[0];c.forEach(x=>{while(!x.startsWith(p))p=p.slice(0,-1)});
 if(p.length>v.length)inp.value=p;
 else{SB.lines.push(sbPrompt()+" "+v,c.map(x=>x.trim()).join("   "));sbDraw()}
}
function sbDraw(){
 const sh=SB.shown||0;$("#tout").innerHTML=SB.lines.map((l,i)=>`<div class="tl${i>=sh&&sh>0?" new":""}${/^(%|bash:|✗)/.test(l)?" err":""}">${esc(l)||"&nbsp;"}</div>`).join("");SB.shown=SB.lines.length;
 $("#tp").textContent=sbPrompt();
 const t=$("#term");t.scrollTop=t.scrollHeight;
 const sbs=$("#sbstat");if(sbs)sbs.innerHTML=sbStatus();
 const dk=SB.dev==="switch"?"sw":SB.dev==="linux"?"srv":"rt",db=$("#devbadge");if(db)db.innerHTML=(SB.dev==="linux"?"debian":SB.host)+" · "+(SB.dev==="linux"?"ONLINE":{ok:"ONLINE",warn:"WARNING",off:"OFFLINE"}[devStatus(SB,dk)]);
 const tp=$("#sbtopo");if(tp)tp.innerHTML=liveTopo(dk);
 const pd=$("#pktdiag");if(pd&&SB.lastTrace&&SB.lastTrace.n!==SB.traceShown){pd.innerHTML=pipeHtml(SB.lastTrace);pd.hidden=false;pd.classList.remove("play");void pd.offsetWidth;pd.classList.add("play");SB.traceShown=SB.lastTrace.n}
}
let LASTEX=null;
const CMDEX=[
 [/^enable secret/i,"enable secret","Password untuk masuk ke Privileged EXEC Mode.","Melindungi akses konfigurasi. Kata secret berarti password disimpan terenkripsi (hash), bukan teks biasa.","R1(config)# enable secret cisco123","Saat kamu mengetik enable, router meminta password."],
 [/^en(a(b(le?)?)?)?$/i,"enable","Naik dari User EXEC (>) ke Privileged EXEC (#).","Mode # dibutuhkan untuk show lengkap dan untuk masuk ke mode konfigurasi.","Router> enable","Prompt berubah menjadi Router#."],
 [/^conf\w*\s+t/i,"configure terminal","Masuk ke Global Configuration Mode.","Semua perubahan konfigurasi dimulai dari mode ini.","Router# configure terminal","Prompt berubah menjadi Router(config)#."],
 [/^hostname\s/i,"hostname","Mengubah nama perangkat Cisco.","Agar administrator mudah mengenali perangkat, misalnya R1, R2, R3.","Router(config)# hostname R1","Prompt berubah menjadi R1(config)#."],
 [/^int(erface)?\s+\S/i,"interface","Memilih interface yang ingin dikonfigurasi.","IP address dan status harus diatur pada interface tertentu.","R1(config)# interface gigabitEthernet 0/0","Prompt berubah menjadi R1(config-if)#."],
 [/^ip\s+address\s/i,"ip address","Memberikan alamat IP dan subnet mask kepada interface.","Agar interface bisa berkomunikasi di jaringan IP dan menjadi gateway LAN-nya.","R1(config-if)# ip address 192.168.1.1 255.255.255.0","Interface punya IP. Cek dengan show ip interface brief."],
 [/^no\s+shut/i,"no shutdown","Mengaktifkan interface.","Interface router Cisco secara default administratively down, jadi harus dinyalakan.","R1(config-if)# no shutdown","Muncul pesan changed state to up dan topologi berubah menjadi UP."],
 [/^shut/i,"shutdown","Mematikan interface secara administratif.","Dipakai saat perawatan atau untuk memutus link sementara.","R1(config-if)# shutdown","Status interface menjadi administratively down."],
 [/^line\s+con/i,"line console 0","Masuk ke pengaturan port console.","Port console bisa diakses secara fisik, jadi perlu diberi password.","R1(config)# line console 0","Prompt berubah menjadi R1(config-line)#."],
 [/^password\s/i,"password","Menetapkan password pada line yang sedang dipilih.","Melindungi akses lewat console atau vty.","R1(config-line)# password konsol1","Password tersimpan. Tambahkan login agar diminta."],
 [/^login$/i,"login","Mengaktifkan pemeriksaan password pada line.","Tanpa login, password yang sudah dibuat tidak pernah diminta.","R1(config-line)# login","Akses ke line sekarang meminta password."],
 [/^banner\s+motd/i,"banner motd","Membuat pesan yang tampil saat seseorang masuk ke perangkat.","Sebagai peringatan bahwa akses hanya untuk yang berwenang.","R1(config)# banner motd #Akses terbatas#","Pesan tampil sebelum prompt login."],
 [/^copy\s+r\w*\s+s/i,"copy running-config startup-config","Menyimpan konfigurasi yang berjalan (RAM) ke NVRAM.","Konfigurasi di RAM hilang saat perangkat mati atau reload.","R1# copy running-config startup-config","Muncul [OK] dan show startup-config berisi konfigurasi."],
 [/^sh\w*\s+ip\s+int\w*\s+b/i,"show ip interface brief","Menampilkan ringkasan IP dan status semua interface.","Cara tercepat memeriksa interface mana yang up atau down.","R1# show ip interface brief","Tabel interface, IP address, Status, dan Protocol."],
 [/^sh\w*\s+run/i,"show running-config","Menampilkan konfigurasi yang sedang berjalan.","Untuk memeriksa apakah command yang diketik sudah tersimpan benar.","R1# show running-config","Seluruh konfigurasi aktif ditampilkan."],
 [/^ip\s+route\s/i,"ip route","Membuat static route.","Agar router tahu jalur menuju jaringan yang tidak terhubung langsung.","R1(config)# ip route 192.168.2.0 255.255.255.0 10.0.0.2","Route muncul dengan kode S di show ip route."],
 [/^vlan\s+\d+/i,"vlan","Membuat VLAN atau masuk ke konfigurasinya.","Memisahkan jaringan secara logis di switch yang sama.","Switch(config)# vlan 10","VLAN 10 muncul di show vlan brief."],
 [/^switchport\s/i,"switchport","Mengatur mode atau VLAN sebuah port switch.","Menentukan port sebagai access (satu VLAN) atau trunk (banyak VLAN).","Switch(config-if)# switchport access vlan 10","Port menjadi anggota VLAN yang dipilih."],
 [/^ping\s/i,"ping","Menguji apakah tujuan dapat dijangkau.","Langkah pertama troubleshooting konektivitas.","R1# ping 192.168.1.10","!!!!! berarti berhasil, ..... atau UUUUU berarti gagal."],
 [/^(exit|end)$/i,"exit / end","Keluar satu mode (exit) atau langsung ke Privileged EXEC (end).","Untuk berpindah mode dengan cepat.","R1(config-if)# end","Prompt berubah ke mode yang lebih tinggi."],
 [/^chmod\s/i,"chmod","Mengubah hak akses file atau direktori.","Mengatur siapa yang boleh membaca (r), menulis (w), dan menjalankan (x).","chmod 755 file.sh","Pemilik rwx, grup dan lainnya r-x."],
 [/^mkdir\s/i,"mkdir","Membuat direktori baru.","Untuk menata file dalam folder.","mkdir kebun_binatang","Direktori muncul di ls -l."]
];
const PRAC={
 "1.3":[{t:"Hostname diubah menjadi R1",fix:"Pastikan kamu di mode Router(config)#, lalu ketik: hostname R1",rule:{test:"hostname",value:"R1"}}],
 "1.4":[{t:"enable secret sudah diatur",fix:"Di Router(config)# ketik: enable secret cisco123",rule:{test:"secret"}}],
 "1.5":[{t:"Console memakai password dan login",fix:"Masuk line console 0, lalu ketik password konsol1 dan login",rule:{test:"console_login"}}],
 "1.6":[{t:"Banner MOTD sudah dibuat",fix:"Di Router(config)# ketik: banner motd #Akses hanya untuk staf berwenang#",rule:{test:"banner"}}],
 "1.8":[{t:"Gi0/0 memakai IP 192.168.1.1 255.255.255.0",fix:"Pilih interface dulu (interface gigabitEthernet 0/0), lalu: ip address 192.168.1.1 255.255.255.0",rule:{test:"iface",name:"GigabitEthernet0/0",ip:"192.168.1.1",mask:"255.255.255.0"}}],
 "1.9":[{t:"Gi0/0 sudah punya IP",fix:"Beri IP dulu: ip address 192.168.1.1 255.255.255.0",rule:{test:"iface",name:"GigabitEthernet0/0",hasIp:true}},{t:"Gi0/0 sudah UP (no shutdown)",fix:"Di mode interface Gi0/0 ketik: no shutdown",rule:{test:"iface",name:"GigabitEthernet0/0",up:true}}],
 "1.10":[{t:"Konfigurasi disimpan ke startup-config",fix:"Di Router# ketik: copy running-config startup-config",rule:{test:"saved"}}],
 "2.0":[{t:"VLAN 10 dibuat",fix:"Di Switch(config)# ketik: vlan 10",rule:{dev:"switch",test:"vlan_exists",id:10}},{t:"VLAN 20 dibuat",fix:"Di Switch(config)# ketik: vlan 20",rule:{dev:"switch",test:"vlan_exists",id:20}}],
 "2.1":[{t:"Ada port access di VLAN 10",fix:"interface fa0/1 lalu switchport access vlan 10",rule:{dev:"switch",test:"access_vlan",id:10}},{t:"Ada port trunk",fix:"interface g0/1 lalu switchport mode trunk",rule:{dev:"switch",test:"any_trunk"}}],
 "2.2":[{t:"Port trunk tersedia",fix:"interface g0/1 lalu switchport mode trunk",rule:{dev:"switch",test:"any_trunk"}},{t:"Native VLAN trunk adalah 99",fix:"Di interface trunk ketik: switchport trunk native vlan 99",rule:{dev:"switch",test:"trunk_native",value:99}}],
 "3.0":[{t:"Gi0/0 aktif dan punya IP",fix:"interface g0/0, ip address 192.168.1.1 255.255.255.0, no shutdown. Route C muncul setelah interface UP.",rule:{test:"iface",name:"GigabitEthernet0/0",up:true,hasIp:true}}],
 "3.1":[{t:"Gi0/1 aktif dan punya IP",fix:"Aktifkan dulu link ke R2: interface g0/1, ip address 10.0.0.1 255.255.255.252, no shutdown.",rule:{test:"iface",name:"GigabitEthernet0/1",up:true,hasIp:true}},{t:"Static route dengan next hop di network Gi0/1",fix:"Periksa apakah next hop berada pada network interface yang terhubung, lalu: ip route 192.168.2.0 255.255.255.0 10.0.0.2",rule:{test:"static_route",name:"GigabitEthernet0/1"}}],
 "3.2":[{t:"Gi0/1 aktif dan punya IP",fix:"Aktifkan dulu link ke R2: interface g0/1, ip address, no shutdown.",rule:{test:"iface",name:"GigabitEthernet0/1",up:true,hasIp:true}},{t:"Default route sudah dibuat",fix:"Di global configuration ketik: ip route 0.0.0.0 0.0.0.0 10.0.0.2",rule:{test:"default_route"}}]
};
function pracCheck(){
 const cs=PRAC[HINT.mod+"."+HINT.li],box=$("#pracres");if(!cs||!box)return;
 const res=cs.map(c=>({c,ok:!!check(c.rule)})),bad=res.find(r=>!r.ok);
 box.innerHTML=`<ul class="chk-list">${res.map(r=>`<li class="${r.ok?"ok":"no"}">${r.ok?"✓":"✗"} ${esc(r.c.t)}</li>`).join("")}</ul>`+(bad?`<div class="tipbox" role="status"><b>💡 Hint:</b> ${esc(bad.c.fix)}</div>`:`<div class="fb ok" role="status"><b>🎉 Berhasil!</b><p>Kamu baru saja mempraktikkan: <b>${esc(HINT.title)}</b>.</p><p><b>Kenapa ini penting:</b> ${esc(HINT.why||"Praktik ini memperkuat konsep yang baru dipelajari.")}</p><button class="chip s" data-sbact="backlesson">Kembali ke materi →</button></div>`);
}
const pipeHtml=t=>`<p class="lbl">Packet Diagnosis · ${esc(t.src)} → ${esc(t.dst)} · ${esc(t.pr)}</p><div class="pipe">${t.stages.map((s,i)=>`<div class="pstep ${s.s}" style="--d:${i*90}ms"><span class="pic" aria-hidden="true">${s.s==="ok"?"✓":s.s==="fail"?"✗":s.s==="na"?"–":"·"}</span><div><b>${s.k}</b><small>${esc(s.t)}</small></div></div>${i<t.stages.length-1?'<span class="parr" aria-hidden="true">↓</span>':""}`).join("")}</div><div class="pres ${t.result==="ALLOWED"?"ok":"no"}" role="status"><b>${t.result==="ALLOWED"?"PACKET DELIVERED":"PACKET DENIED"}</b>${t.why?`<p><b>WHY?</b> ${esc(t.why)}</p>`:""}</div>`;
const KNOWN=["enable","disable","configure","hostname","interface","ip","no","show","ping","exit","end","vlan","switchport","router","access-list","copy","line","banner","traceroute","simulate"];
function eduErr(v,out){
 const first=out[0]||"";
 if(!/^(% Invalid|% Unrecognized|Command not supported|bash: .*command not found)/.test(first))return null;
 const w=v.trim().split(/\s+/),c=(w[0]||"").toLowerCase(),E=(t,got,why,ex,todo)=>({t,got,why,ex,todo});
 if(c==="ip"&&/^a/i.test(w[1]||"")){
  if(SB.mode==="if"){
   if(!isIp(w[2]||""))return E("IP Address belum valid",w[2]||"(kosong)","IPv4 terdiri dari 4 bagian angka, dan setiap bagian hanya boleh berada pada rentang 0–255.","ip address 192.168.1.10 255.255.255.0","Perbaiki alamat IP, lalu jalankan lagi.");
   if(!validMask(w[3]||""))return E("Subnet mask belum valid",w[3]||"(kosong)","Mask harus berupa deretan bit 1 diikuti bit 0, misalnya 255.255.255.0.","ip address 192.168.1.10 255.255.255.0","Gunakan subnet mask yang valid.");
  }else return E("Command ini hanya untuk mode interface","ip address ...","IP address diberikan pada satu interface, jadi perangkat perlu tahu interface mana yang kamu maksud.","interface gigabitEthernet 0/0\nip address 192.168.1.1 255.255.255.0","Pilih interface dulu dengan: interface gigabitEthernet 0/0");
 }
 if(SB.dev==="linux")return E("Command tidak ditemukan",v.trim(),"Simulator Linux hanya mendukung command dasar.","ls -l\nmkdir kebun\nchmod 755 file.sh","Ketik help untuk melihat command yang tersedia.");
 if(KNOWN.includes(c))return E("Command tidak tersedia di mode ini",v.trim(),"Setiap mode CLI punya daftar command sendiri. Prompt kamu sekarang: "+sbPrompt()+".","Router> enable\nRouter# configure terminal\nRouter(config)#","Naik mode dengan exit atau end, atau masuk mode yang benar (enable, configure terminal, interface ...).");
 return E("Command belum didukung simulator",v.trim(),"Simulator mendukung sebagian command Cisco IOS saja.","?","Ketik ? untuk melihat daftar command yang didukung.");
}
const CMDX2={"ip address":{parts:[["ip address","memberikan alamat IP"],["192.168.1.1","alamat IP interface"],["255.255.255.0","subnet mask"]],mist:["Subnet mask salah","Interface belum diaktifkan (no shutdown)","IP conflict dengan perangkat lain"]},"ip route":{parts:[["ip route","membuat static route"],["192.168.2.0","network tujuan"],["255.255.255.0","subnet mask tujuan"],["10.0.0.2","next hop (tetangga langsung)"]],mist:["Next hop tidak terjangkau","Lupa route balik di router seberang"]},"hostname":{parts:[["hostname","mengganti nama perangkat"],["R1","nama baru"]],mist:["Dijalankan di mode yang salah","Nama mengandung spasi"]},"interface":{parts:[["interface","memilih interface"],["gigabitEthernet 0/0","jenis dan nomor interface"]],mist:["Nomor interface salah"]},"enable secret":{parts:[["enable secret","password terenkripsi"],["cisco123","password"]],mist:["Memakai enable password (kurang aman)"]},"switchport":{parts:[["switchport","pengaturan port switch"],["access vlan 10","anggota VLAN 10"]],mist:["VLAN belum dibuat","Port masih berstatus trunk"]},"no shutdown":{parts:[["no","membatalkan"],["shutdown","mematikan interface"]],mist:["Lupa menjalankan no shutdown"]}};
const exHtml=e=>{const x=CMDX2[e.t];return `<p class="lbl">Penjelasan command</p><b class="mono">${esc(e.t)}</b><p class="lbl sp">Apa itu?</p><p style="margin:0">${esc(e.what)}</p><p class="lbl sp">Kenapa digunakan?</p><p style="margin:0">${esc(e.why)}</p>${x?`<p class="lbl sp">Bagian-bagiannya</p><ul class="parts">${x.parts.map(p=>`<li><code>${esc(p[0])}</code> <span>→ ${esc(p[1])}</span></li>`).join("")}</ul>`:""}<p class="lbl sp">Contoh</p><pre class="code">${esc(e.ex)}</pre><p class="lbl sp">Hasil</p><p style="margin:0">${esc(e.res)}</p>${x?`<p class="lbl sp">Kesalahan umum</p><ul class="parts">${x.mist.map(m=>`<li>${esc(m)}</li>`).join("")}</ul>`:""}<div class="seg" style="margin-top:10px"><button class="chip s" data-sbact="useex">Pakai di Input</button></div>`};
const errHtml=e=>`<p class="lbl">Penjelasan error</p><b>❌ ${esc(e.t)}</b><p class="lbl sp">Yang kamu masukkan</p><pre class="code">${esc(e.got)}</pre><p class="lbl sp">Kenapa?</p><p style="margin:0">${esc(e.why)}</p><p class="lbl sp">Contoh yang benar</p><pre class="code">${esc(e.ex)}</pre><p class="lbl sp">Apa yang harus dilakukan?</p><p style="margin:0">${esc(e.todo)}</p>`;
function showExplain(v,out){
 const p=$("#cmdex"),er=eduErr(v,out||[]);
 if(er&&p){p.hidden=false;p.className="pan flat cmdex errp";void p.offsetWidth;p.innerHTML=errHtml(er);return}
 const m=CMDEX.find(x=>x[0].test(v.trim()));if(!m)return;
 LASTEX={t:m[1],what:m[2],why:m[3],ex:m[4],res:m[5]};
 if(p){p.hidden=false;p.className="pan flat cmdex";p.innerHTML=exHtml(LASTEX)}
}
const HINT={title:"",cmds:null,mod:0,li:0,why:""};
function sbStatus(){
 const f=Object.values(SB.ifs||{}),up=f.filter(i=>i.up).length,k=SB.dev==="switch"?"sw":"rt";
 if(SB.dev==="linux")return `<span class="ok">● Shell ready</span><span>Commands ${SB.hist.length}</span><span>Users ${SB.users.length}</span>`;
 const st=devStatus(SB,k),lab={ok:"Network Healthy",warn:"Check interfaces",off:"Not configured"}[st];
 return `<span class="${st==="ok"?"ok":st==="warn"?"warn":""}">● ${lab}</span><span>Commands ${SB.hist.length}</span><span>Interfaces up ${up}/${f.length}</span><span>${SB.dev==="switch"?"VLANs "+Object.keys(SB.vlans).length:"Routes "+SB.routes.length}</span>`;
}
function renderSandbox(){
 const k=SB.dev==="switch"?"sw":SB.dev==="linux"?"srv":"rt";
 $("#view").innerHTML=`<div class="sb-head"><div><p class="crumb2">NETLAB / SANDBOX</p><h1 class="pg" style="margin:2px 0 0">Sandbox</h1></div><div class="devbadge" id="devbadge"></div></div>
 <div class="seg" style="margin:12px 0">${["router","switch","linux"].map(d=>`<button class="chip" data-sbact="dev-${d}" aria-pressed="${SB.dev===d}">${{router:"Router",switch:"Switch",linux:"Linux (Filesystem Sim)"}[d]}</button>`).join("")}</div>
 ${HINT.cmds&&HINT.cmds.length?`<div class="pan hintc" id="tryhint"><div class="lbl-row"><b>Latihan: ${esc(HINT.title)}</b><button class="chip s" data-sbact="hintx">Tutup</button></div><p class="muted" style="margin:6px 0">Coba jalankan command berikut satu per satu:</p><ol class="prac">${HINT.cmds.map(c=>`<li><code>${esc(c)}</code></li>`).join("")}</ol>${PRAC[HINT.mod+"."+HINT.li]?`<button class="chip s" data-sbact="prac">✅ Cek Praktik</button>`:""}<div id="pracres" role="status"></div></div>`:""}
 <div class="sbx"><section class="pan"><p class="lbl">Network Topology</p><div id="sbtopo">${liveTopo(k)}</div>${topoLegend()}</section>
 <section class="pan"><div class="lbl-row"><p class="lbl">${SB.dev==="linux"?"Linux Filesystem Simulator":"Cisco CLI"}</p><div class="tools"><button class="chip s" data-sbact="clear">Clear</button><button class="chip s" data-sbact="copy">Copy</button><button class="chip s" data-sbact="reset">Reset</button></div></div>
 <div class="term" id="term"><div id="tout"></div><label class="tin"><span id="tp"></span><input id="tcmd" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" aria-label="Command"></label></div>
 <div class="seg" style="margin-top:10px">${(SB.dev==="linux"?LXCHIPS:SB.dev==="switch"?SWCHIPS:CHIPS).map(c=>`<button class="chip" data-sb="${esc(c)}">${esc(c)}</button>`).join("")}<button class="chip" data-sbact="help">? Help</button></div>
 <p class="hint muted">Tab: autocomplete · ↑ ↓: history · Ping succeeds when the target is on a connected network or has a valid route.</p>
 <div class="pan flat cmdex" id="cmdex" ${LASTEX?"":"hidden"}>${LASTEX?exHtml(LASTEX):""}</div>
 <div class="pan flat pktdiag" id="pktdiag" hidden></div></section></div>
 <div class="statusbar" id="sbstat"></div>`;
 sbDraw();
}
document.addEventListener("keydown",e=>{
 if(e.target.id!=="tcmd")return;
 const i=e.target;
 if(e.key==="Enter"){
  const v=i.value;SB.lines.push(sbPrompt()+" "+v);
  if(v.trim().toLowerCase()==="clear")SB.lines=[];else{const o=sbRun(v);SB.lines.push(...o);showExplain(v,o)}
  touchDay();
  if(v.trim())SB.hist.push(v);
  SB.hi=SB.hist.length;i.value="";sbSave();sbDraw();
 }else if(e.key==="ArrowUp"){e.preventDefault();if(SB.hi>0)i.value=SB.hist[--SB.hi]||""}
 else if(e.key==="ArrowDown"){e.preventDefault();if(SB.hi<SB.hist.length-1)i.value=SB.hist[++SB.hi];else{SB.hi=SB.hist.length;i.value=""}}
 else if(e.key==="Tab"){e.preventDefault();sbComplete(i)}
});
document.addEventListener("click",e=>{
 const t=e.target.closest("[data-sb],[data-sbact]");
 if(t){
  if(t.dataset.sbact==="reset"){sbReset();sbSave();return renderSandbox()}
  if(t.dataset.sbact==="useex"){const i=$("#tcmd");if(i&&LASTEX){i.value=LASTEX.ex.split("\n")[0].replace(/^\S+[#>]\s*/,"");i.focus();toast("Contoh dipakai di input. Tekan Enter untuk menjalankan.")}return}
  if(t.dataset.sbact==="prac")return pracCheck();
  if(t.dataset.sbact==="backlesson"){openModule(HINT.mod);setLesson(HINT.li);return renderModule()}
  if(t.dataset.sbact==="hintx"){HINT.cmds=null;return renderSandbox()}
  if(t.dataset.sbact==="clear"){SB.lines=[];return sbDraw()}
  if(t.dataset.sbact==="copy"){copyText(SB.lines.join("\n")).then(ok=>toast(ok?"Terminal copied":"Copy failed"));return}
  if(t.dataset.sbact==="help"){SB.lines.push(sbPrompt()+" ?",...(SB.dev==="linux"?LXHELP:SB.dev==="switch"?HELPSW:HELP));return sbDraw()}
  if(t.dataset.sbact.slice(0,4)==="dev-"){useDevice(t.dataset.sbact.slice(4));sbSave();return renderSandbox()}
  const i=$("#tcmd");i.value=t.dataset.sb;i.focus();return;
 }
 if(e.target.closest("#term")&&!getSelection().toString())$("#tcmd").focus();
});
const pk=o=>({host:o.host,mode:o.mode,cur:o.cur,curV:o.curV,routes:o.routes,ifs:o.ifs,vlans:o.vlans,seen:o.seen,secret:o.secret,banner:o.banner,con:o.con,saved:o.saved,startup:o.startup,nattab:o.nattab,dhcpb:o.dhcpb,user:o.user,net:o.net,installed:o.installed,full:o.full,dhcp:o.dhcp,curP:o.curP,nat:o.nat,acls:o.acls,rp:o.rp,os:o.os,ei:o.ei,proto:o.proto,fs:o.fs,cwd:o.cwd,users:o.users});
const sbSave=()=>store.set("sb2",{rt:pk(RT),sw:pk(SW),lx:pk(LX),dev:SB.dev});
sbInit(RT,"router");sbInit(SW,"switch");lxInit(LX);
{const old=store.get("sb",null),sv=store.get("sb2",null);
 if(old)Object.assign(RT,old);
 if(sv){Object.assign(RT,sv.rt);Object.assign(SW,sv.sw);if(sv.lx)Object.assign(LX,sv.lx);useDevice(sv.dev)}}

export {sbComplete, sbDraw, pracCheck, eduErr, showExplain, sbStatus, renderSandbox, CMDLIST, LASTEX, CMDEX, PRAC, pipeHtml, KNOWN, CMDX2, exHtml, errHtml, HINT, pk, sbSave};
