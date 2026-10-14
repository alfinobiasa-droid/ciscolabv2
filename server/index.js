import http from "node:http";

const port=Number(process.env.PORT||8787);
const routerUrl=process.env.ROUTER_API_URL||"http://localhost:20128/v1";
const routerKey=process.env.ROUTER_API_KEY||"";
const model=process.env.AI_MODEL||"combo1";
const system=`Kamu adalah NETLAB Copilot, tutor networking dan Linux. Jawab dalam Bahasa Indonesia, jelas, ringkas, dan langkah demi langkah. Gunakan hanya evidence dari context yang diberikan; bedakan fakta dari dugaan dan tanyakan klarifikasi bila context kurang. Untuk diagnosis, sebutkan device/interface/status yang menjadi evidence lalu berikan command read-only atau command simulator yang relevan. Jangan mengaku telah mengubah perangkat, jangan meminta credential, dan jangan menjalankan aksi otomatis. Jika user meminta konfigurasi, jelaskan preview dan minta konfirmasi sebelum aksi nyata.`;
const send=(res,status,data)=>{res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Access-Control-Allow-Origin":"http://localhost:5173"});res.end(JSON.stringify(data))};
const read=req=>new Promise((resolve,reject)=>{let body="";req.on("data",c=>{body+=c;if(body.length>1e6)reject(new Error("Request too large"))});req.on("end",()=>{try{resolve(JSON.parse(body||"{}"))}catch(e){reject(e)}});req.on("error",reject)});
const server=http.createServer(async(req,res)=>{
 if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"http://localhost:5173","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS"});return res.end()}
 if(req.method!=="POST"||req.url!=="/api/copilot")return send(res,404,{error:"Not found"});
 try{
  if(!routerKey)return send(res,503,{error:"ROUTER_API_KEY is not configured"});
  const {message,context={},history=[]}=await read(req);
  if(typeof message!=="string"||!message.trim()||message.length>4000)return send(res,400,{error:"message must be 1-4000 characters"});
  if(!Array.isArray(history)||history.length>30)return send(res,400,{error:"history is invalid or too long"});
  if(context===null||typeof context!=="object")return send(res,400,{error:"context is invalid"});
  const messages=[...history.slice(-12).filter(x=>x&&x.role&&typeof x.text==="string").map(x=>({role:x.role==="assistant"?"assistant":"user",content:x.text.slice(0,6000)})),{role:"user",content:`Network context:\n${JSON.stringify(context).slice(0,18000)}\n\nQuestion:\n${message.trim()}`}];
  const r=await fetch(`${routerUrl.replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${routerKey}`},body:JSON.stringify({model,messages:[{role:"system",content:system},...messages],temperature:.2,max_tokens:1200})});
  const data=await r.json();if(!r.ok)return send(res,r.status,{error:data.error?.message||"Router request failed"});
  return send(res,200,{text:data.choices?.[0]?.message?.content||"No response from model.",source:"9router"});
 }catch(e){return send(res,500,{error:e.message||"Copilot failed"})}
});
server.listen(port,()=>console.log(`NETLAB Copilot API listening on http://localhost:${port}`));
