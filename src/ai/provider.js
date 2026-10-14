import {answer as mockAnswer} from "./mock.js";

async function answer({message,context,history,signal}={}){
 const controller=signal?null:new AbortController();
 const timer=controller?setTimeout(()=>controller.abort(),30000):null;
 try{
  const r=await fetch("/api/copilot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message,context,history}),signal:signal||controller.signal});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||`Copilot request failed (${r.status})`);
  return {text:String(data.text||"No response from model."),source:data.source||"9router"};
 }catch(e){
  if(e.name==="AbortError")return {text:"Permintaan AI terlalu lama. Periksa 9Router lalu coba lagi.",source:"error",error:"timeout"};
  return {text:mockAnswer({message,context}),source:"local",error:e.message};
 }finally{if(timer)clearTimeout(timer)}
}
export {answer};
