import {store} from "../core.js";
import {NET, upLinks, ifUp} from "../sim/network.js";

const DEMO=[
 {id:"edge-r1",name:"EDGE-R1",type:"Router",site:"Jakarta HQ",ip:"10.10.0.1",status:"online",latency:12,uptime:"99.99%",interfaces:"8/8",alerts:0},
 {id:"core-sw1",name:"CORE-SW1",type:"Switch",site:"Jakarta HQ",ip:"10.10.0.10",status:"warning",latency:18,uptime:"99.92%",interfaces:"22/24",alerts:2},
 {id:"branch-r1",name:"BRANCH-R1",type:"Router",site:"Bandung",ip:"10.20.0.1",status:"online",latency:34,uptime:"99.97%",interfaces:"6/6",alerts:0},
 {id:"vpn-gw",name:"VPN-GW",type:"Gateway",site:"Surabaya",ip:"10.30.0.1",status:"offline",latency:null,uptime:"98.10%",interfaces:"0/4",alerts:1}
];
const statusOf=d=>d.status||"online";
function devices(){
 const live=NET.devs.map(d=>{const fs=Object.values(d.o.ifs||{}),up=fs.filter(f=>ifUp(d,Object.keys(d.o.ifs||{})[fs.indexOf(f)])).length;return{id:d.id,name:d.name,type:d.type,site:"Lab topology",ip:fs.find(f=>f.ip)?.ip||"No IP",status:up===fs.length&&up>0?"online":up?"warning":"offline",latency:up?Math.round(8+up*3):null,uptime:up?"100%":"—",interfaces:`${up}/${fs.length}`,alerts:up===fs.length?0:1}});
 return live.length?live:DEMO;
}
function alerts(){
 const ack=store.get("opsAck",{});return devices().flatMap(d=>d.alerts?[{id:d.id+"-alert",device:d.name,severity:d.status==="offline"?"critical":"warning",title:d.status==="offline"?"Device unreachable":"Interface health degraded",time:"Today",ack:!!ack[d.id]}]:[]);
}
function summary(){const ds=devices(),as=alerts();return{devices:ds,alerts:as,activeAlerts:as.filter(a=>!a.ack).length,online:ds.filter(d=>d.status==="online").length,warning:ds.filter(d=>d.status==="warning").length,offline:ds.filter(d=>d.status==="offline").length,links:upLinks().length};}
function acknowledge(id){const a=store.get("opsAck",{});a[id]=true;store.set("opsAck",a)}
export {devices,alerts,summary,acknowledge,statusOf};
