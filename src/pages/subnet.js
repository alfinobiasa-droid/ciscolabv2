import {toast, $, esc, copyText} from "../core.js";
import {isIp, ip2n, n2ip, validMask, maskLen} from "../sim/net.js";

const SN={mode:"calc",ip:"192.168.1.0",cidr:"24",mask:"255.255.255.0"};
const SNMODES=[["calc","Subnet"],["c2m","CIDR → Mask"],["m2c","Mask → CIDR"]];
const cidrMask=n=>n===0?0:(0xFFFFFFFF<<(32-n))>>>0;
const wild=mk=>n2ip((~mk)>>>0);
const bin=m=>[24,16,8,0].map(b=>((m>>>b)&255).toString(2).padStart(8,"0")).join(".");
const validCidr=v=>/^\d{1,2}$/.test(v)&&+v<=32;
const usable=n=>n>=32?1:n===31?2:2**(32-n)-2;
const ipClass=ip=>{const a=+ip.split(".")[0];return a===127?"Loopback":a>=1&&a<=126?"A":a>=128&&a<=191?"B":a>=192&&a<=223?"C":a>=224&&a<=239?"D (multicast)":a>=240?"E (cadangan)":"-"};
const bitsBar=n=>`<div class="bits" role="img" aria-label="${n} bit network, ${32-n} bit host">${Array.from({length:32},(_,i)=>`<i class="${i<n?"":"h"}"></i>`).join("")}</div><div class="bits-leg"><span>■ Network (${n} bit)</span><span class="h">■ Host (${32-n} bit)</span></div>`;
function snRows(){
 const err=m=>({err:m});
 if(SN.mode==="calc"){
  if(!isIp(SN.ip))return err("IP address tidak valid. Contoh: 192.168.1.0");
  if(!validCidr(SN.cidr))return err("CIDR harus angka 0 sampai 32.");
  const n=+SN.cidr,mk=cidrMask(n),net=(ip2n(SN.ip)&mk)>>>0,bc=(net|~mk)>>>0,one=n>=31;
  return{rows:[["Network Address",n2ip(net)],["Broadcast Address",n2ip(bc)],["Subnet Mask",n2ip(mk)],["Wildcard Mask",wild(mk)],["First Host",n2ip(one?net:net+1)],["Last Host",n2ip(one?bc:bc-1)],["Jumlah Host",String(usable(n))],["Notasi",n2ip(net)+"/"+n],["Kelas IP",ipClass(SN.ip)]],bits:n,note:one?"/31 dipakai untuk link point-to-point, /32 untuk satu host.":""};
 }
 if(SN.mode==="c2m"){
  if(!validCidr(SN.cidr))return err("CIDR harus angka 0 sampai 32.");
  const n=+SN.cidr,mk=cidrMask(n);
  return{rows:[["Subnet Mask",n2ip(mk)],["Wildcard Mask",wild(mk)],["Mask (biner)",bin(mk)],["Jumlah Host",String(usable(n))],["Jumlah Alamat",String(2**(32-n))]]};
 }
 if(!validMask(SN.mask))return err("Subnet mask tidak valid. Contoh: 255.255.255.0");
 const n=maskLen(SN.mask),mk=cidrMask(n);
 return{rows:[["CIDR","/"+n],["Wildcard Mask",wild(mk)],["Mask (biner)",bin(mk)],["Jumlah Host",String(usable(n))]]};
}
function snDraw(){
 const r=snRows();
 $("#snout").innerHTML=r.err?`<div class="fb no"><b>${r.err}</b></div>`:r.rows.map(x=>`<button class="row" data-cp="${x[1]}"><span>${x[0]}</span><b>${x[1]}</b></button>`).join("")+(r.bits!=null?bitsBar(r.bits):"")+`<p style="color:var(--mute);font-size:.85rem;margin:10px 0 0">Ketuk baris untuk menyalin.${r.note?" "+r.note:""}</p>`;
}
function renderSubnet(){
 const inp=(id,label,val,mode)=>`<label class="fld">${label}<input class="inp" id="${id}" inputmode="${mode}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(val)}"></label>`;
 const f={calc:`<div class="frm">${inp("sn-ip","IP Address",SN.ip,"decimal")}${inp("sn-cidr","CIDR",SN.cidr,"numeric")}</div>`,c2m:inp("sn-cidr","CIDR (contoh 24)",SN.cidr,"numeric"),m2c:inp("sn-mask","Subnet Mask",SN.mask,"decimal")};
 $("#view").innerHTML=`<h1 class="pg" style="margin:4px 0 6px">Subnet Calculator</h1><p style="color:var(--mute);margin:0 0 12px">Hitung network, broadcast, dan host range, atau konversi CIDR dan subnet mask.</p>
 <div class="seg" style="margin-bottom:12px">${SNMODES.map(m=>`<button class="chip" data-sn="${m[0]}" aria-pressed="${SN.mode===m[0]}">${m[1]}</button>`).join("")}</div>
 <div class="qcard">${f[SN.mode]}<div id="snout" style="margin-top:14px"></div></div>`;
 snDraw();
}
document.addEventListener("input",e=>{
 const id=e.target.id;if(!id||id.slice(0,3)!=="sn-")return;
 const v=e.target.value.trim();
 if(id==="sn-ip")SN.ip=v;else if(id==="sn-cidr")SN.cidr=v.replace("/","");else SN.mask=v;
 snDraw();
});
document.addEventListener("click",e=>{
 const t=e.target.closest("[data-sn],[data-cp]");if(!t)return;
 if(t.dataset.sn){SN.mode=t.dataset.sn;return renderSubnet()}
 const v=t.dataset.cp,ok=()=>toast("Tersalin: "+v),no=()=>toast("Tidak bisa menyalin otomatis. Salin manual: "+v);
 copyText(v).then(ok,no)
});

export {snRows, snDraw, renderSubnet, SN, SNMODES, cidrMask, wild, bin, validCidr, usable, ipClass, bitsBar};
