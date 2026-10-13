import {toast, xpPop, store, S, $, esc} from "../core.js";
import {go} from "../main.js";
import {useDevice, lxInit, LX, mkdirNode, mkfileNode} from "../sim/engine.js";
import {isIp, validMask, maskLen, netOf, sameNet} from "../sim/net.js";
import {sbSave} from "./sandbox.js";

const PRESETS={"Minimal Server":{cpu:1,ram:1,disk:10,net:"dhcp",parts:[["/boot",0.5],["swap",1],["/",8.5]]},"Network Server":{cpu:2,ram:2,disk:20,net:"static",parts:[["/boot",0.5],["swap",2],["/",10],["/home",7.5]]},"Custom":{cpu:1,ram:1,disk:20,net:"dhcp",parts:[["/boot",0.5],["swap",2],["/",10]]}};
const ISTEPS=["Boot","Language","Keyboard","Network","Hostname","User","Partition","Bootloader","Review"];
const IWHY=["Tahap boot memuat installer dari media (ISO/USB). Tanpa boot yang berhasil, instalasi tidak bisa dimulai.","Bahasa menentukan teks installer dan sistem. Ini tidak mengubah cara kerja Linux.","Keyboard layout menentukan karakter yang diketik. Salah layout membuat password sulit diketik.","Jaringan diperlukan agar server bisa berkomunikasi. IP = alamat, mask = batas jaringan, gateway = pintu keluar, DNS = penerjemah nama domain.","Hostname adalah nama perangkat di jaringan supaya mudah dikenali.","User dan password dibuat agar tidak selalu memakai root. Password harus cukup kuat.","Partisi membagi storage: / untuk sistem, swap sebagai memori tambahan, /boot untuk file boot, /home untuk data pengguna.","GRUB adalah bootloader yang memulai sistem operasi saat komputer menyala. Tanpa GRUB sistem mungkin tidak bisa boot.","Periksa semua pengaturan sebelum menginstal, karena memperbaikinya setelah instalasi lebih merepotkan."];
const iDef=()=>({step:0,phase:"wizard",sbOn:true,done:false,loggedIn:false,xpGiven:false,d:{distro:"Debian",preset:"Network Server",lang:"Bahasa Indonesia",kb:"US",sbScenario:false,disk:20,net:{mode:"static",ip:"192.168.1.10",mask:"255.255.255.0",gw:"192.168.1.1",dns:"8.8.8.8"},host:"",full:"",user:"",pw:"",pw2:"",parts:PRESETS["Network Server"].parts.map(([mp,gb])=>({mp,gb})),grub:true}});
let INST=(()=>{const s=store.get("inst",null),d=iDef();return s?{...d,...s,d:{...d.d,...(s.d||{}),net:{...d.d.net,...((s.d||{}).net||{})}}}:d})();
const saveInst=()=>store.set("inst",INST);
const IU={e:null,err:null,hint:0,why:false,guide:false,conf:false,prog:0,boot:[],timer:null,running:false,gain:false,loginErr:""};
const iReset=()=>{IU.hint=0;IU.why=false;IU.guide=false;IU.conf=false;IU.err=null;IU.e=null};
function iValidate(st){
 const d=INST.d,n=d.net,E=(t,m,w)=>({t,m,w});
 if(st===3&&n.mode==="static"){
  if(!isIp(n.ip))return E("Invalid IP address","Alamat IP '"+n.ip+"' tidak valid. Contoh: 192.168.1.10","IP harus 4 bagian angka 0-255 agar perangkat bisa dikenali di jaringan.");
  if(!validMask(n.mask))return E("Invalid subnet mask","Subnet mask '"+n.mask+"' tidak valid. Contoh: 255.255.255.0","Mask harus berupa deretan bit 1 lalu bit 0. Mask menentukan bagian network dan host.");
  if(!isIp(n.gw))return E("Invalid gateway","Gateway '"+n.gw+"' tidak valid. Contoh: 192.168.1.1","Gateway adalah alamat router sebagai pintu keluar jaringan.");
  if(n.gw===n.ip||!sameNet(n.ip,n.gw,n.mask))return E("Gateway di luar subnet","Gateway "+n.gw+" tidak berada di jaringan "+netOf(n.ip,n.mask)+"/"+maskLen(n.mask)+".","Gateway harus satu subnet dengan server, kalau tidak paket tidak bisa dikirim ke gateway.");
  if(!isIp(n.dns))return E("Invalid DNS","Alamat DNS '"+n.dns+"' tidak valid. Contoh: 8.8.8.8","DNS menerjemahkan nama domain menjadi IP. Tanpa DNS valid, nama website tidak bisa dibuka.");
 }
 if(st===4&&!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(d.host))return E(d.host?"Invalid hostname":"Hostname missing",d.host?"Hostname hanya boleh huruf, angka, dan tanda minus (tanpa spasi).":"Hostname wajib diisi. Contoh: debian-server","Hostname dipakai sebagai nama perangkat. Karakter khusus bisa menimbulkan masalah di jaringan.");
 if(st===5){
  if(!/^[a-z_][a-z0-9_-]{0,31}$/.test(d.user)||d.user==="root")return E("Invalid username","Username diawali huruf kecil, hanya huruf kecil/angka/_/-, dan bukan root.","Linux membedakan huruf besar-kecil, dan root sudah dipakai sistem.");
  if(d.pw.length<8||!/[A-Za-z]/.test(d.pw)||!/\d/.test(d.pw))return E("Weak password","Password minimal 8 karakter dan mengandung huruf serta angka.","Password lemah mudah ditebak. Ini simulasi, jadi jangan memakai password aslimu.");
  if(d.pw!==d.pw2)return E("Password tidak sama","Konfirmasi password berbeda dari password.","Konfirmasi mencegah salah ketik yang bisa mengunci kamu dari sistem.");
 }
 if(st===6){
  const p=d.parts,sum=p.reduce((a,x)=>a+(+x.gb||0),0);
  if(p.some(x=>!(+x.gb>0)))return E("Invalid partition size","Ukuran partisi harus lebih dari 0 GB (tidak boleh negatif).","Partisi berukuran 0 atau negatif tidak mungkin dibuat.");
  if(!p.some(x=>x.mp==="/"))return E("Root partition missing","Installation cannot continue. Root partition (/) is required.","Partisi / berisi sistem Linux. Tanpa itu tidak ada tempat memasang sistem.");
  const mps=p.filter(x=>x.mp!=="swap").map(x=>x.mp);
  if(new Set(mps).size!==mps.length)return E("Mount point ganda","Satu mount point hanya boleh dipakai satu partisi.","Satu direktori tidak bisa dipasang dari dua partisi sekaligus.");
  if(sum>d.disk+1e-9)return E("Disk full","Total partisi "+sum.toFixed(1)+" GB melebihi kapasitas disk "+d.disk+" GB.","Kapasitas disk terbatas. Kurangi ukuran partisi.");
 }
 return null;
}
const iCheck=()=>[["Language",true],["Keyboard",true],["Network",!iValidate(3)],["Hostname",!iValidate(4)],["User & password",!iValidate(5)],["Partition",!iValidate(6)],["Bootloader",true]];
const fld=(l,f,v,t="text",ex="")=>`<label class="fld">${l}<input class="inp" data-f="${f}" type="${t}" value="${esc(v)}" autocomplete="off" ${ex}></label>`;
const isel=(l,f,v,o)=>`<label class="fld">${l}<select class="inp" data-f="${f}">${o.map(x=>`<option${x===v?" selected":""}>${esc(x)}</option>`).join("")}</select></label>`;
function iBody(st){
 const d=INST.d,n=d.net;
 if(st===0){const pr=PRESETS[d.preset];return `<p class="lbl">Distribusi</p><div class="seg"><button class="chip" aria-pressed="true">Debian</button><button class="chip" disabled>Ubuntu (segera)</button><button class="chip" disabled>Linux Mint (segera)</button></div><p class="muted" style="font-size:.85rem">Semua ini simulasi di browser, tidak ada yang diinstal ke komputermu. Saat ini hanya alur Debian yang tersedia.</p>${isel("Preset","preset",d.preset,Object.keys(PRESETS))}<div class="lc-meta"><div><span>CPU</span><b>${pr.cpu} core</b></div><div><span>RAM</span><b>${pr.ram} GB</b></div><div><span>Disk</span><b>${d.disk} GB</b></div></div>${d.preset==="Custom"?fld("Ukuran disk (GB)","disk",d.disk,"number",'min="5" max="200"'):""}<label class="chk"><input type="checkbox" data-f="sbScenario" ${d.sbScenario?"checked":""}> Skenario belajar: Lenovo ThinkPad dengan Secure Boot aktif</label>`}
 if(st===1)return isel("Bahasa","lang",d.lang,["Bahasa Indonesia","English"]);
 if(st===2)return isel("Keyboard layout","kb",d.kb,["US","Indonesia (US layout)","UK"]);
 if(st===3)return isel("Konfigurasi jaringan","net.mode",n.mode,["dhcp","static"])+(n.mode==="static"?fld("IP Address","net.ip",n.ip)+fld("Subnet Mask","net.mask",n.mask)+fld("Gateway","net.gw",n.gw)+fld("DNS","net.dns",n.dns):'<p class="muted">DHCP: alamat IP diberikan otomatis oleh server DHCP (simulasi: 192.168.1.100/24).</p>');
 if(st===4)return fld("Hostname","host",d.host,"text",'placeholder="debian-server"');
 if(st===5)return fld("Nama lengkap","full",d.full)+fld("Username","user",d.user,"text",'placeholder="pino"')+fld("Password","pw",d.pw,"password")+fld("Konfirmasi password","pw2",d.pw2,"password")+'<p class="muted" style="font-size:.82rem">Ini simulasi. Jangan memakai password aslimu.</p>';
 if(st===6){const used=d.parts.reduce((a,x)=>a+(+x.gb||0),0),pc=Math.max(0,Math.min(100,used/d.disk*100));return `<div class="xpbar" role="progressbar" aria-label="Penggunaan disk" aria-valuenow="${Math.round(pc)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pc}%;${used>d.disk?"background:var(--bad)":""}"></i></div><p class="muted" style="margin:6px 0 10px;font-size:.85rem">Terpakai ${used.toFixed(1)} / ${d.disk} GB · sisa ${(d.disk-used).toFixed(1)} GB</p>${d.parts.map((p,i)=>`<div class="part-row"><label class="fld">Mount<select class="inp" data-f="parts.${i}.mp">${["/boot","swap","/","/home","/var"].map(m=>`<option${m===p.mp?" selected":""}>${m}</option>`).join("")}</select></label><label class="fld">GB<input class="inp" data-f="parts.${i}.gb" type="number" step="0.5" value="${p.gb}"></label><button class="chip s" data-in="delpart" data-v="${i}" aria-label="Hapus partisi ${i+1}">Hapus</button></div>`).join("")}<button class="chip" data-in="addpart">+ Tambah partisi</button>`}
 if(st===7)return `<div class="seg"><button class="chip" data-in="grub" data-v="1" aria-pressed="${d.grub}">Install GRUB</button><button class="chip" data-in="grub" data-v="0" aria-pressed="${!d.grub}">Skip GRUB</button></div>${d.grub?"":'<div class="fb no"><b>⚠ Warning:</b> The system may not boot without a bootloader.</div>'}`;
 const ck=iCheck(),ok=ck.every(x=>x[1]);
 return `<ul class="chk-list">${ck.map(x=>`<li class="${x[1]?"ok":"no"}">${x[1]?"✓":"✗"} ${x[0]}</li>`).join("")}</ul>${ok?"":'<div class="fb no"><b>⚠ Installation requirements incomplete</b></div>'}<div class="lc-meta"><div><span>Hostname</span><b>${esc(d.host||"-")}</b></div><div><span>User</span><b>${esc(d.user||"-")}</b></div><div><span>Network</span><b>${n.mode==="dhcp"?"DHCP":esc(n.ip)+"/"+(validMask(n.mask)?maskLen(n.mask):"?")}</b></div><div><span>GRUB</span><b>${d.grub?"Ya":"Tidak"}</b></div></div>`;
}
const ICASES={
 sb:{title:"Instalasi gagal",problem:"Secure Boot aktif sehingga installer tidak bisa dijalankan.",meta:[["Device","Lenovo ThinkPad"],["Stage","Boot installer"],["Error","Secure Boot is enabled"]],why:"Secure Boot hanya mengizinkan bootloader bertanda tangan tepercaya. Pada skenario lab ini media installer tidak dianggap tepercaya, sehingga boot ditolak. (Pada praktik nyata, distro modern seperti Debian biasanya mendukung Secure Boot lewat shim. Skenario ini sengaja disederhanakan.)",checks:["Apakah pesan error menyebut Secure Boot?","Apakah Secure Boot di BIOS/UEFI berstatus Enabled?","Apakah media installer sudah dipilih sebagai boot device?"],hints:["Pesan error menyebut Secure Boot. Cari pengaturan boot di BIOS/UEFI.","Restart laptop dan masuk BIOS/UEFI (pada banyak ThinkPad: Enter lalu F1), buka Security → Secure Boot.","Ubah Secure Boot menjadi Disabled (sesuai skenario lab), simpan dengan Save & Exit, lalu boot installer lagi."],guide:["Restart laptop.","Masuk BIOS/UEFI.","Buka menu Security.","Buka Secure Boot.","Periksa status Secure Boot.","Jika diperlukan oleh skenario lab, ubah menjadi Disabled.","Simpan perubahan (Save & Exit).","Boot kembali ke installer.","Coba instalasi lagi."],note:"Menu BIOS dapat berbeda tergantung model ThinkPad.",confused:"Secure Boot seperti satpam yang hanya mengizinkan tamu dengan kartu pengenal resmi. Installer di skenario ini tidak punya kartu itu, jadi ditolak sampai satpamnya dimatikan sementara.",learned:"Secure Boot memeriksa tanda tangan bootloader sebelum menjalankannya, dan pengaturan UEFI memengaruhi apakah installer bisa boot."},
 grub:{title:"Sistem tidak bisa boot",problem:"No bootable device. Bootloader (GRUB) tidak terpasang.",meta:[["Stage","Reboot pertama"],["Error","No bootable device found"],["Penyebab","GRUB di-skip saat instalasi"]],why:"GRUB adalah program pertama yang memuat kernel Linux. Tanpa GRUB, komputer tidak tahu cara memulai sistem operasi.",checks:["Apakah GRUB dipasang saat instalasi?","Apakah disk instalasi menjadi boot device?"],hints:["Periksa kembali pilihan Bootloader pada instalasi.","Boot dari media installer, pilih Rescue mode, lalu pasang ulang GRUB.","Klik 'Pasang GRUB (rescue)' lalu coba reboot lagi."],guide:["Boot dari media installer.","Pilih Advanced options → Rescue mode.","Pilih partisi root.","Jalankan Reinstall GRUB.","Reboot."],note:"Langkah ini disederhanakan untuk simulasi.",confused:"GRUB seperti petunjuk di pintu masuk gedung yang memberi tahu mesin mana yang dinyalakan pertama. Tanpa petunjuk itu tidak ada yang tahu harus mulai dari mana.",learned:"GRUB memuat kernel Linux saat komputer menyala."}};
function learnCard(k,extra){
 const c=ICASES[k];
 return `<div class="pan lcard"><div class="lc-head"><span aria-hidden="true">❌</span><div><b>${c.title}</b><p style="margin:2px 0 0">${c.problem}</p></div></div><div class="lc-meta">${c.meta.map(m=>`<div><span>${m[0]}</span><b>${m[1]}</b></div>`).join("")}</div>
 ${IU.why?`<div class="tipbox"><b>🔎 Kenapa bisa terjadi?</b> ${c.why}</div>`:""}
 <p class="lbl sp">🧠 Yang perlu dicek</p><ul class="chk-list">${c.checks.map(x=>`<li>☐ ${x}</li>`).join("")}</ul>
 ${IU.hint?`<div class="tipbox" role="status"><b>💡 Hint ${IU.hint}/3</b><ol class="prac">${c.hints.slice(0,IU.hint).map(x=>`<li>${x}</li>`).join("")}</ol></div>`:""}
 ${IU.conf?`<div class="tipbox" role="status"><b>🤔 Analogi:</b> ${c.confused}</div>`:""}
 ${IU.guide?`<p class="lbl sp">🛠 Cara memperbaiki</p><ol class="prac">${c.guide.map(x=>`<li>${x}</li>`).join("")}</ol><p class="muted" style="font-size:.85rem">${c.note}</p>${extra||""}`:""}
 <div class="seg" style="margin-top:12px"><button class="chip" data-in="why">Kenapa Bisa Terjadi?</button><button class="chip" data-in="guide">Lihat Panduan</button><button class="chip" data-in="hint">💡 Hint${IU.hint?" ("+IU.hint+"/3)":""}</button><button class="chip" data-in="conf">🤔 Saya masih bingung</button><button class="act" style="width:auto" data-in="retry">🧪 Coba Lagi</button></div>${IU.err?`<div class="fb no" role="status"><b>${IU.err}</b></div>`:""}</div>`;
}
const iStage=()=>IU.prog<60?"Installing base system... "+IU.prog+"%":IU.prog<85?"Installing packages... "+IU.prog+"%":(INST.d.grub?"Installing bootloader... ":"Skipping bootloader... ")+IU.prog+"%";
function startInstall(){
 INST.phase="installing";IU.prog=0;IU.running=true;saveInst();renderInstall();
 clearInterval(IU.timer);
 IU.timer=setInterval(()=>{
  IU.prog=Math.min(100,IU.prog+4);
  const el=$("#iprog"),tx=$("#itxt");if(el)el.style.width=IU.prog+"%";if(tx)tx.textContent=iStage();
  if(IU.prog>=100){clearInterval(IU.timer);IU.running=false;INST.phase="done";saveInst();if(S.page==="install")renderInstall()}
 },110);
}
function startBoot(){
 INST.phase="booting";IU.boot=[];saveInst();renderInstall();
 const d=INST.d,L=d.grub?["GRUB: Loading Debian GNU/Linux...","Loading Linux kernel 6.1.0-simulated...","Loading initial ramdisk...","[ OK ] Mounted / (root partition)","[ OK ] Started Network service ("+(d.net.mode==="dhcp"?"DHCP":d.net.ip)+")","[ OK ] Reached target Multi-User System."]:["BIOS: searching for boot device...","error: no bootable device found."];
 L.forEach((l,i)=>setTimeout(()=>{
  if(INST.phase!=="booting")return;
  IU.boot.push(l);const b=$("#bootlog");if(b)b.innerHTML=IU.boot.map(x=>`<div class="tl">${esc(x)}</div>`).join("");
  if(i===L.length-1)setTimeout(()=>{if(INST.phase!=="booting")return;INST.phase=d.grub?"login":"trouble:grub";iReset();saveInst();if(S.page==="install")renderInstall()},450);
 },i*300));
}
function lxApplyInstall(d){
 lxInit(LX);
 LX.fs.k.home.k[d.user]=mkdirNode(0o755,d.user);LX.fs.k.etc.k.hostname=mkfileNode();
 Object.assign(LX,{host:d.host,user:d.user,full:d.full,users:["root",d.user],cwd:"/home/"+d.user,installed:true,net:d.net.mode==="dhcp"?{mode:"dhcp",ip:"192.168.1.100",mask:"255.255.255.0",gw:"192.168.1.1",dns:"192.168.1.1"}:{...d.net},lines:["Debian GNU/Linux (simulasi). Selamat datang, "+(d.full||d.user)+".","Linux Filesystem Simulator. Ketik help untuk daftar perintah."]});
 sbSave();
}
function renderInstall(){
 const v=$("#view"),ph=INST.phase,d=INST.d,st=INST.step;
 const head=`<div class="sb-head"><div><p class="crumb2">NETLAB / LINUX INSTALL</p><h1 class="pg" style="margin:2px 0 0">Linux Installation Lab</h1></div><span class="devbadge">Debian · simulasi</span></div><p class="muted" style="margin:6px 0 12px;max-width:72ch">Simulasi proses instalasi Linux di browser. Tidak ada yang diinstal ke komputermu. Hasilnya (hostname, user, IP) dipakai oleh Linux Filesystem Simulator.</p>`;
 const foot=`<p style="margin-top:14px"><button class="chip s" data-in="reset">Reset Installation</button></p>`;
 if(ph==="installing"&&!IU.running)return startInstall();
 let body="";
 if(ph==="wizard"){
  const e=IU.e,ck=INST.step===8?iCheck().every(x=>x[1]):true;
  body=`<ol class="isteps" aria-label="Langkah instalasi">${ISTEPS.map((s,i)=>`<li class="${i<st?"done":i===st?"cur":""}">${i<st?"✓ ":""}${s}</li>`).join("")}</ol><div class="ilayout"><div class="pan"><p class="lbl">Langkah ${st+1} dari ${ISTEPS.length} · ${ISTEPS[st]}</p>${iBody(st)}${e?`<div class="fb no" role="status"><b>✗ ${e.t}</b><p>${e.m}</p><p><b>Kenapa:</b> ${e.w}</p></div>`:""}<div class="seg" style="margin-top:14px">${st>0?`<button class="act alt" style="width:auto" data-in="back">← Back</button>`:""}${st<8?`<button class="act" style="width:auto" data-in="next">${st===0?"Boot Installer →":"Next →"}</button>`:`<button class="act" style="width:auto" data-in="install" ${ck?"":"disabled"}>Install</button>`}</div></div><div class="pan"><p class="lbl">Kenapa ini diperlukan?</p><p style="margin:0">${IWHY[st]}</p></div></div>`;
 }else if(ph==="trouble:sb"){
  const bios=`<div class="bios"><b>BIOS/UEFI (simulasi)</b><p class="muted" style="margin:4px 0">Security › Secure Boot</p><select id="sbsel" class="inp" style="max-width:200px"><option${INST.sbOn?" selected":""}>Enabled</option><option${INST.sbOn?"":" selected"}>Disabled</option></select> <button class="chip s" data-in="biossave">Save & Exit</button></div>`;
  body=learnCard("sb",bios);
 }else if(ph==="trouble:grub")body=learnCard("grub",`<button class="chip" data-in="rescue">Pasang GRUB (rescue)</button>`);
 else if(ph==="installing")body=`<div class="pan"><p class="lbl">Installing</p><p id="itxt" style="margin:0 0 8px">${iStage()}</p><div class="xpbar" role="progressbar" aria-label="Progres instalasi" aria-valuemin="0" aria-valuemax="100"><i id="iprog" style="width:${IU.prog}%"></i></div></div>`;
 else if(ph==="done")body=`<div class="pan celeb"><div class="cel-ico" aria-hidden="true">✅</div><h2 class="h2">Installation Complete</h2><p class="muted">Remove installation media and reboot.</p><button class="act" style="width:auto" data-in="reboot">Reboot</button></div>`;
 else if(ph==="booting")body=`<div class="pan"><p class="lbl">Booting</p><div class="bootlog" id="bootlog">${IU.boot.map(x=>`<div class="tl">${esc(x)}</div>`).join("")}</div></div>`;
 else if(ph==="login")body=`<div class="pan"><p class="lbl">Login</p><div class="bootlog">Debian GNU/Linux (simulasi) ${esc(d.host)} tty1</div><label class="fld">${esc(d.host)} login<input class="inp" id="lg-u" autocomplete="off" autocapitalize="off" spellcheck="false"></label><label class="fld">Password<input class="inp" id="lg-p" type="password" autocomplete="off"></label>${IU.loginErr?`<div class="fb no" role="status"><b>Login incorrect.</b> ${IU.loginErr}</div>`:""}<button class="act" style="width:auto;margin-top:12px" data-in="login">Login</button></div>`;
 else body=`<div class="pan celeb"><div class="cel-ico" aria-hidden="true">🏆</div><h2 class="h2">First Linux Install</h2><p class="reward">${IU.gain?"+100 XP":"XP instalasi sudah pernah diberikan"}</p><div class="lc-meta"><div><span>Hostname</span><b>${esc(d.host)}</b></div><div><span>User</span><b>${esc(d.user)}</b></div><div><span>IP</span><b>${d.net.mode==="dhcp"?"192.168.1.100 (DHCP)":esc(d.net.ip)}</b></div></div><p class="lbl sp">Apa yang dipelajari</p><ul class="learned"><li>✓ Tahap instalasi: boot, jaringan, partisi, bootloader</li><li>✓ Fungsi hostname, user, dan password</li><li>✓ Kenapa root dan GRUB diperlukan</li></ul><p class="muted">Coba di simulator: whoami, hostname, pwd, ls, ip addr</p><div class="seg" style="justify-content:center"><button class="act" style="width:auto" data-in="open">Buka Linux Simulator →</button></div></div>`;
 v.innerHTML=head+body+foot;
 const c=$("#crumb");if(c)c.innerHTML="NETLAB / <b>Linux Install</b>";
}
document.addEventListener("click",e=>{
 const t=e.target.closest("[data-in]");if(!t)return;
 const a=t.dataset.in,v=t.dataset.v,d=INST.d;
 if(a==="reset"){if(t.dataset.arm){INST=Object.assign(iDef(),{xpGiven:INST.xpGiven});saveInst();iReset();IU.running=false;clearInterval(IU.timer);if(LX.installed){lxInit(LX);sbSave()}toast("Installation Lab di-reset. Progres lain tidak berubah.");return renderInstall()}t.dataset.arm="1";t.textContent="Yakin? Ketuk lagi untuk reset";return}
 if(a==="next"){const er=iValidate(INST.step);IU.e=er;if(er)return renderInstall();if(INST.step===0&&d.sbScenario&&INST.sbOn){INST.phase="trouble:sb";iReset();saveInst();return renderInstall()}INST.step++;saveInst();return renderInstall()}
 if(a==="back"){INST.step=Math.max(0,INST.step-1);IU.e=null;saveInst();return renderInstall()}
 if(a==="addpart"){d.parts.push({mp:"/home",gb:1});saveInst();return renderInstall()}
 if(a==="delpart"){d.parts.splice(+v,1);saveInst();return renderInstall()}
 if(a==="grub"){d.grub=v==="1";saveInst();return renderInstall()}
 if(a==="install"){const er=[3,4,5,6].map(iValidate).find(Boolean);if(er){IU.e=er;return renderInstall()}return startInstall()}
 if(a==="reboot")return startBoot();
 if(a==="why"){IU.why=!IU.why;return renderInstall()}
 if(a==="guide"){IU.guide=!IU.guide;return renderInstall()}
 if(a==="conf"){IU.conf=!IU.conf;return renderInstall()}
 if(a==="hint"){IU.hint=Math.min(IU.hint+1,3);return renderInstall()}
 if(a==="biossave"){INST.sbOn=$("#sbsel").value==="Enabled";saveInst();return toast("BIOS: Secure Boot = "+$("#sbsel").value)}
 if(a==="rescue"){d.grub=true;saveInst();return toast("GRUB terpasang lewat rescue mode.")}
 if(a==="retry"){
  if(INST.phase==="trouble:sb"){if(INST.sbOn){IU.err="Secure Boot masih Enabled sehingga installer tidak bisa boot. Cek pengaturan BIOS lalu coba lagi.";return renderInstall()}INST.phase="wizard";INST.step=1;iReset();saveInst();toast("Installer berhasil boot. Dipelajari: "+ICASES.sb.learned);return renderInstall()}
  if(!d.grub){IU.err="GRUB masih belum terpasang. Gunakan 'Pasang GRUB (rescue)' lebih dulu.";return renderInstall()}
  iReset();return startBoot();
 }
 if(a==="login"){
  const u=$("#lg-u").value.trim(),p=$("#lg-p").value;
  if(u!==d.user||p!==d.pw){IU.loginErr="Gunakan username dan password yang kamu buat saat instalasi.";return renderInstall()}
  IU.loginErr="";IU.gain=!INST.xpGiven;
  if(IU.gain){INST.xpGiven=true;S.xp+=100;store.set("xp",S.xp);xpPop(100)}
  INST.done=true;INST.loggedIn=true;INST.phase="complete";saveInst();lxApplyInstall(d);return renderInstall();
 }
 if(a==="open"){useDevice("linux");go("sandbox")}
});
document.addEventListener("input",e=>{
 const f=e.target.dataset&&e.target.dataset.f;if(!f)return;
 const ks=f.split(".");let o=INST.d;for(let i=0;i<ks.length-1;i++)o=o[ks[i]];
 const k=ks[ks.length-1];
 o[k]=e.target.type==="checkbox"?e.target.checked:(k==="gb"||k==="disk")?parseFloat(e.target.value):e.target.value;
 if(f==="preset"){const p=PRESETS[o[k]],dd=INST.d;dd.disk=p.disk;dd.net.mode=p.net;dd.parts=p.parts.map(([mp,gb])=>({mp,gb}))}
 saveInst();
 if(f==="preset"||f==="net.mode"||k==="mp")renderInstall();
});

export {iValidate, iBody, learnCard, startInstall, startBoot, lxApplyInstall, renderInstall, PRESETS, ISTEPS, IWHY, iDef, INST, saveInst, IU, iReset, iCheck, fld, isel, ICASES, iStage};
