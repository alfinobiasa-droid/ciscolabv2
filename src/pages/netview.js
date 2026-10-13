import {S, $, esc} from "../core.js";
import {render, go} from "../main.js";
import {useDevice, RT, SW, LX} from "../sim/engine.js";
import {renderSandbox} from "./sandbox.js";
import {MD} from "./lesson.js";
import {devAt} from "../components/device-icons.js";

const SCOL={ok:"#22C55E",warn:"#F59E0B",off:"#64748B",bad:"#EF4444"},SNAME={ok:"Online",warn:"Warning",off:"Offline",bad:"Error"};
function devStatus(o,k){
 const ifs=Object.values(o.ifs||{});
 if(k==="rt"){const ip=ifs.filter(i=>i.ip);return ip.some(i=>i.up)?(ip.some(i=>!i.up)?"warn":"ok"):"off"}
 if(k==="sw")return Object.keys(o.vlans||{}).length>1||ifs.some(p=>p.mode==="trunk"||p.vlan!==1)?"ok":"off";
 return "ok";
}
function devInfo(k){
 const o=k==="rt"?RT:k==="sw"?SW:LX,ifs=Object.values(o.ifs||{}),up=ifs.filter(i=>i.up).length;
 const ip=k==="rt"?((ifs.find(i=>i.ip)||{}).ip||"no IP"):k==="sw"?"VLANs "+Object.keys(o.vlans).length:"users "+o.users.length;
 return{name:k==="srv"?"SRV1":o.host,ip,st:devStatus(o,k),ifc:k==="srv"?"eth0":up+"/"+ifs.length+" up"};
}
const nodeShape=(t,x,y)=>devAt({rt:"router",sw:"switch",srv:"server",cloud:"cloud",pc:"pc"}[t]||"pc",x,y+6,.7);
const topoLegend=()=>`<div class="legend">${[["ok","Online"],["warn","Warning"],["off","Offline"],["bad","Error"]].map(x=>`<span><i style="background:${SCOL[x[0]]}"></i>${x[1]}</span>`).join("")}</div>`;
function liveTopo(sel){
 const I={rt:devInfo("rt"),sw:devInfo("sw"),srv:devInfo("srv")};
 const g0=(RT.ifs||{})["GigabitEthernet0/0"]||{},g1=(RT.ifs||{})["GigabitEthernet0/1"]||{};
 const ls=i=>i.ip?(i.up?"ok":"bad"):"off",lt=(n,i)=>n+" "+(i.ip?(i.up?"UP":"DOWN"):"—");
 const live=(k,t,x,y)=>{const d=I[k];return `<g class="node-g ${d.st}${sel===k?" sel":""}" data-node="${k}" data-tip="${esc([d.name,"IP: "+d.ip,"Status: "+SNAME[d.st],"Interface: "+d.ifc].join("|"))}" tabindex="0" role="button" aria-label="${esc(d.name)} ${SNAME[d.st]}"><circle class="halo" cx="${x}" cy="${y}" r="30"/>${nodeShape(t,x,y)}<circle cx="${x+24}" cy="${y-18}" r="5" fill="${SCOL[d.st]}" stroke="var(--card)" stroke-width="1.5"/><text x="${x}" y="${y+40}">${esc(d.name)}</text><text class="sub" x="${x}" y="${y+52}">${esc(d.ip)}</text></g>`};
 const dec=(t,x,y,label,st)=>`<g class="node-g dec">${nodeShape(t,x,y)}<circle cx="${x+22}" cy="${y-16}" r="4" fill="${SCOL[st]}" stroke="var(--card)" stroke-width="1.5"/><text x="${x}" y="${y+34}">${label}</text></g>`;
 const ln=(a,b,st,lab)=>`<line class="${st}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`+(lab?`<text class="lk ${st}" x="${(a[0]+b[0])/2+8}" y="${(a[1]+b[1])/2-2}">${lab}</text>`:"");
 const N={net:[310,24],rt:[310,92],sw:[170,172],srv:[450,172],p1:[100,240],p2:[240,240]},onR=I.rt.st==="ok"||I.rt.st==="warn",onS=I.sw.st==="ok";
 return `<svg class="node-svg" viewBox="0 0 620 285" role="group" aria-label="Network topology">${ln(N.net,N.rt,onR?"ok":"off")}${ln(N.rt,N.sw,ls(g0),lt("Gi0/0",g0))}${ln(N.rt,N.srv,ls(g1),lt("Gi0/1",g1))}${ln(N.sw,N.p1,onS?"ok":"off")}${ln(N.sw,N.p2,onS?"ok":"off")}${dec("cloud",...N.net,"Internet",onR?"ok":"off")}${live("rt","rt",...N.rt)}${live("sw","sw",...N.sw)}${live("srv","srv",...N.srv)}${dec("pc",...N.p1,"PC1",onS?"ok":"off")}${dec("pc",...N.p2,"PC2",onS?"ok":"off")}</svg><p class="ntopo-cap">Hover a device for details. Click it to open it in the Sandbox. Link labels show interface status (UP/DOWN).</p>`;
}
const ntip=()=>{let t=document.getElementById("ntip");if(!t){t=document.createElement("div");t.id="ntip";t.className="ntip";t.hidden=true;document.body.appendChild(t)}return t};
document.addEventListener("mouseover",e=>{
 const n=e.target.closest&&e.target.closest("[data-node]"),t=ntip();
 if(!n){t.hidden=true;return}
 t.innerHTML=n.dataset.tip.split("|").map((x,i)=>i?"<div>"+esc(x)+"</div>":"<b>"+esc(x)+"</b>").join("");
 t.hidden=false;const r=n.getBoundingClientRect();t.style.left=Math.max(8,Math.min(r.left,innerWidth-200))+"px";t.style.top=(r.bottom+6)+"px";
});
function openNode(n){const d={rt:"router",sw:"switch",srv:"linux"}[n.dataset.node];useDevice(d);if(S.page==="sandbox")renderSandbox();else go("sandbox")}
document.addEventListener("click",e=>{const n=e.target.closest("[data-node]");if(n)openNode(n)});
window.addEventListener("popstate",()=>{S.page=location.hash.slice(1)||"dashboard";if(S.page==="modul")MD.id=null;render()});
document.addEventListener("keydown",e=>{
 const n=e.target.closest&&e.target.closest("[data-node]");
 if(n&&(e.key==="Enter"||e.key===" ")){e.preventDefault();openNode(n);return}
 if(e.key==="/"&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();go("cari");setTimeout(()=>{const q=$("#gq");if(q)q.focus()},60)}
});

export {devStatus, devInfo, liveTopo, openNode, SCOL, SNAME, nodeShape, topoLegend, ntip};
