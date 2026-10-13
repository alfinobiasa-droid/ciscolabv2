import MODULES from "../data/modules.json";
import {toast, dayStreak, store, levelOf, S, $, esc, copyText} from "../core.js";
import {SOUND} from "../sim/sound.js";
import {go} from "../main.js";
import {QS} from "./quiz.js";
import {progOf} from "./lesson.js";

const PFX="netlab:";
const allData=()=>{const o={};try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(PFX))o[k]=localStorage.getItem(k)}}catch(x){}return o};
function renderMenu(){
 const cats=Object.entries(QS.cat||{}).sort((a,b)=>a[0].localeCompare(b[0])),hist=store.get("quizHistory",[]).slice(-8).reverse(),lv=levelOf(S.xp),d=MODULES.filter(m=>progOf(m.id)===100).length,note=t=>'<p style="color:var(--mute);margin:6px 0 12px">'+esc(t)+'</p>';
 $("#view").innerHTML='<h1 class="pg" style="margin:4px 0 12px">Menu</h1>'
 +'<div class="qcard"><b>Progres kamu</b><div class="stats"><div class="stat"><b>'+S.xp+' XP</b><span>Level '+lv.n+' · '+lv.name+'</span></div><div class="stat"><b>🔥 '+dayStreak()+'</b><span>Day streak</span></div><div class="stat"><b>'+d+' / '+MODULES.length+'</b><span>Modul selesai</span></div></div><button class="act alt" data-st="theme">Ganti tema terang/gelap</button></div>'
 +'<div class="qcard" style="margin-top:14px"><b>Penguasaan per kategori</b>'+(cats.length?cats.map(([c,v])=>{const p=Math.round(v[0]/v[1]*100);return '<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;gap:8px"><span>'+esc(c)+'</span><b>'+p+'% ('+v[0]+'/'+v[1]+')</b></div><div class="bar"><i style="width:'+p+'%"></i></div></div>'}).join(''):note('Belum ada data. Kerjakan kuis dulu.'))+'</div>'
 +'<div class="qcard" style="margin-top:14px"><b>Terminal</b><p style="color:var(--mute);margin:6px 0 12px">Aktifkan suara tombol saat memakai simulator CLI.</p><button class="act alt" data-st="sound">${SOUND.enabled?"🔊 Suara aktif":"🔇 Suara nonaktif"}</button></div>'
+'<div class="qcard" style="margin-top:14px"><b>Riwayat kuis terakhir</b>'+(hist.length?hist.map(x=>'<div class="row" style="cursor:default"><span>'+new Date(x.date).toLocaleDateString('id-ID')+' · '+(x.exam?'Ujian':'Latihan')+' · '+esc(x.cat)+'</span><b>'+x.score+'/'+x.total+' (+'+x.xp+' XP)</b></div>').join(''):note('Belum ada riwayat.'))+'</div>'
+'<div class="qcard" style="margin-top:14px"><b>Cadangkan atau pindahkan progres</b>'+note('Ekspor menghasilkan teks yang bisa disalin. Tempel di perangkat lain lalu tekan Impor.')+'<textarea id="st-box" class="inp" rows="4" style="min-height:96px;padding:10px" aria-label="Data progres"></textarea><div style="display:flex;gap:10px"><button class="act" style="flex:1;width:auto" data-st="export">Ekspor</button><button class="act alt" style="flex:1;width:auto" data-st="import">Impor</button></div></div>'
 +'<div class="qcard" style="margin-top:14px"><b>Reset progres</b>'+note('Menghapus XP, streak, kuis, quest, dan progres modul di perangkat ini.')+'<button class="act" style="background:#d63c4f;margin-top:0" data-st="reset">Reset semua progres</button></div>';
}
document.addEventListener("click",e=>{
 const t=e.target.closest("#mbtn,[data-st]");if(!t)return;
 if(t.id==="mbtn")return go("menu");
 const a=t.dataset.st,box=$("#st-box"),manual=()=>toast("Salin teks di kotak secara manual");
 if(a==="theme")return $("#theme").click();
 if(a==="sound"){SOUND.toggle();return renderMenu()}
 if(a==="export"){box.value=JSON.stringify(allData());box.select();copyText(box.value).then(ok=>{if(ok)toast("Tersalin ke clipboard");else manual()});return}
 if(a==="import"){
  try{const o=JSON.parse(box.value),ks=Object.keys(o);if(!ks.length||ks.some(k=>!k.startsWith(PFX)||typeof o[k]!=="string"))throw 0;ks.forEach(k=>localStorage.setItem(k,o[k]));toast("Progres diimpor. Memuat ulang...");setTimeout(()=>location.reload(),600)}
  catch(x){toast("Teks tidak valid. Tempel hasil Ekspor.")}
  return;
 }
 if(a==="reset"){if(t.dataset.arm){try{Object.keys(allData()).forEach(k=>localStorage.removeItem(k))}catch(x){}location.reload();return}t.dataset.arm="1";t.textContent="Yakin? Ketuk lagi untuk menghapus"}
});

export {renderMenu, PFX, allData};
