import {store} from "../core.js";
const SAFE=["xp","streak","progress","qstats","quizHistory","labs","subnet_best","subnet_stats","cert_name","terminal_theme","sound_fx"];
const snapshot=()=>Object.fromEntries(SAFE.map(k=>[k,store.get(k,null)]).filter(([,v])=>v!==null));
const configured=()=>Boolean(import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_ANON_KEY);
const localRank=()=>[{name:store.get("cert_name","Local learner")||"Local learner",xp:store.get("xp",0)}];
export {SAFE,snapshot,configured,localRank};
