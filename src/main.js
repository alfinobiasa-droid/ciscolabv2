import "./pwa.js";
import "./style.css";
import {PAGES, store, S, $} from "./core.js";
import {renderModules, renderList} from "./pages/home.js";
import {renderQuiz, Q, L} from "./pages/quiz.js";
import {renderSandbox} from "./pages/sandbox.js";
import {renderQuest} from "./pages/quest.js";
import {renderTrouble} from "./pages/trouble.js";
import {openModule, renderModule, MD} from "./pages/lesson.js";
import {renderSubnet} from "./pages/subnet.js";
import {renderCheat, renderKamus} from "./pages/reference.js";
import {renderSearch} from "./pages/search.js";
import {renderMenu} from "./pages/settings.js";
import {renderDashboard} from "./pages/dashboard.js";
import {renderInstall} from "./pages/install.js";
import {renderBuilder} from "./pages/builder.js";

function renderSoon(p){
 $("#view").innerHTML=`<div class="soon"><div class="big">${p.i}</div><h2 style="margin:8px 0">${p.t}</h2><p style="color:var(--mute);max-width:46ch;margin:0 auto 18px">${p.d}</p><span class="tag o">Hadir di fase berikutnya</span></div>`;
}
const ORDER=["dashboard","modul","sandbox","builder","install","trouble","kuis","quest","subnet","cheat","kamus"];
const LBL={dashboard:["Home","Dashboard"],install:["Install","Linux Install"],builder:["Topology","Topology Builder"],modul:["Modul","Modules"],sandbox:["Sandbox","Sandbox"],trouble:["Trouble","Troubleshoot"],kuis:["Kuis","Quiz"],quest:["Quest","Quest"],subnet:["Subnet","Subnet Calc"],cheat:["Cheat","Cheat Sheet"],kamus:["Kamus","Dictionary"]};
const ICONS={"builder":"<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"5\" cy=\"6\" r=\"2.5\"/><circle cx=\"19\" cy=\"6\" r=\"2.5\"/><circle cx=\"12\" cy=\"18\" r=\"2.5\"/><path d=\"M7.5 6h9M6.5 8l4 8M17.5 8l-4 8\"/></svg>","install":"<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 3v12M7 10l5 5 5-5M4 20h16\"/></svg>","dashboard":"<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"9\" rx=\"1\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"5\" rx=\"1\"/><rect x=\"14\" y=\"12\" width=\"7\" height=\"9\" rx=\"1\"/><rect x=\"3\" y=\"16\" width=\"7\" height=\"5\" rx=\"1\"/></svg>","modul":"<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z\"/><path d=\"M8 4v13\"/></svg>","sandbox":"<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M7 9l3 3-3 3M13 15h4\"/></svg>","trouble":"<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 3l9 16H3z\"/><path d=\"M12 10v4M12 17h.01\"/></svg>","kuis":"<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M8 12l3 3 5-6\"/></svg>","quest":"<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"4.5\"/><circle cx=\"12\" cy=\"12\" r=\"1\"/></svg>","subnet":"<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"2\"/><path d=\"M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2\"/></svg>","cheat":"<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M5 6h14M5 12h14M5 18h9\"/></svg>","kamus":"<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M3 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H3zM21 5h-7a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h7z\"/></svg>"};
const LOGO="<span class=\"mark\"><svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2.2\" stroke-linecap=\"round\"><circle cx=\"12\" cy=\"5\" r=\"2.5\"/><circle cx=\"5\" cy=\"19\" r=\"2.5\"/><circle cx=\"19\" cy=\"19\" r=\"2.5\"/><path d=\"M12 7.5v4M12 11.5l-5.5 5.5M12 11.5l5.5 5.5\"/></svg></span>";

function renderNav(){
 $("#nav").innerHTML='<button class="brand logo" id="logo2" aria-label="NETLAB home">'+LOGO+'<span><b>NETLAB</b><small>Cisco Networking Lab</small></span></button>'+ORDER.map(k=>(k==="subnet"?'<div class="nav-sep">TOOLS</div>':"")+'<button data-go="'+k+'" title="Buka '+LBL[k][1]+'" aria-label="Buka '+LBL[k][1]+'" '+(k===S.page?'aria-current="page"':'')+'><span class="ico">'+ICONS[k]+'</span><span class="s">'+LBL[k][0]+'</span><span class="l">'+LBL[k][1]+'</span></button>').join("");
}

function render(){
 if(!PAGES.some(x=>x.k===S.page)&&S.page!=="cari"&&S.page!=="menu")S.page="dashboard";
 renderNav();
 {const vw=$("#view");vw.classList.remove("pgin");void vw.offsetWidth;vw.classList.add("pgin");vw.focus({preventScroll:true});clearTimeout(render.t);render.t=setTimeout(()=>vw.classList.remove("pgin"),700)}
 {const L=LBL[S.page]||["",S.page==="cari"?"Search":S.page==="menu"?"Profile":"NETLAB"],cb=$("#crumb");if(cb)cb.innerHTML="NETLAB / <b>"+L[1]+"</b>"}
 const p=PAGES.find(x=>x.k===S.page)||PAGES[0];
 if(p.k==="kuis"&&Q.run&&Q.run.i>=Q.run.items.length)Q.run=null;
 S.page==="cari"?renderSearch():S.page==="menu"?renderMenu():p.k==="builder"?renderBuilder():p.k==="install"?renderInstall():p.k==="dashboard"?renderDashboard():p.k==="modul"?(MD.id?renderModule():renderModules()):p.k==="kuis"?renderQuiz():p.k==="sandbox"?renderSandbox():p.k==="quest"?renderQuest():p.k==="trouble"?renderTrouble():p.k==="subnet"?renderSubnet():p.k==="cheat"?renderCheat():p.k==="kamus"?renderKamus():renderSoon(p);
 window.scrollTo(0,0);
}

function go(k){if(k==="modul")MD.id=null;S.page=k;if(location.hash.slice(1)!==k)history.pushState(null,"","#"+k);render()}

document.addEventListener("click",e=>{
 const t=e.target.closest("[data-go],[data-cat],[data-start],#clr,#sbtn,#logo,#logo2,#theme");if(!t)return;
 if(t.dataset.go)return go(t.dataset.go);
 if(t.id==="logo"||t.id==="logo2")return go("dashboard");
 if(t.id==="sbtn"){go("cari");return setTimeout(()=>$("#gq")?.focus(),50)}
 if(t.id==="theme"){const r=document.documentElement;r.dataset.theme=r.dataset.theme==="light"?"dark":"light";return store.set("theme",r.dataset.theme)}
 if(t.dataset.cat){S.cat=t.dataset.cat;document.querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed",c.dataset.cat===S.cat));return renderList()}
 if(t.id==="clr"){S.q="";$("#q").value="";$("#q").focus();return renderList()}
 if(t.dataset.start)return openModule(+t.dataset.start);
});
document.addEventListener("input",e=>{if(e.target.id==="q"){S.q=e.target.value;renderList()}});
const th=store.get("theme",null);if(th)document.documentElement.dataset.theme=th;const tt=store.get("terminal_theme","default");if(tt!=="default")document.documentElement.dataset.terminal=tt;
render();

export {renderSoon, renderNav, render, go, ORDER, LBL, ICONS, LOGO, th};
