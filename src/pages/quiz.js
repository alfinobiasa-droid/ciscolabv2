import QUESTIONS from "../data/questions.json";
import {toast, xpPop, dailyEvent, store, S, $, esc, pad2} from "../core.js";
import {go} from "../main.js";
import {earned} from "./badges.js";

const QCATS=["Semua","Dasar Cisco","VLAN","Routing","OSPF","Subnetting","Layanan","Keamanan","Linux","Troubleshooting"];
const QS=store.get("qstats",{ans:0,ok:0,done:[]});
const Q={n:10,cat:"Semua",exam:false,sec:45,diff:"Semua",review:false,run:null};
const L="ABCD";
const pct=(a,b)=>b?Math.round(a/b*100):0;
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const adaptDiff=()=>{const v=Q.cat==="Semua"?[QS.ok,QS.ans]:((QS.cat||{})[Q.cat]||[0,0]);if(v[1]<3)return"Mudah";const a=v[0]/v[1];return a<.5?"Mudah":a<.75?"Sedang":"Sulit"};
const pool=()=>{const f=QUESTIONS.filter(q=>(Q.cat==="Semua"||q.category===Q.cat)&&(Q.diff==="Semua"||q.difficulty===(Q.diff==="Adaptive"?adaptDiff():Q.diff)));return Q.diff==="Adaptive"&&f.length<5?QUESTIONS.filter(q=>Q.cat==="Semua"||q.category===Q.cat):f};

function renderQuiz(){Q.run?(Q.run.i>=Q.run.items.length?quizResult():Q.run.exam?examQuestion():quizQuestion()):quizSetup()}
const bumpCat=(c,ok)=>{QS.cat=QS.cat||{};const e=QS.cat[c]=QS.cat[c]||[0,0];e[1]++;if(ok)e[0]++};
const fmt=s=>Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
function examQuestion(){
 const r=Q.run,it=r.items[r.i],q=it.q,tot=r.items.length,left=Math.max(0,Math.round((r.deadline-Date.now())/1000));
 $("#view").innerHTML=`<div class="qcard"><div class="qtop"><span>UJIAN · ${pad2(r.i+1)} / ${pad2(tot)}</span><span id="qtimer" style="font-weight:700">${fmt(left)}</span></div>
 <div class="bar" style="margin:10px 0 16px"><i style="width:${r.i/tot*100}%"></i></div>
 <h1 class="pg" style="margin:0;font-size:1.15rem;line-height:1.35">${esc(q.question)}</h1>${q.code?`<pre class="code">${esc(q.code)}</pre>`:""}
 ${it.order.map((oi,d)=>`<button class="opt${d===r.sel?" sel":""}" data-q="opt" data-v="${d}"><b>${L[d]}</b><span>${esc(q.options[oi])}</span></button>`).join("")}
 <button class="act" data-q="answer" ${r.sel==null?"disabled":""}>${r.i+1>=tot?"Selesai":"Simpan & Lanjut"}</button></div>`;
}
function examAnswer(){
 const r=Q.run;r.answers[r.i]=r.items[r.i].order[r.sel];r.i++;r.sel=null;
 if(r.i>=r.items.length)finishExam();
}
function finishExam(){
 const r=Q.run;if(r.finished)return;r.finished=true;
 r.i=r.items.length;r.ok=r.items.filter((it,i)=>r.answers[i]===it.q.answer).length;r.xp=r.ok*10;
 S.xp+=r.xp;if(r.ok)dailyEvent("quiz_ok",r.ok);QS.ans+=r.answers.filter(a=>a!=null).length;QS.ok+=r.ok;
 r.items.forEach((it,i)=>{if(r.answers[i]!=null){bumpCat(it.q.category,r.answers[i]===it.q.answer);if(!QS.done.includes(it.q.id))QS.done.push(it.q.id)}});
 store.set("qstats",QS);store.set("xp",S.xp);saveQuiz();
}
function examReview(r){
 const n=r.items.length,cats={},rows=[];
 r.items.forEach((it,i)=>{const c=it.q.category,a=r.answers[i],ok=a===it.q.answer;cats[c]=cats[c]||[0,0];cats[c][1]++;if(ok)cats[c][0]++;rows.push({it,a,ok})});
 const catRow=([c,v])=>{const p=Math.round(v[0]/v[1]*100);return `<div style="margin-top:8px;text-align:left"><div style="display:flex;justify-content:space-between"><span>${c}</span><b>${p}%</b></div><div class="bar"><i style="width:${p}%"></i></div></div>`};
 const rev=x=>`<div class="fb ${x.ok?"ok":"no"}" style="margin-top:8px;text-align:left"><b>${x.ok?"✓":"✗"} ${esc(x.it.q.question)}</b>${x.it.q.code?`<pre class="code">${esc(x.it.q.code)}</pre>`:""}<p>Your answer: ${x.a==null?"not answered":esc(x.it.q.options[x.a])}</p>${x.ok?"":`<p>Correct answer: <b>${esc(x.it.q.options[x.it.q.answer])}</b></p>`}<p>${esc(x.it.q.explanation)}</p></div>`;
 const list=rows.filter(x=>Q.review||!x.ok);
 return `<p style="margin:12px 0 0"><b>${r.ok} Correct</b> · ${n-r.ok} Wrong</p><div style="margin-top:12px"><b>Category Performance</b>${Object.entries(cats).map(catRow).join("")}</div><button class="act alt" data-q="review">${Q.review?"Hide review":"Review Answers"}</button><div>${list.length?list.map(rev).join(""):"<p>All answers correct!</p>"}</div>`;
}
setInterval(()=>{
 const r=Q.run;if(!r||!r.exam||r.finished)return;
 const left=Math.max(0,Math.round((r.deadline-Date.now())/1000)),el=document.getElementById("qtimer");
 if(el)el.textContent=fmt(left);
 if(left<=0){finishExam();if(S.page==="kuis")renderQuiz();toast("Waktu habis")}
},1000);

function quizSetup(){
 const p=pool().length;
 const st=[["Total Soal",QUESTIONS.length],["Terjawab",QS.ans],["Benar",QS.ok],["Akurasi",pct(QS.ok,QS.ans)+"%"],["Total XP",S.xp],["Correct streak",S.streak+"x"]];
 $("#view").innerHTML=`<h1 class="pg" style="margin:4px 0 12px">Quiz</h1>
 <div class="stats">${st.map(x=>`<div class="stat"><b>${x[1]}</b><span>${x[0]}</span></div>`).join("")}</div>
 <div class="qcard"><b>Mode</b><div class="seg" style="margin:8px 0 8px">${[["Latihan",false],["Ujian",true]].map(m=>`<button class="chip" data-q="mode" data-v="${m[1]}" aria-pressed="${Q.exam===m[1]}">${m[0]}</button>`).join("")}</div>${Q.exam?`<div class="seg" style="margin:0 0 8px">${[30,45,60].map(s=>`<button class="chip" data-q="sec" data-v="${s}" aria-pressed="${Q.sec===s}">${s} detik/soal</button>`).join("")}</div><p style="color:var(--mute);font-size:.9rem;margin:0 0 14px">Ujian: batas waktu ${Math.ceil(Math.min(Q.n,p)*Q.sec/60)} menit (${Q.sec} detik per soal), tanpa jawaban benar/salah sampai selesai, lalu ada pembahasan.</p>`:`<div style="height:8px"></div>`}<b>Jumlah soal</b><div class="seg" style="margin:8px 0 16px">${[10,20,50].map(n=>`<button class="chip" data-q="n" data-v="${n}" aria-pressed="${Q.n===n}">${n} Soal</button>`).join("")}</div>
 <b>Kategori</b><div class="seg" style="margin-top:8px">${QCATS.map(c=>`<button class="chip" data-q="cat" data-v="${c}" aria-pressed="${Q.cat===c}">${c}</button>`).join("")}</div>
 <b style="display:block;margin-top:14px">Tingkat</b><div class="seg" style="margin-top:8px">${["Semua","Mudah","Sedang","Sulit","Adaptive"].map(c=>`<button class="chip" data-q="diff" data-v="${c}" aria-pressed="${Q.diff===c}">${c}</button>`).join("")}</div><p style="color:var(--mute);font-size:.9rem">Tersedia ${p} soal di kategori ini${p<Q.n?`, jadi kuis berisi ${p} soal.`:"."}</p>
 <button class="act" data-q="start">Mulai Kuis</button></div>`;
}
function startQuiz(){
 const items=shuffle(pool().slice()).slice(0,Q.n).map(q=>({q,order:shuffle([0,1,2,3])}));
 Q.review=false;Q.run={items,i:0,ok:0,xp:0,sel:null,done:false,exam:Q.exam,answers:[],deadline:Date.now()+items.length*Q.sec*1000,finished:false};
}
function quizQuestion(){
 const r=Q.run,it=r.items[r.i],q=it.q,tot=r.items.length,good=r.done&&it.order[r.sel]===q.answer;
 const right=it.order.indexOf(q.answer);
 const fb=r.done?`<div role="status" class="fb ${good?"ok":"no"}"><b>${good?"✓ Jawaban benar! +10 XP":"✗ Jawaban salah."}</b>${good?"":`<p>Jawaban benar: <b>${L[right]}. ${esc(q.options[q.answer])}</b></p>`}<p>${esc(q.explanation)}</p></div>
 <button class="act" data-q="next">${r.i+1>=tot?"Lihat Hasil":"Soal Berikutnya"}</button>`
 :`<button class="act" data-q="answer" ${r.sel==null?"disabled":""}>Jawab</button>`;
 $("#view").innerHTML=`<div class="qcard"><div class="qtop"><span>KUIS · ${q.category} · ${q.difficulty}</span><span>${pad2(r.i+1)} / ${pad2(tot)}</span></div>
 <div class="bar" style="margin:10px 0 16px"><i style="width:${r.i/tot*100}%"></i></div>
 <h1 class="pg" style="margin:0;font-size:1.15rem;line-height:1.35">${esc(q.question)}</h1>${q.code?`<pre class="code">${esc(q.code)}</pre>`:""}
 ${it.order.map((oi,d)=>{const c=r.done?(oi===q.answer?" ok":d===r.sel?" no":""):(d===r.sel?" sel":"");return `<button class="opt${c}" data-q="opt" data-v="${d}" ${r.done?"disabled":""}><b>${L[d]}</b><span>${esc(q.options[oi])}</span></button>`}).join("")}${fb}</div>`;
}
function answerQuiz(){
 if(Q.run.exam)return examAnswer();
 const r=Q.run,it=r.items[r.i],ok=it.order[r.sel]===it.q.answer;
 r.answers[r.i]=it.order[r.sel];r.done=true;QS.ans++;bumpCat(it.q.category,ok);
 if(ok){QS.ok++;r.ok++;r.xp+=it.q.xp;S.xp+=it.q.xp;S.streak++;dailyEvent("quiz_ok");xpPop(it.q.xp)}else S.streak=0;
 if(!QS.done.includes(it.q.id))QS.done.push(it.q.id);
 store.set("qstats",QS);store.set("xp",S.xp);store.set("streak",S.streak);
}
function saveQuiz(){
 const h=store.get("quizHistory",[]);
 h.push({date:new Date().toISOString(),cat:Q.cat,score:Q.run.ok,total:Q.run.items.length,xp:Q.run.xp,exam:!!Q.run.exam});
 store.set("quizHistory",h.slice(-50));
}
function quizResult(){
 const r=Q.run,n=r.items.length;
 $("#view").innerHTML=`<div class="qcard" style="text-align:center"><p class="lbl">Score</p><h2 style="margin:0 0 4px">Quiz Complete</h2>
 <div class="score">${r.ok} / ${n}</div>
 <div class="stats" style="margin-top:16px"><div class="stat"><b>${pct(r.ok,n)}%</b><span>Accuracy</span></div><div class="stat"><b>+${r.xp} XP</b><span>XP earned</span></div><div class="stat"><b>${S.streak}</b><span>Correct streak</span></div></div>
 ${examReview(r)}<button class="act" data-q="again">Ulangi kuis</button><button class="act alt" data-q="new">Kuis baru</button><button class="act alt" data-go="modul">Kembali ke modul</button></div>`;
}
document.addEventListener("click",e=>{
 const t=e.target.closest("[data-q]");if(!t)return;
 const a=t.dataset.q,v=t.dataset.v,r=Q.run;
 if(a==="n")Q.n=+v;
 else if(a==="mode")Q.exam=v==="true";
 else if(a==="sec")Q.sec=+v;
 else if(a==="diff")Q.diff=v;
 else if(a==="review")Q.review=!Q.review;
 else if(a==="cat")Q.cat=v;
 else if(a==="start"||a==="again")startQuiz();
 else if(a==="new")Q.run=null;
 else if(a==="opt"&&r&&!r.done)r.sel=+v;
 else if(a==="answer"&&r&&r.sel!=null&&!r.done)answerQuiz();
 else if(a==="next"){r.i++;r.sel=null;r.done=false;if(r.i>=r.items.length)saveQuiz()}
 renderQuiz();
 window.scrollTo(0,0);
});

export {renderQuiz, examQuestion, examAnswer, finishExam, examReview, quizSetup, startQuiz, quizQuestion, answerQuiz, saveQuiz, quizResult, QCATS, QS, Q, L, pct, shuffle, adaptDiff, pool, bumpCat, fmt};
