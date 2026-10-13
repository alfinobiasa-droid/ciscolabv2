

const CATS=["Semua","Dasar Cisco","Switching & VLAN","Routing","Subnetting","Layanan","Keamanan","Linux","Troubleshooting"];

const PAGES=[
{k:"dashboard",i:"🏠",t:"Home"},{k:"install",i:"💿",t:"Install"},{k:"builder",i:"🧩",t:"Topology"},{k:"modul",i:"📚",t:"Modul"},{k:"trouble",i:"🔧",t:"Trouble",d:"Kasus troubleshooting: cari penyebab PC1 tidak bisa ping PC2."},
{k:"sandbox",i:"💻",t:"Sandbox",d:"Simulator CLI Cisco: enable, configure terminal, interface, ip address."},
{k:"quest",i:"🎯",t:"Quest",d:"Misi konfigurasi dengan hadiah XP."},{k:"kuis",i:"🏆",t:"Kuis",d:"Bank soal 100+ dengan soal acak dan skor."},
{k:"cheat",i:"📋",t:"Cheat",d:"Daftar command dengan tombol salin."},{k:"kamus",i:"📖",t:"Kamus",d:"Istilah jaringan: VLAN, OSPF, CIDR, NAT, dan lainnya."},
{k:"subnet",i:"🧮",t:"Subnet",d:"Kalkulator subnet dan konversi CIDR ↔ subnet mask."}
];

const store={
 get(k,f){try{const v=localStorage.getItem("netlab:"+k);return v?JSON.parse(v):f}catch(e){return f}},
 set(k,v){try{localStorage.setItem("netlab:"+k,JSON.stringify(v))}catch(e){}}
};
const LEVELS=[[0,"Network Rookie"],[100,"Network Learner"],[300,"Network Technician"],[600,"Network Specialist"],[1000,"Network Engineer"]];
const levelOf=xp=>{let n=0;LEVELS.forEach((l,i)=>{if(xp>=l[0])n=i});return{n:n+1,name:LEVELS[n][1]}};

const S={cat:"Semua",q:"",page:location.hash.slice(1)||"dashboard",progress:store.get("progress",{}),xp:store.get("xp",0),streak:store.get("streak",0)};
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const hl=(t,q)=>{t=esc(t);if(!q)return t;const r=new RegExp("("+q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","ig");return t.replace(r,"<mark>$1</mark>")};

function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,2600)}
function copyText(value){
 const text=String(value);
 try{
  const write=navigator.clipboard&&navigator.clipboard.writeText;
  if(typeof write==="function"){
   const result=write.call(navigator.clipboard,text);
   if(result&&typeof result.then==="function")return result.then(()=>true,()=>copyFallback(text));
  }
 }catch(e){}
 return Promise.resolve(copyFallback(text));
}
function copyFallback(text){
 const area=document.createElement("textarea");area.value=text;area.setAttribute("readonly","");area.style.cssText="position:fixed;left:-9999px;top:0;opacity:0";document.body.appendChild(area);area.select();let ok=false;try{ok=document.execCommand("copy")}catch(e){}area.remove();return ok;
}
const DQ=[
 {id:"ip",t:"Configure an IP address",xp:20,ev:"ip",n:1},
 {id:"vlan",t:"Create a VLAN",xp:30,ev:"vlan",n:1},
 {id:"trouble",t:"Solve a troubleshooting case",xp:40,ev:"trouble",n:1},
 {id:"quiz",t:"Answer 5 quiz questions correctly",xp:30,ev:"quiz_ok",n:5},
 {id:"lesson",t:"Complete a lesson step",xp:20,ev:"lesson",n:1},
 {id:"route",t:"Check the routing table",xp:20,ev:"route",n:1}];
const today=()=>{const d=new Date();return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate())};
const pad2=n=>String(n).padStart(2,"0");
function touchDay(){const d=today(),s=store.get("days",{last:null,n:0});if(s.last===d)return;const prev=new Date();prev.setDate(prev.getDate()-1);const y=prev.getFullYear()+"-"+pad2(prev.getMonth()+1)+"-"+pad2(prev.getDate());s.n=s.last===y?s.n+1:1;s.last=d;store.set("days",s)}
function dayStreak(){const s=store.get("days",{last:null,n:0});return s.last&&Date.parse(today())-Date.parse(s.last)<=864e5?s.n:0}
const dailyState=()=>{const d=store.get("daily",null);return d&&d.date===today()?d:{date:today(),cnt:{},done:{}}};
const dailyList=()=>{const k=Math.floor(Date.parse(today())/864e5)%DQ.length;return[0,1,2].map(i=>DQ[(k+i)%DQ.length])};
let dqMute=false;
const quietly=f=>{dqMute=true;try{return f()}finally{dqMute=false}};
function xpPop(n){touchDay();const el=document.createElement("div");el.className="xpop";el.textContent="+"+n+" XP";document.body.appendChild(el);setTimeout(()=>el.remove(),1200)}
function dailyEvent(ev,by=1){
 if(dqMute)return;
 const d=dailyState();d.cnt[ev]=(d.cnt[ev]||0)+by;
 {const A=store.get("ach",{});A[ev]=(A[ev]||0)+by;store.set("ach",A)}
 dailyList().forEach(q=>{if(q.ev===ev&&!d.done[q.id]&&d.cnt[ev]>=q.n){d.done[q.id]=true;S.xp+=q.xp;store.set("xp",S.xp);xpPop(q.xp);toast("Daily quest complete: "+q.t+" (+"+q.xp+" XP)")}});
 store.set("daily",d);
}
const levelInfo=xp=>{let i=0;LEVELS.forEach((l,k)=>{if(xp>=l[0])i=k});const cur=LEVELS[i][0],nx=LEVELS[i+1];return{n:i+1,name:LEVELS[i][1],next:nx?nx[0]:null,nextName:nx?nx[1]:null,pct:nx?Math.round((xp-cur)/(nx[0]-cur)*100):100}};

export {toast, copyText, touchDay, dayStreak, xpPop, dailyEvent, CATS, PAGES, store, LEVELS, levelOf, S, $, esc, hl, DQ, today, pad2, dailyState, dailyList, dqMute, quietly, levelInfo};
