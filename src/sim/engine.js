import {dailyEvent, S, $} from "../core.js";
import {isIp, ip2n, n2ip, validMask, maskLen, netOf, sameNet, pad} from "./net.js";

const RT={},SW={},LX={};let SB=RT;
function useDevice(d){SB=d==="switch"?SW:d==="linux"?LX:RT}
function withDevice(o,f){const p=SB;SB=o;try{return f()}finally{SB=p}}
const netHooks={active:false};
const mkdirNode=(m=0o755,w="root")=>({t:"d",m,o:w,g:w,k:{}});
const mkfileNode=(m=0o644,w="root")=>({t:"f",m,o:w,g:w,k:{}});
function lxInit(o){
 const fs=mkdirNode();
 ["bin","boot","dev","etc","home","opt","root","srv","tmp","usr","var"].forEach(n=>fs.k[n]=mkdirNode());
 fs.k.root.m=0o700;fs.k.tmp.m=0o777;
 fs.k.etc.k.network=mkdirNode();fs.k.etc.k.network.k.interfaces=mkfileNode();
 fs.k.etc.k.apt=mkdirNode();fs.k.etc.k.apt.k["sources.list"]=mkfileNode();
 Object.assign(o,{dev:"linux",host:"debian",user:"root",net:null,installed:false,full:"",mode:"sh",cwd:"/root",users:["root"],fs,hist:[],hi:0,seen:{},lines:["Linux Filesystem Simulator (bukan Debian penuh). Ketik help untuk daftar perintah."]});
}
const LXHELP=["Perintah yang didukung (Linux):","  pwd, cd, ls [-l], mkdir [-p], touch, cat","  cp [-r], mv, rm [-r|-rf], rmdir","  chmod <755|u+x>, chown <user[:grup]>, useradd [-m], passwd, whoami, clear"];
const LXCHIPS=["pwd","cd /home","ls -l","mkdir kebun_binatang","cd kebun_binatang","mkdir karnivora herbivora","touch herbivora/kuda","chmod 676 herbivora/kuda","useradd sandikta_jaya","chown sandikta_jaya herbivora","cp -r karnivora /opt","mv karnivora /tmp","rm -r /tmp/karnivora"];
const lxPrompt=()=>{const u=LX.user||"root",home=u==="root"?"/root":"/home/"+u;return u+"@"+(LX.host||"debian")+":"+(LX.cwd===home?"~":LX.cwd)+(u==="root"?"#":"$")};
const lxIp=()=>{const n=LX.net||{mode:"static",ip:"10.0.2.15",mask:"255.255.255.0",gw:"10.0.2.2",dns:"10.0.2.3"};return["1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536","    inet 127.0.0.1/8 scope host lo","2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500","    inet "+n.ip+"/"+maskLen(n.mask)+" brd "+n2ip(((ip2n(n.ip)|~ip2n(n.mask))>>>0))+" scope global eth0","    gateway "+n.gw+"  dns "+n.dns+"  ("+(n.mode==="dhcp"?"DHCP":"static")+")"]};
const lxParts=p=>{const b=p[0]==="/"?[]:LX.cwd.split("/").filter(Boolean);p.split("/").forEach(s=>{if(s==="..")b.pop();else if(s&&s!==".")b.push(s)});return b};
const lxAt=(o,p)=>p.split("/").filter(Boolean).reduce((n,s)=>n&&n.t==="d"?n.k[s]:null,o.fs);
const lxNode=parts=>parts.reduce((n,s)=>n&&n.t==="d"?n.k[s]:null,LX.fs);
const lxModeStr=n=>(n.t==="d"?"d":"-")+[6,3,0].map(s=>["r","w","x"].map((c,i)=>(n.m>>s)&(4>>i)?c:"-").join("")).join("");
function lxRun(line){
 const w=line.trim().split(/\s+/).filter(Boolean);if(!w.length)return[];
 const a=w.slice(1),F=a.filter(x=>/^-[a-zA-Z]+$/.test(x)).join(""),O=a.filter(x=>!/^-[a-zA-Z]+$/.test(x)),fl=c=>F.includes(c);
 const split=p=>{const q=lxParts(p);return[lxNode(q.slice(0,-1)),q[q.length-1]]};
 const nf=(cmd,p)=>cmd+": cannot access '"+p+"': No such file or directory";
 switch(w[0]){
  case"pwd":return["/"+LX.cwd.split("/").filter(Boolean).join("/")];
  case"whoami":return[LX.user||"root"];
  case"hostname":return[LX.host||"debian"];
  case"ip":return /^a(ddr)?$/.test(O[0]||"")?lxIp():["Usage: ip addr"];
  case"help":return LXHELP;
  case"passwd":return["passwd: password updated successfully (simulasi)"];
  case"cd":{const q=lxParts(O[0]||(LX.user&&LX.user!=="root"?"/home/"+LX.user:"/root")),n=lxNode(q);if(!n)return["bash: cd: "+O[0]+": No such file or directory"];if(n.t!=="d")return["bash: cd: "+O[0]+": Not a directory"];LX.cwd="/"+q.join("/");return[]}
  case"cat":return O.map(p=>lxNode(lxParts(p))?"":"cat: "+p+": No such file or directory").filter(Boolean);
  case"ls":{
   const t=O.length?O:["."],out=[];
   for(const p of t){
    const n=lxNode(lxParts(p));
    if(!n){out.push(nf("ls",p));continue}
    const items=n.t==="d"?Object.entries(n.k).sort((x,y)=>x[0].localeCompare(y[0])):[[p.split("/").pop(),n]];
    if(t.length>1)out.push(p+":");
    if(fl("l"))items.forEach(([k,v])=>out.push(lxModeStr(v)+" "+(v.t==="d"?2:1)+" "+v.o+" "+v.g+" "+String(v.t==="d"?4096:0).padStart(5)+" Jan  1 00:00 "+k));
    else if(items.length)out.push(items.map(x=>x[0]).join("  "));
   }
   return out;
  }
  case"mkdir":{
   if(!O.length)return["mkdir: missing operand"];
   const out=[];
   O.forEach(p=>{
    const q=lxParts(p),bad=m=>{out.push("mkdir: cannot create directory '"+p+"': "+m);return null};
    let cur=LX.fs;
    for(let i=0;i<q.length&&cur;i++){
     const s=q[i],last=i===q.length-1,nx=cur.k[s];
     if(nx)cur=last&&!fl("p")?bad("File exists"):nx.t==="d"?nx:bad("Not a directory");
     else cur=last||fl("p")?(cur.k[s]=mkdirNode()):bad("No such file or directory");
    }
   });
   return out;
  }
  case"touch":return O.map(p=>{const[par,nm]=split(p);if(!par||par.t!=="d")return"touch: cannot touch '"+p+"': No such file or directory";if(!par.k[nm])par.k[nm]=mkfileNode();return""}).filter(Boolean);
  case"rm":return O.map(p=>{const[par,nm]=split(p),n=par&&par.k[nm];if(!n)return fl("f")?"":"rm: cannot remove '"+p+"': No such file or directory";if(n.t==="d"&&!fl("r")&&!fl("R"))return"rm: cannot remove '"+p+"': Is a directory";delete par.k[nm];return""}).filter(Boolean);
  case"rmdir":return O.map(p=>{const[par,nm]=split(p),n=par&&par.k[nm];if(!n)return"rmdir: failed to remove '"+p+"': No such file or directory";if(n.t!=="d")return"rmdir: failed to remove '"+p+"': Not a directory";if(Object.keys(n.k).length)return"rmdir: failed to remove '"+p+"': Directory not empty";delete par.k[nm];return""}).filter(Boolean);
  case"cp":case"mv":{
   if(O.length!==2)return[w[0]+": missing file operand"];
   const[sp,sn]=split(O[0]),src=sp&&sp.k[sn];
   if(!src)return[w[0]+": cannot stat '"+O[0]+"': No such file or directory"];
   if(w[0]==="cp"&&src.t==="d"&&!fl("r")&&!fl("R"))return["cp: -r not specified; omitting directory '"+O[0]+"'"];
   const dn=lxNode(lxParts(O[1]));let tp,tn;
   if(dn&&dn.t==="d"){tp=dn;tn=sn}else[tp,tn]=split(O[1]);
   if(!tp||tp.t!=="d")return[w[0]+": cannot create '"+O[1]+"': No such file or directory"];
   tp.k[tn]=w[0]==="cp"?JSON.parse(JSON.stringify(src)):src;
   if(w[0]==="mv"&&!(tp===sp&&tn===sn))delete sp.k[sn];
   return[];
  }
  case"chmod":{
   if(O.length<2)return["chmod: missing operand"];
   const md=O[0],out=[];
   O.slice(1).forEach(p=>{
    const n=lxNode(lxParts(p));
    if(!n){out.push(nf("chmod",p));return}
    if(/^[0-7]{3,4}$/.test(md)){n.m=parseInt(md.slice(-3),8);return}
    const m=md.match(/^([ugoa]*)([+\-=])([rwx]+)$/);
    if(!m){out.push("chmod: invalid mode: '"+md+"'");return}
    const who=m[1]===""||m[1].includes("a")?"ugo":m[1],bit={r:4,w:2,x:1};
    who.split("").forEach(u=>{const s={u:6,g:3,o:0}[u],b=[...m[3]].reduce((x,c)=>x|bit[c],0)<<s;n.m=m[2]==="+"?n.m|b:m[2]==="-"?n.m&~b:(n.m&~(7<<s))|b});
   });
   return out;
  }
  case"chown":{
   if(O.length<2)return["chown: missing operand"];
   const[ow,gr]=O[0].split(":");
   if(!LX.users.includes(ow))return["chown: invalid user: '"+O[0]+"'"];
   return O.slice(1).map(p=>{const n=lxNode(lxParts(p));if(!n)return nf("chown",p);n.o=ow;if(gr)n.g=gr;return""}).filter(Boolean);
  }
  case"useradd":{
   if(!O.length)return["Usage: useradd [options] LOGIN"];
   const u=O[O.length-1];
   if(LX.users.includes(u))return["useradd: user '"+u+"' already exists"];
   LX.users.push(u);if(fl("m"))LX.fs.k.home.k[u]=mkdirNode(0o755,u);
   return[];
  }
 }
 return["bash: "+w[0]+": command not found"];
}
const CHIPS=["enable","configure terminal","hostname R1","interface g0/0","ip address 192.168.1.1 255.255.255.0","no shutdown","exit","end","show ip interface brief","show ip route","ip route 0.0.0.0 0.0.0.0 192.168.1.254","ping 192.168.1.1","enable secret cisco123","line console 0","password konsol1","login","banner motd #Akses terbatas#","copy running-config startup-config","ip dhcp pool LAN1","network 192.168.1.0 255.255.255.0","default-router 192.168.1.1","ip nat inside","ip nat outside","access-list 10 deny 192.168.1.50","access-list 10 permit any","ip access-group 10 out","access-list 100 deny tcp any any eq 80","access-list 100 permit ip any any","ip access-group 100 in","simulate 192.168.1.10 10.0.0.5 tcp 80","simulate dhcp PC1","router rip","version 2","network 192.168.1.0","no auto-summary","router ospf 1","router-id 1.1.1.1","network 192.168.1.0 0.0.0.255 area 0","router eigrp 100","show ip protocols","show running-config"];
const HELP=["Command yang didukung:","  enable, disable, configure terminal, exit, end","  hostname <nama>, interface <g0/0>, ip address <ip> <mask>","  no shutdown, shutdown, ip route <net> <mask> <next-hop>","  show running-config, show ip interface brief, show ip route","  enable secret <pw>, banner motd #pesan#, line console 0, password <pw>, login","  copy running-config startup-config, no ip address","  ip dhcp excluded-address, ip dhcp pool, network, default-router, dns-server","  ip nat inside|outside, ip nat inside source list N interface X overload","  access-list N permit|deny <src>, ip access-group N in|out, show access-lists","  access-list 100 permit|deny <ip|icmp|tcp|udp> <src> <dst> [eq port] (extended)","  simulate <src> <dst> [icmp|tcp|udp] [port] | simulate dhcp <client>  (packet/DHCP trace, khusus simulator)","  router rip | ospf <n> | eigrp <n>, version 2, network ..., no auto-summary, router-id, show ip protocols","  ping <ip>, do <show ...>, clear"];

const conn=()=>Object.entries(SB.ifs).filter(([,v])=>v.up&&v.ip).map(([name,v])=>({name,ip:v.ip,mask:v.mask}));
const sbPrompt=()=>SB.dev==="linux"?lxPrompt():SB.host+({user:">",priv:"#",config:"(config)#",if:"(config-if)#",vlan:"(config-vlan)#",line:"(config-line)#",dhcp:"(dhcp-config)#",router:"(config-router)#"})[SB.mode];
const HELPSW=["Command yang didukung (Switch):","  enable, disable, configure terminal, exit, end, hostname <nama>","  vlan <id>, name <nama>, no vlan <id>","  interface <fa0/1 | g0/1>, shutdown, no shutdown","  switchport mode <access|trunk>, switchport access vlan <id>","  switchport trunk native vlan <id>, switchport trunk allowed vlan <daftar>","  show vlan brief, show interfaces trunk, show running-config","  enable secret <pw>, banner motd #pesan#, copy running-config startup-config","  do <show ...>, clear"];
const SWCHIPS=["enable","configure terminal","vlan 10","name Sales","vlan 20","interface fa0/1","switchport mode access","switchport access vlan 10","interface g0/1","switchport mode trunk","end","show vlan brief","show interfaces trunk"];
const short=n=>n.replace("FastEthernet","Fa").replace("GigabitEthernet","Gi");

function sbInit(o,dev){
 const sw=dev==="switch",ifc=()=>({ip:"",mask:"",up:false,nat:"",acl:{},helper:""}),port=()=>({up:true,mode:"access",vlan:1,native:1,allowed:"all"}),ifs={};
 if(sw)["FastEthernet0/1","FastEthernet0/2","FastEthernet0/3","FastEthernet0/4","GigabitEthernet0/1"].forEach(k=>ifs[k]=port());
 else["GigabitEthernet0/0","GigabitEthernet0/1"].forEach(k=>ifs[k]=ifc());
 Object.assign(o,{dev,host:sw?"Switch":"Router",mode:"user",cur:null,curV:null,routes:[],seen:{},hist:[],hi:0,vlans:{1:{name:"default"}},secret:"",banner:"",ssh:false,con:{pw:"",login:false},saved:false,startup:null,nattab:[],dhcpb:[],dhcp:{ex:[],pools:{}},curP:null,nat:[],acls:{},rp:{on:false,ver:1,nets:[],auto:true},os:{pid:"",rid:"",nets:[],pass:[]},ei:{as:"",nets:[],auto:true},proto:"",ifs,lines:[`${sw?"Switch":"Router"} simulator. Type ? for help.`]});
}
function sbReset(){SB.dev==="linux"?lxInit(SB):sbInit(SB,SB.dev)}
function swVlans(){
 const rows=Object.entries(SB.vlans).sort((a,b)=>a[0]-b[0]).map(([id,v])=>pad(id,5)+pad(v.name,33)+pad("active",10)+Object.entries(SB.ifs).filter(([,p])=>p.mode==="access"&&p.vlan==id).map(([k])=>short(k)).join(", "));
 return[pad("VLAN",5)+pad("Name",33)+pad("Status",10)+"Ports","---- -------------------------------- --------- -------------------------------",...rows];
}
function swTrunk(){
 const t=Object.entries(SB.ifs).filter(([,p])=>p.mode==="trunk");
 if(!t.length)return[];
 return[pad("Port",12)+pad("Mode",8)+pad("Encapsulation",15)+pad("Status",14)+"Native vlan",...t.map(([k,p])=>pad(short(k),12)+pad("on",8)+pad("802.1q",15)+pad(p.up?"trunking":"not-trunking",14)+p.native),"",pad("Port",12)+"Vlans allowed on trunk",...t.map(([k,p])=>pad(short(k),12)+(p.allowed==="all"?"1-4094":p.allowed))];
}
function swConfig(){
 const o=["Building configuration...","","Current configuration:","!","hostname "+SB.host,"!"];
 secLines(o);
 Object.entries(SB.vlans).filter(([id])=>id!=="1").forEach(([id,v])=>o.push("vlan "+id," name "+v.name,"!"));
 Object.entries(SB.ifs).forEach(([k,p])=>{
  o.push("interface "+k);
  if(p.mode==="trunk"){o.push(" switchport mode trunk");if(p.native!==1)o.push(" switchport trunk native vlan "+p.native);if(p.allowed!=="all")o.push(" switchport trunk allowed vlan "+p.allowed)}
  else{if(p.vlan!==1)o.push(" switchport access vlan "+p.vlan);o.push(" switchport mode access")}
  if(!p.up)o.push(" shutdown");
  o.push("!");
 });
 return[...o,"end"];
}
const PORTS={www:80,http:80,https:443,ftp:21,telnet:23,ssh:22,domain:53,smtp:25};
const spec=(w,i)=>w[i]==="any"?[{any:1},i+1]:w[i]==="host"&&isIp(w[i+1])?[{ip:w[i+1],wild:"0.0.0.0"},i+2]:isIp(w[i])?(isIp(w[i+1])?[{ip:w[i],wild:w[i+1]},i+2]:[{ip:w[i],wild:"0.0.0.0"},i+1]):null;
const specTxt=s=>s.any?"any":s.wild==="0.0.0.0"?"host "+s.ip:s.ip+" "+s.wild;
const specHit=(s,ip)=>!!s.any||((((ip2n(ip)^ip2n(s.ip))&~ip2n(s.wild))>>>0)===0);
function aclEval(id,p){
 for(const e of SB.acls[id]||[]){
  const hit=e.proto?((e.proto==="ip"||e.proto===p.proto)&&specHit(e.src,p.src)&&specHit(e.dst,p.dst)&&(!e.port||e.port===p.port)):specHit(e.src,p.src);
  if(hit)return{ok:e.act==="permit",line:e.act+" "+e.txt};
 }
 return{ok:false,line:"deny any (implisit)"};
}
const natLines=()=>["Pro Inside global      Inside local       Outside local      Outside global",...(SB.nattab||[]).map(x=>pad(x.pro,4)+pad(x.ig,22)+pad(x.il,19)+pad(x.ol,19)+x.og)];
const dhcpLines=()=>["IP address       Client-ID/Hardware address    Lease expiration        Type",...(SB.dhcpb||[]).map(b=>pad(b.ip,17)+pad(b.mac,30)+pad("1 day",24)+"Automatic")];
function dhcpSim(name){
 const cl=name||"PC1",L=["DHCP SIMULATION","Client: "+cl,""],fail=(t,r)=>{L.push("✗ "+t,"","RESULT: FAILED","Reason: "+r);return L};
 const pool=Object.entries(SB.dhcp.pools).find(([,p])=>p.net&&p.gw);
 if(!pool)return fail("DISCOVER: no DHCP server responded","no DHCP pool configured. Use ip dhcp pool, network, and default-router");
 const p=pool[1],c=conn().find(x=>sameNet(x.ip,p.net,p.mask));
 if(!c)return fail("DISCOVER: no interface is UP in network "+p.net+"/"+maskLen(p.mask),"bring up an interface in that network (ip address + no shutdown)");
 SB.dhcpb=SB.dhcpb||[];
 const base=ip2n(p.net),size=2**(32-maskLen(p.mask)),used=a=>SB.dhcp.ex.some(e=>a>=ip2n(e[0])&&a<=ip2n(e[1]))||a===ip2n(c.ip)||a===ip2n(p.gw)||SB.dhcpb.some(b=>ip2n(b.ip)===a);
 let a=base+1;while(a<base+size-1&&used(a))a++;
 if(a>=base+size-1)return fail("DISCOVER: DHCP pool exhausted","no free address left in the pool");
 const ip=n2ip(a);SB.dhcpb.push({ip,mac:"aaaa.bbbb."+(SB.dhcpb.length+1).toString(16).padStart(4,"0"),client:cl});
 L.push("✓ DISCOVER: "+cl+" broadcasts a request","✓ OFFER: server offers "+ip,"✓ REQUEST: "+cl+" requests "+ip,"✓ ACK: lease granted "+ip+"/"+maskLen(p.mask)+", gateway "+p.gw+(p.dns?", DNS "+p.dns:""),"","RESULT: LEASE GRANTED");
 return L;
}
function sbSim(w){
 SB.seen.sim=true;
 if(w[1]&&w[1].toLowerCase()==="dhcp")return dhcpSim(w[2]);
 const[,s,d,pr="icmp",pt]=w;
 if(!isIp(s)||!isIp(d)||!["icmp","tcp","udp","ip"].includes(pr))return["% Usage: simulate <src> <dst> [icmp|tcp|udp] [port]","         simulate dhcp <client>"];
 const p={src:s,dst:d,proto:pr,port:pt?(PORTS[pt]||+pt):0},c=conn(),PR=pr.toUpperCase()+(p.port?"/"+p.port:"");
 const L=["PACKET TRACE","Source: "+s,"Destination: "+d,"Protocol: "+pr.toUpperCase()+(p.port?"  Port: "+p.port:""),""];
 const T=[{k:"SOURCE",s:"ok",t:s}],stage=(k,st,t)=>{const i=T.findIndex(x=>x.k===k);if(i>=0)T[i]={k,s:st,t};else T.push({k,s:st,t})};
 const names=["SOURCE","INTERFACE","ACL","ROUTING","NAT","DESTINATION"];
 const fin=(res,why)=>{SB.lastTrace={n:((SB.lastTrace||{}).n||0)+1,src:s,dst:d,pr:PR,stages:names.map(k=>T.find(x=>x.k===k)||{k,s:"skip",t:"tidak dicapai"}),result:res,why};return L};
 const ok=t=>L.push("✓ "+t),deny=(k,t,reason,why)=>{stage(k,"fail",reason);L.push("✗ "+t,"","RESULT: DENIED","Reason: "+reason);return fin("DENIED",why)};
 const inI=c.find(x=>sameNet(x.ip,s,x.mask));
 if(!inI)return deny("INTERFACE","Source interface: "+s+" is not on a connected network","source "+s+" is not connected to any UP interface","Alamat sumber "+s+" tidak berada di jaringan yang terhubung ke interface yang UP. Periksa ip address dan no shutdown.");
 stage("INTERFACE","ok",short(inI.name)+" UP ("+inI.ip+"/"+maskLen(inI.mask)+")");ok("Source interface "+short(inI.name)+" UP ("+inI.ip+"/"+maskLen(inI.mask)+")");
 const chk=(f,dir)=>{const id=(SB.ifs[f.name].acl||{})[dir];return id?{id,...aclEval(id,p)}:null},aclT=[];
 const a=chk(inI,"in");
 if(a){if(!a.ok)return deny("ACL","ACL "+a.id+" in "+short(inI.name)+": DENY ("+a.line+")","ACL "+a.id+" denied "+PR,"ACL "+a.id+" pada "+short(inI.name)+" (arah masuk) menolak "+PR+" lewat aturan '"+a.line+"'. Periksa urutan aturan dan implicit deny.");ok("ACL "+a.id+" in: PERMIT ("+a.line+")");aclT.push("in "+a.id+" PERMIT")}else ok("ACL in "+short(inI.name)+": none");
 let outI=c.find(x=>sameNet(x.ip,d,x.mask)),via="directly connected";
 if(!outI){const r=SB.routes.filter(r=>netOf(d,r.mask)===r.net&&c.some(x=>sameNet(x.ip,r.nh,x.mask))).sort((x,y)=>maskLen(y.mask)-maskLen(x.mask))[0];if(r){outI=c.find(x=>sameNet(x.ip,r.nh,x.mask));via="static route via "+r.nh}}
 if(!outI){stage("ACL","ok",aclT.join(", ")||"tidak ada ACL");return deny("ROUTING","Routing lookup: no route to "+d,"no route to "+d+" in the routing table","Router tidak memiliki route menuju "+d+". Tambahkan static route (ip route) atau default route, dan pastikan next hop berada di network interface yang UP.")}
 stage("ROUTING","ok",via+", keluar "+short(outI.name));ok("Routing lookup: "+via+", out "+short(outI.name));
 const b=chk(outI,"out");
 if(b){if(!b.ok)return deny("ACL","ACL "+b.id+" out "+short(outI.name)+": DENY ("+b.line+")","ACL "+b.id+" denied "+PR,"ACL "+b.id+" pada "+short(outI.name)+" (arah keluar) menolak "+PR+" lewat aturan '"+b.line+"'.");ok("ACL "+b.id+" out: PERMIT ("+b.line+")");aclT.push("out "+b.id+" PERMIT")}else ok("ACL out "+short(outI.name)+": none");
 stage("ACL","ok",aclT.join(", ")||"tidak ada ACL");
 const nn=n=>n.replace(/\D*(\d+\/\d+)/,"$1");
 if(SB.nat.length){
  const rule=SB.nat.find(r=>SB.ifs[inI.name].nat==="inside"&&SB.ifs[outI.name].nat==="outside"&&nn(r.ifc)===nn(outI.name)&&SB.acls[r.acl]&&aclEval(r.acl,p).ok);
  if(rule){SB.nattab=SB.nattab||[];const n=SB.nattab.length,lp=49152+n,gp=30001+n;SB.nattab.push({pro:pr,il:s+":"+lp,ig:outI.ip+":"+gp,ol:d+":"+(p.port||"-"),og:d+":"+(p.port||"-")});if(SB.nattab.length>20)SB.nattab.shift();stage("NAT","ok",s+" menjadi "+outI.ip);ok("NAT: "+s+":"+lp+" translated to "+outI.ip+":"+gp)}
  else{stage("NAT","na","tidak ada rule yang cocok");ok("NAT: no rule matched (forwarded without translation)")}
 }else{stage("NAT","na","tidak dikonfigurasi");ok("NAT: not configured")}
 stage("DESTINATION","ok",d);ok("Forwarding via "+short(outI.name));ok("Destination "+d+" reachable (assumed present on that network)");
 L.push("","RESULT: ALLOWED");return fin("ALLOWED","");
}
function sbTrace(t){
 if(!isIp(t))return["% Unrecognized host or address, or protocol not running."];
 if(netHooks.active&&netHooks.trace)return netHooks.trace(SB,t);
 const c=conn(),h=["Type escape sequence to abort.","Tracing the route to "+t,""],ms=" 4 msec 2 msec 3 msec";
 if(c.some(x=>x.ip===t||sameNet(x.ip,t,x.mask)))return[...h,"  1 "+t+ms];
 const r=SB.routes.filter(r=>netOf(t,r.mask)===r.net&&c.some(x=>sameNet(x.ip,r.nh,x.mask))).sort((a,b)=>maskLen(b.mask)-maskLen(a.mask))[0];
 if(r)return[...h,"  1 "+r.nh+ms,"  2 "+t+ms];
 return[...h,"  1  *  *  *","  2  *  *  *","  3  *  *  *"];
}
const sbIfaces=()=>Object.entries(SB.ifs).flatMap(([k,v])=>[k+" is "+(v.up?"up, line protocol is up":"administratively down, line protocol is down"),...(v.ip?["  Internet address is "+v.ip+"/"+maskLen(v.mask)]:SB.dev==="router"?["  Internet protocol processing disabled"]:["  Switchport mode: "+v.mode+(v.mode==="access"?", VLAN "+v.vlan:"")]),"  MTU 1500 bytes, BW 100000 Kbit/sec","  0 packets input, 0 packets output",""]);
const sbProto=()=>{
 const o=[];
 if(SB.rp.on)o.push('Routing Protocol is "rip"',"  Default version control: send version "+SB.rp.ver+", receive version "+SB.rp.ver,"  Automatic network summarization is "+(SB.rp.auto?"in effect":"not in effect"),"  Routing for Networks:",...SB.rp.nets.map(x=>"    "+x),"");
 if(SB.os.pid)o.push('Routing Protocol is "ospf '+SB.os.pid+'"',"  Router ID "+(SB.os.rid||"(otomatis)"),"  Routing for Networks:",...SB.os.nets.map(x=>"    "+x),...(SB.os.pass.length?["  Passive Interface(s):",...SB.os.pass.map(x=>"    "+x)]:[]),"");
 if(SB.ei.as)o.push('Routing Protocol is "eigrp '+SB.ei.as+'"',"  Automatic network summarization is "+(SB.ei.auto?"in effect":"not in effect"),"  Routing for Networks:",...SB.ei.nets.map(x=>"    "+x),"");
 return o.length?o:["(Tidak ada protokol routing yang aktif)"];
};
const sbAcls=()=>Object.entries(SB.acls).flatMap(([id,r])=>[(id>=100?"Extended":"Standard")+" IP access list "+id,...r.map((x,i)=>"    "+(i+1)*10+" "+x.act+"   "+x.txt)]);
const svcLines=o=>{
 SB.dhcp.ex.forEach(e=>o.push("ip dhcp excluded-address "+e[0]+(e[1]!==e[0]?" "+e[1]:"")));
 Object.entries(SB.dhcp.pools).forEach(([k,p])=>o.push("ip dhcp pool "+k,p.net?" network "+p.net+" "+p.mask:false,p.gw?" default-router "+p.gw:false,p.dns?" dns-server "+p.dns:false,"!"));
 SB.nat.forEach(r=>o.push("ip nat inside source list "+r.acl+" interface "+r.ifc+" overload"));
 Object.entries(SB.acls).forEach(([id,r])=>r.forEach(x=>o.push("access-list "+id+" "+x.act+" "+x.txt)));
 if(SB.rp.on)o.push("router rip"," version "+SB.rp.ver,...SB.rp.nets.map(x=>" network "+x),SB.rp.auto?false:" no auto-summary","!");
 if(SB.os.pid)o.push("router ospf "+SB.os.pid,SB.os.rid?" router-id "+SB.os.rid:false,...SB.os.nets.map(x=>" network "+x),...SB.os.pass.map(x=>" passive-interface "+x),"!");
 if(SB.ei.as)o.push("router eigrp "+SB.ei.as,...SB.ei.nets.map(x=>" network "+x),SB.ei.auto?false:" no auto-summary","!");
};
const secLines=o=>{
 if(SB.secret)o.push("enable secret 5 ********","!");
 if(SB.banner)o.push("banner motd ^C"+SB.banner+"^C","!");
 if(SB.con.pw||SB.con.login)o.push("line con 0"," password "+SB.con.pw,SB.con.login?" login":false,"!");
};
function sbBrief(){
 return [pad("Interface",27)+pad("IP-Address",16)+pad("OK?",5)+pad("Method",7)+pad("Status",23)+"Protocol",
 ...Object.entries(SB.ifs).map(([k,v])=>pad(k,27)+pad(v.ip||"unassigned",16)+pad("YES",5)+pad(v.ip?"manual":"unset",7)+pad(v.up?"up":"administratively down",23)+(v.up?"up":"down"))];
}
function sbRoutes(){
 SB.seen.route=true;dailyEvent("route");const c=conn(),st=SB.routes.filter(r=>c.some(x=>sameNet(x.ip,r.nh,x.mask)));
 const isDef=r=>r.net==="0.0.0.0"&&r.mask==="0.0.0.0",def=st.find(isDef);
 const o=["Codes: C - connected, S - static, L - local, * - candidate default","",def?`Gateway of last resort is ${def.nh} to network 0.0.0.0`:"Gateway of last resort is not set",""];
 c.forEach(x=>{o.push(`C    ${netOf(x.ip,x.mask)}/${maskLen(x.mask)} is directly connected, ${x.name}`);o.push(`L    ${x.ip}/32 is directly connected, ${x.name}`)});
 st.forEach(r=>o.push(`${isDef(r)?"S*":"S "}   ${r.net}/${maskLen(r.mask)} [1/0] via ${r.nh}`));
 if(netHooks.active&&netHooks.dyn)netHooks.dyn(SB).forEach(x=>o.push(x));
 return o;
}
function sbConfig(){
 if(SB.dev==="switch")return swConfig();
 const o=["Building configuration...","","Current configuration:","!","hostname "+SB.host,"!"];
 secLines(o);
 Object.entries(SB.ifs).forEach(([k,v])=>o.push("interface "+k,v.ip?` ip address ${v.ip} ${v.mask}`:" no ip address",v.up?false:" shutdown",v.nat?" ip nat "+v.nat:false,...Object.entries(v.acl||{}).map(([d,id])=>" ip access-group "+id+" "+d),"!"));
 svcLines(o);
 SB.routes.forEach(r=>o.push(`ip route ${r.net} ${r.mask} ${r.nh}`));
 return [...o,"!","end"].filter(l=>l!==false);
}
function sbPing(t){
 if(!isIp(t))return["% Unrecognized host or address, or protocol not running."];
 if(netHooks.active&&netHooks.ping)return netHooks.ping(SB,t);
 const c=conn(),ok=c.some(x=>x.ip===t||sameNet(x.ip,t,x.mask))||SB.routes.some(r=>c.some(x=>sameNet(x.ip,r.nh,x.mask))&&netOf(t,r.mask)===r.net);
 return["Type escape sequence to abort.",`Sending 5, 100-byte ICMP Echos to ${t}, timeout is 2 seconds:`,ok?"!!!!!":"UUUUU",ok?"Success rate is 100 percent (5/5), round-trip min/avg/max = 1/1/2 ms":"Success rate is 0 percent (0/5)"];
}
function sbRun(line){
 if(SB.dev==="linux")return lxRun(line);
 const w=line.trim().split(/\s+/).filter(Boolean);if(!w.length)return[];
 const c0=w[0].toLowerCase(),n=w.length,M=SB.mode,cfg=M==="config"||M==="if"||M==="vlan"||M==="line"||M==="dhcp"||M==="router",show=M==="user"||M==="priv";
 const m=(i,word,min=1)=>!!w[i]&&w[i].length>=min&&word.startsWith(w[i].toLowerCase());
 const bad="% Invalid input detected at '^' marker.";
 if(c0==="?"||c0==="help")return SB.dev==="switch"?HELPSW:HELP;
 if(c0==="do"&&cfg&&n>1){SB.mode="priv";const o=sbRun(w.slice(1).join(" "));SB.mode=M;return o}
 if(c0==="end"&&cfg&&n===1){SB.mode="priv";SB.cur=null;return[]}
 if(m(0,"enable",3)&&M==="user"&&n===1){SB.mode="priv";return[]}
 if(m(0,"disable",3)&&M==="priv"&&n===1){SB.mode="user";return[]}
 if(m(0,"configure",4)&&m(1,"terminal")&&M==="priv"&&n===2){SB.mode="config";return["Enter configuration commands, one per line.  End with CNTL/Z."]}
 if(c0==="exit"&&n===1){if(M==="if"||M==="vlan"||M==="line"||M==="dhcp"||M==="router"){SB.mode="config";SB.cur=null}else if(M==="config")SB.mode="priv";else if(M==="priv")SB.mode="user";return[]}
 if(m(0,"hostname",4)&&cfg&&n===2){if(!/^[A-Za-z][\w-]{0,62}$/.test(w[1]))return["% Invalid hostname"];SB.host=w[1];SB.mode="config";SB.cur=null;return[]}
 if(m(0,"interface",3)&&cfg&&n>=2){
  const mm=w.slice(1).join("").match(/^(g|gi|gig|gigabit|gigabitethernet|f|fa|fast|fastethernet)(\d+\/\d+)$/i),nm=mm&&(/^g/i.test(mm[1])?"GigabitEthernet":"FastEthernet")+mm[2];
  if(!nm||!SB.ifs[nm])return["% Invalid interface. Contoh: g0/1 atau fa0/1"];
  SB.mode="if";SB.cur=nm;return[];
 }
 if(SB.dev==="router"&&M==="if"&&c0==="ip"&&m(1,"address",2)&&n===4){
  if(!isIp(w[2])||!validMask(w[3]))return[bad];
  Object.assign(SB.ifs[SB.cur],{ip:w[2],mask:w[3]});dailyEvent("ip");return[];
 }
 if(M==="if"&&c0==="no"&&m(1,"shutdown",3)&&n===2){
  const i=SB.ifs[SB.cur],was=i.up;i.up=true;
  return was?[]:[`%LINK-5-CHANGED: Interface ${SB.cur}, changed state to up`,`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${SB.cur}, changed state to up`];
 }
 if(M==="if"&&m(0,"shutdown",3)&&n===1){
  SB.ifs[SB.cur].up=false;
  return[`%LINK-5-CHANGED: Interface ${SB.cur}, changed state to administratively down`,`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${SB.cur}, changed state to down`];
 }
 if(SB.dev==="router"&&cfg&&c0==="ip"&&m(1,"route",2)&&n===5){
  const[,,a,mk,nh]=w;if(!isIp(a)||!validMask(mk)||!isIp(nh))return[bad];
  const r={net:netOf(a,mk),mask:mk,nh};
  if(!SB.routes.some(x=>x.net===r.net&&x.mask===r.mask&&x.nh===r.nh))SB.routes.push(r);
  SB.mode="config";SB.cur=null;return conn().some(x=>sameNet(x.ip,nh,x.mask))?[]:["% Warning: next hop "+nh+" is not reachable yet. The route is installed when an interface in its network is UP."];
 }
 if(cfg){
  if(c0==="enable"&&m(1,"secret",3)&&n===3){SB.secret=w[2];SB.mode="config";return[]}
  if(c0==="banner"&&m(1,"motd",2)&&n>=3){
   const t=line.trim().replace(/^\S+\s+\S+\s*/,""),e=t.lastIndexOf(t[0]);
   if(t.length<3||e<1)return["% Format: banner motd #pesan#"];
   SB.banner=t.slice(1,e);SB.mode="config";return[];
  }
  if(c0==="line"&&m(1,"console",3)&&n===3&&w[2]==="0"){SB.mode="line";return[]}
 }
 if(M==="line"){
  if(c0==="password"&&n===2){SB.con.pw=w[1];return[]}
  if(c0==="login"&&n===1){SB.con.login=true;return[]}
 }
 if(SB.dev==="router"){
  if(M==="if"&&c0==="no"&&m(1,"ip",2)&&m(2,"access-group",3)&&n===5){const i=SB.ifs[SB.cur];if(i.acl&&i.acl[w[4].toLowerCase()]===w[3])delete i.acl[w[4].toLowerCase()];return[]}
  if(cfg&&c0==="no"&&m(1,"access-list",3)&&n===3){delete SB.acls[w[2]];SB.mode="config";return[]}
  if(cfg&&c0==="no"&&m(1,"ip",2)&&m(2,"route",2)&&n===6&&isIp(w[3])&&validMask(w[4])&&isIp(w[5])){SB.routes=SB.routes.filter(x=>!(x.net===netOf(w[3],w[4])&&x.mask===w[4]&&x.nh===w[5]));SB.mode="config";return[]}
  if(cfg&&c0==="router"&&n>=2){
   const k=w[1].toLowerCase();
   if(k==="rip"&&n===2){SB.rp.on=true;SB.proto="rip";SB.mode="router";return[]}
   if((k==="ospf"||k==="eigrp")&&n===3&&/^\d+$/.test(w[2])){if(k==="ospf")SB.os.pid=w[2];else SB.ei.as=w[2];SB.proto=k;SB.mode="router";return[]}
   return[bad];
  }
  if(M==="router"){
   const P=SB.proto;
   if(c0==="version"&&P==="rip"&&n===2&&(w[1]==="1"||w[1]==="2")){SB.rp.ver=+w[1];return[]}
   if(c0==="no"&&m(1,"auto-summary",3)&&n===2&&P!=="ospf"){(P==="rip"?SB.rp:SB.ei).auto=false;return[]}
   if(c0==="router-id"&&P==="ospf"&&n===2&&isIp(w[1])){SB.os.rid=w[1];return[]}
   if(m(0,"passive-interface",3)&&n===2&&P==="ospf"){SB.os.pass.push(w[1]);return[]}
   if(c0==="network"){
    if(P==="rip"&&n===2&&isIp(w[1])){SB.rp.nets.push(w[1]);return[]}
    if(P==="eigrp"&&(n===2||n===3)&&isIp(w[1])&&(n===2||isIp(w[2]))){SB.ei.nets.push(w[1]+(n===3?" "+w[2]:""));return[]}
    if(P==="ospf"&&n===5&&isIp(w[1])&&isIp(w[2])&&m(3,"area",2)&&/^\d+$/.test(w[4])){SB.os.nets.push(w[1]+" "+w[2]+" area "+w[4]);return[]}
    return[bad];
   }
  }
  if(c0==="simulate"&&show)return sbSim(w);
  if(cfg&&c0==="ip"&&m(1,"dhcp",2)){
   if(m(2,"excluded-address",3)&&(n===4||n===5)&&isIp(w[3])&&(n===4||isIp(w[4]))){SB.dhcp.ex.push([w[3],w[4]||w[3]]);SB.mode="config";return[]}
   if(m(2,"pool",2)&&n===4){SB.dhcp.pools[w[3]]=SB.dhcp.pools[w[3]]||{net:"",mask:"",gw:"",dns:""};SB.curP=w[3];SB.mode="dhcp";return[]}
  }
  if(M==="dhcp"){
   const p=SB.dhcp.pools[SB.curP];
   if(c0==="network"&&n===3&&isIp(w[1])&&validMask(w[2])){p.net=netOf(w[1],w[2]);p.mask=w[2];return[]}
   if(m(0,"default-router",3)&&n===2&&isIp(w[1])){p.gw=w[1];return[]}
   if(m(0,"dns-server",3)&&n===2&&isIp(w[1])){p.dns=w[1];return[]}
  }
  if(M==="if"&&c0==="ip"&&m(1,"nat",2)&&n===3&&(w[2]==="inside"||w[2]==="outside")){SB.ifs[SB.cur].nat=w[2];return[]}
  if(M==="if"&&c0==="ip"&&m(1,"access-group",3)&&n===4&&/^(in|out)$/i.test(w[3])){const i=SB.ifs[SB.cur];i.acl=i.acl||{};i.acl[w[3].toLowerCase()]=w[2];return[]}
  if(M==="if"&&c0==="ip"&&m(1,"helper-address",3)&&n===3&&isIp(w[2])){SB.ifs[SB.cur].helper=w[2];return[]}
  if(M==="config"&&c0==="crypto"&&m(1,"key",3)&&m(2,"generate",3)&&m(3,"rsa",3)){SB.ssh=true;return["The name for the keys will be: "+SB.host+".netlab.local","% The key modulus size is 1024 bits","% Generating 1024 bit RSA keys, keys will be non-exportable...","[OK]"]}
  if(cfg&&c0==="ip"&&m(1,"nat",2)&&m(2,"inside",2)&&m(3,"source",2)&&m(4,"list",2)&&m(6,"interface",3)&&n===9&&w[8].toLowerCase()==="overload"){SB.nat.push({acl:w[5],ifc:w[7]});SB.mode="config";return[]}
  if(cfg&&c0==="access-list"&&/^\d+$/.test(w[1])&&(w[2]==="permit"||w[2]==="deny")){
   const id=+w[1];let e=null;
   if(id>=1&&id<=99){const s=spec(w,3);if(s&&s[1]===n)e={act:w[2],src:s[0],txt:specTxt(s[0])}}
   else if(id>=100&&id<=199&&["ip","icmp","tcp","udp"].includes(w[3])){
    const s=spec(w,4),d=s&&spec(w,s[1]);
    if(d){let i=d[1],port=0;if(w[i]==="eq"&&w[i+1]){port=PORTS[w[i+1]]||+w[i+1];i+=2}
     if(i===n&&(!port||w[3]==="tcp"||w[3]==="udp"))e={act:w[2],proto:w[3],src:s[0],dst:d[0],port,txt:w[3]+" "+specTxt(s[0])+" "+specTxt(d[0])+(port?" eq "+port:"")}}
   }
   if(!e)return[bad];
   (SB.acls[id]=SB.acls[id]||[]).push(e);SB.mode="config";return[];
  }
 }
 if(M==="if"&&SB.dev==="router"&&c0==="no"&&m(1,"ip",2)&&m(2,"address",2)&&n===3){Object.assign(SB.ifs[SB.cur],{ip:"",mask:""});return[]}
 if(M==="priv"&&m(0,"copy",2)&&m(1,"running-config",3)&&m(2,"startup-config",3)&&n===3){SB.saved=true;SB.startup=sbConfig();return["Destination filename [startup-config]?","Building configuration...","[OK]"]}
 if(SB.dev==="switch"){
  if(cfg&&c0==="vlan"&&n===2){const v=+w[1];if(!(v>=1&&v<=4094))return[bad];SB.vlans[v]=SB.vlans[v]||{name:"VLAN"+String(v).padStart(4,"0")};SB.mode="vlan";SB.curV=v;dailyEvent("vlan");return[]}
  if(M==="vlan"&&c0==="name"&&n===2){SB.vlans[SB.curV].name=w[1];return[]}
  if(cfg&&c0==="no"&&m(1,"vlan")&&n===3){const v=+w[2];if(v===1)return["% Default VLAN 1 may not be deleted."];delete SB.vlans[v];SB.mode="config";return[]}
  if(M==="if"&&m(0,"switchport",3)){
   const i=SB.ifs[SB.cur],a=w.slice(1).map(x=>x.toLowerCase());
   if(a[0]==="mode"&&n===3&&(a[1]==="access"||a[1]==="trunk")){i.mode=a[1];return[]}
   if(a[0]==="access"&&a[1]==="vlan"&&n===4){
    const v=+w[3];if(!(v>=1&&v<=4094))return[bad];
    i.vlan=v;
    if(!SB.vlans[v]){SB.vlans[v]={name:"VLAN"+String(v).padStart(4,"0")};return["% Access VLAN does not exist. Creating vlan "+v]}
    return[];
   }
   if(a[0]==="trunk"&&a[1]==="native"&&a[2]==="vlan"&&n===5){i.native=+w[4];return[]}
   if(a[0]==="trunk"&&a[1]==="allowed"&&a[2]==="vlan"&&n===5){i.allowed=w[4];return[]}
  }
 }
 if(m(0,"show",2)&&show){
  if(SB.dev==="switch"&&m(1,"vlan",2)&&m(2,"brief")&&n===3)return swVlans();
  if(SB.dev==="switch"&&m(1,"interfaces",3)&&m(2,"trunk",2)&&n===3)return swTrunk();
  if(M==="priv"&&m(1,"startup-config",3)&&n===2)return SB.startup||["startup-config is not present"];
  if(m(1,"interfaces",3)&&n===2)return sbIfaces();
  if(SB.dev==="router"&&m(1,"ip",2)&&m(2,"nat",2)&&m(3,"translations",3)&&n===4)return natLines();
  if(SB.dev==="router"&&m(1,"ip",2)&&m(2,"dhcp",2)&&m(3,"binding",3)&&n===4)return dhcpLines();
  if(SB.dev==="router"&&m(1,"access-lists",3)&&n===2)return sbAcls();
  if(SB.dev==="router"&&m(1,"ip",2)&&m(2,"protocols",3)&&n===3)return sbProto();
  if(SB.dev==="router"&&m(1,"ip",2)&&m(2,"eigrp",2)&&m(3,"neighbors",3)&&n===4)return netHooks.active&&netHooks.nbr?netHooks.nbr(SB,"eigrp"):["EIGRP-IPv4 Neighbors for AS(none)"];
  if(SB.dev==="router"&&m(1,"ip",2)&&m(2,"ospf",2)&&m(3,"neighbor",3)&&n===4)return netHooks.active&&netHooks.nbr?netHooks.nbr(SB,"ospf"):["Neighbor ID     Pri   State           Dead Time   Address         Interface"];
  if(SB.dev==="router"&&m(1,"ip",2)&&m(2,"interface",3)&&m(3,"brief")&&n===4)return sbBrief();
  if(SB.dev==="router"&&m(1,"ip",2)&&m(2,"route",3)&&n===3)return sbRoutes();
  if(M==="priv"&&m(1,"running-config",3)&&n===2)return sbConfig();
 }
 if(SB.dev==="router"&&m(0,"ping",3)&&show&&n===2)return sbPing(w[1]);
 if(SB.dev==="router"&&m(0,"traceroute",5)&&show&&n===2)return sbTrace(w[1]);
 const known=["enable","disable","configure","hostname","interface","ip","no","show","ping","exit","end","shutdown"];
 return[c0.length>=2&&known.some(k=>k.startsWith(c0))?bad:"Command not supported in simulator."];
}

export {useDevice, withDevice, lxInit, lxRun, sbInit, sbReset, swVlans, swTrunk, swConfig, aclEval, dhcpSim, sbSim, sbTrace, sbBrief, sbRoutes, sbConfig, sbPing, sbRun, RT, SW, LX, SB, netHooks, mkdirNode, mkfileNode, LXHELP, LXCHIPS, lxPrompt, lxIp, lxParts, lxAt, lxNode, lxModeStr, CHIPS, HELP, conn, sbPrompt, HELPSW, SWCHIPS, short, PORTS, spec, specTxt, specHit, natLines, dhcpLines, sbIfaces, sbProto, sbAcls, svcLines, secLines};
