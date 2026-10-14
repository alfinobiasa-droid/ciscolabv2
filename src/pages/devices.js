import {devices, acknowledge} from "../data/ops.js";
import {esc, $, toast} from "../core.js";
import {go} from "../main.js";

let state={q:"",status:"all",selected:null};
const dot=d=>`<span class="ops-dot ${d.status}" aria-label="${d.status}"></span>`;
function renderDevices(){
 const all=devices(), q=state.q.toLowerCase();
 const rows=all.filter(d=>(state.status==="all"||d.status===state.status)&&(!q||[d.name,d.type,d.site,d.ip].join(" ").toLowerCase().includes(q)));
 const sel=all.find(d=>d.id===state.selected);
 $("#view").innerHTML=`<div class="ops-head"><div><p class="lbl">Operations / Inventory</p><h1 class="pg">Devices</h1><p class="muted">Monitor perangkat dari topology lab atau data demo lokal.</p></div><button class="act" style="width:auto;margin:0" data-go="builder">Open topology →</button></div>
 <section class="pan ops-filter"><input class="inp" id="devq" value="${esc(state.q)}" placeholder="Search devices, IP, site…" aria-label="Search devices"><div class="seg">${["all","online","warning","offline"].map(s=>`<button class="chip s" data-status="${s}" aria-pressed="${state.status===s}">${s==="all"?"All":s[0].toUpperCase()+s.slice(1)}</button>`).join("")}</div></section>
 <div class="ops-layout"><section class="pan ops-table"><div class="lbl-row"><p class="lbl">${rows.length} devices</p><span class="muted">Local inventory</span></div><div class="device-list">${rows.length?rows.map(d=>`<button class="device-row ${d.id===state.selected?"selected":""}" data-device="${d.id}"><span>${dot(d)}<span><b>${esc(d.name)}</b><small>${esc(d.type)} · ${esc(d.site)}</small></span></span><span><b>${d.ip}</b><small>${d.interfaces} ports · ${d.latency===null?"—":d.latency+" ms"}</small></span></button>`).join(""):"<p class=\"muted\">No devices match this filter.</p>"}</div></section>${sel?detail(sel):`<section class="pan ops-empty"><div class="big">⌁</div><h2 class="h2">Select a device</h2><p class="muted">Pilih perangkat untuk melihat health, interface, dan quick actions.</p></section>`}</div>`;
}
function detail(d){return `<section class="pan ops-detail"><div class="lbl-row"><p class="lbl">Device detail</p><button class="chip s" data-close>× Close</button></div><div class="device-title">${dot(d)}<div><h2 class="h2">${esc(d.name)}</h2><p class="muted">${esc(d.type)} · ${esc(d.site)}</p></div></div><div class="detail-grid"><div><span>STATUS</span><b>${d.status}</b></div><div><span>IP ADDRESS</span><b>${d.ip}</b></div><div><span>UPTIME</span><b>${d.uptime}</b></div><div><span>LATENCY</span><b>${d.latency===null?"—":d.latency+" ms"}</b></div></div><p class="lbl sp">Quick actions</p><div class="seg"><button class="act" style="width:auto" data-open="${d.id}">Open in Sandbox</button><button class="chip s" data-ack="${d.id}">Acknowledge alerts</button></div><p class="muted" style="font-size:.82rem;margin-bottom:0">Prototype action: perubahan hanya disimpan di browser.</p></section>`}
document.addEventListener("input",e=>{if(e.target.id==="devq"){state.q=e.target.value;renderDevices()}});
document.addEventListener("click",e=>{const d=e.target.closest("[data-device]");if(d){state.selected=d.dataset.device;renderDevices();return}const s=e.target.closest("[data-status]");if(s){state.status=s.dataset.status;renderDevices();return}if(e.target.closest("[data-close]")){state.selected=null;renderDevices();return}const a=e.target.closest("[data-ack]");if(a){acknowledge(a.dataset.ack);toast("Alert acknowledged");renderDevices();return}const o=e.target.closest("[data-open]");if(o){go("sandbox")}});
export {renderDevices};
