import {S, store} from "../core.js";
import {NET, upLinks, ifUp} from "../sim/network.js";
import {summary} from "../data/ops.js";

const cap=(value,n)=>String(value||"").slice(0,n);
function context(){
 const ops=summary();
 const devices=ops.devices.map(d=>({name:d.name,type:d.type,status:d.status,ip:d.ip,site:d.site,latency:d.latency,interfaces:d.interfaces}));
 const topology=NET.devs.slice(0,30).map(d=>({name:d.name,type:d.type,interfaces:Object.entries(d.o.ifs||{}).slice(0,32).map(([name,f])=>({name,up:ifUp(d,name),ip:f.ip||null,mask:f.mask||null}))}));
 const links=NET.links.slice(0,60).map(l=>{const a=NET.devs.find(d=>d.id===l.a.d),b=NET.devs.find(d=>d.id===l.b.d);return{source:a?.name||l.a.d,target:b?.name||l.b.d,sourceInterface:l.a.i,targetInterface:l.b.i,status:a&&b&&ifUp(a,l.a.i)&&ifUp(b,l.b.i)?"up":"down"}});
 return {page:S.page,devices,alerts:ops.activeAlerts,linksUp:upLinks().length,links,topology,learning:{xp:S.xp,level:store.get("level",null)}};
}
function history(){return store.get("copilotChat",[])}
export {context,history};
