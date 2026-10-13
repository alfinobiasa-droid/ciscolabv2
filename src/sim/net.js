const isIp=x=>/^(\d{1,3}\.){3}\d{1,3}$/.test(x)&&x.split(".").every(o=>+o<=255);
const ip2n=x=>x.split(".").reduce((a,o)=>a*256+Number(o),0);
const n2ip=n=>[24,16,8,0].map(b=>Math.floor(n/2**b)%256).join(".");
const validMask=m=>isIp(m)&&/^1*0*$/.test(ip2n(m).toString(2).padStart(32,"0"));
const maskLen=m=>ip2n(m).toString(2).replace(/0/g,"").length;
const netOf=(ip,m)=>n2ip((ip2n(ip)&ip2n(m))>>>0);
const sameNet=(a,b,m)=>netOf(a,m)===netOf(b,m);
const pad=(x,n)=>String(x).padEnd(n);

export {isIp, ip2n, n2ip, validMask, maskLen, netOf, sameNet, pad};
