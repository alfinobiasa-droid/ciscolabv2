import {esc, store} from "../core.js";
import {context, history} from "../ai/context.js";
import {answer} from "../ai/provider.js";

const starters=["Is my network healthy?","Explain this topology","Why is my link down?","How do I verify VLANs?"];
function mountCopilot({container,contextProvider=context}){
 let chat=history().filter(x=>x&&typeof x.text==="string").slice(-30),busy=false,lastError="";
 const save=()=>store.set("copilotChat",chat.slice(-30).map(x=>({role:x.role,text:String(x.text).slice(0,6000),time:x.time||Date.now()})));
 const render=()=>{const c=contextProvider();container.innerHTML=`<aside class="copilot"><header class="copilot-head"><div><b>NETLAB Copilot</b><span class="copilot-status"><i></i> ${busy?"Thinking…":lastError?"Local fallback":"Connected via 9Router"}</span></div><button class="copilot-clear" data-copilot-clear aria-label="Clear chat">Clear</button></header><div class="copilot-context"><span>${c.devices.length} devices</span><span>${c.alerts} alerts</span><span>Current: ${esc(c.page)}</span></div><div class="copilot-messages" role="log" aria-live="polite">${chat.length?chat.map(x=>`<div class="copilot-msg ${x.role}"><span>${x.role==="assistant"?"AI":"You"}</span><p>${esc(x.text).replace(/\n/g,"<br>")}</p></div>`).join(""):`<div class="copilot-welcome"><div class="copilot-orb">✦</div><h2>How can I help?</h2><p>Ask about your topology, device health, or a networking concept.</p><div class="copilot-starters">${starters.map(x=>`<button data-copilot-prompt="${esc(x)}">${esc(x)}</button>`).join("")}</div></div>`}</div><form class="copilot-form"><textarea data-copilot-input ${busy?"disabled":""} rows="1" placeholder="Ask about your network…" aria-label="Ask NETLAB Copilot"></textarea><button class="act" ${busy?"disabled":""} type="submit" aria-label="Send">↑</button></form><small class="copilot-note">AI membaca context simulator. Tidak ada perangkat yang diubah otomatis.</small></aside>`;const box=container.querySelector(".copilot-messages");if(box)box.scrollTop=box.scrollHeight};
 const send=async text=>{if(busy||!text.trim())return;const clean=text.trim();busy=true;lastError="";chat.push({role:"user",text:clean,time:Date.now()});chat.push({role:"assistant",text:"Thinking…",time:Date.now()});save();render();const result=await answer({message:clean,context:contextProvider(),history:chat.slice(0,-1)});chat[chat.length-1]={role:"assistant",text:result.text,time:Date.now()};busy=false;lastError=result.source==="local"||result.source==="error"?result.error||"fallback":"";save();render()};
 container.addEventListener("click",e=>{const p=e.target.closest("[data-copilot-prompt]");if(p)send(p.dataset.copilotPrompt);if(e.target.closest("[data-copilot-clear]")){chat=[];lastError="";save();render()}});
 container.addEventListener("submit",e=>{if(!e.target.closest(".copilot-form"))return;e.preventDefault();const input=container.querySelector("[data-copilot-input]");send(input.value)});
 container.addEventListener("keydown",e=>{const input=e.target.closest("[data-copilot-input]");if(input&&e.key==="Enter"&&!e.shiftKey){e.preventDefault();input.form.requestSubmit()}});
 render();
}
export {mountCopilot};
