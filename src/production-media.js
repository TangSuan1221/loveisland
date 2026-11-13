// Keep original captured stills out of JSON gameplay saves. No network services.
export function createMediaStore(onReady=()=>{},onError=()=>{}){
 const memory=new Map(),pending=new Set();let dbPromise;
 const db=()=>dbPromise??=new Promise((resolve,reject)=>{const r=indexedDB.open('ratings-tyrant-footage',1);r.onupgradeneeded=()=>r.result.createObjectStore('stills');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 function trim(){while(memory.size>500)memory.delete(memory.keys().next().value);}
 return{capture(key,data){const ref='media:'+key;memory.set(ref,data);trim();db().then(d=>new Promise((resolve,reject)=>{const tx=d.transaction('stills','readwrite');tx.objectStore('stills').put(data,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);})).catch(onError);return ref;},resolve(ref){if(!ref?.startsWith('media:'))return ref||'';if(memory.has(ref))return memory.get(ref);if(!pending.has(ref)){pending.add(ref);db().then(d=>new Promise((resolve,reject)=>{const r=d.transaction('stills').objectStore('stills').get(ref.slice(6));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);})).then(value=>{memory.set(ref,value||'');trim();onReady();}).catch(onError).finally(()=>pending.delete(ref));}return '';}};
}
