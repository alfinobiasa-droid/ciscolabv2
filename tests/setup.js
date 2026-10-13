if(typeof localStorage!=="undefined"){
  const data=new Map();
  Object.defineProperty(globalThis,"localStorage",{value:{
    getItem:k=>data.has(k)?data.get(k):null,
    setItem:(k,v)=>data.set(String(k),String(v)),
    removeItem:k=>data.delete(k),
    clear:()=>data.clear(),
    key:i=>[...data.keys()][i]??null,
    get length(){return data.size}
  },configurable:true});
}
