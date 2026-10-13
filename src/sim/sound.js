import {store} from "../core.js";
let ctx=null;
const audio=()=>{if(!ctx){const A=window.AudioContext||window.webkitAudioContext;if(A)ctx=new A()}if(ctx?.state==="suspended")ctx.resume();return ctx};
const tone=(freq,duration,type="square")=>{const c=audio();if(!c)return;const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.025,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+duration)};
const SOUND={get enabled(){return store.get("sound_fx",true)},toggle(){const v=!this.enabled;store.set("sound_fx",v);return v},key(){if(this.enabled)tone(320+Math.random()*120,.035)},success(){if(this.enabled){tone(523,.08,"triangle");setTimeout(()=>tone(659,.1,"triangle"),70)}},error(){if(this.enabled)tone(150,.12,"sawtooth")}};
export {SOUND};
