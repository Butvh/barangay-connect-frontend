// TODO(contract): prefer the real P1 modules; fallback only when all three are absent.
const urls=['auth','api','config'].map(name=>new URL('../core/'+name+'.js',import.meta.url));
const present=await Promise.all(urls.map(async url=>{const r=await fetch(url,{method:'HEAD'});return r.ok;}));
let modules;
if(present.every(Boolean)){modules=await Promise.all(urls.map(url=>import(url.href)));}
else if(present.every(v=>!v)){const stub=await import('./resident-contract-stub.js');modules=[stub,stub,stub];console.info('TODO(contract): using isolated P2 demo adapter; Person 1 core not installed.');}
else{throw new Error('P1 integration is incomplete: auth.js, api.js and config.js must be installed together.');}
export const Auth=modules[0].Auth||modules[0].default;
export const Api=modules[1].Api||modules[1].default;
export const Config=modules[2].Config||modules[2].CONFIG||modules[2].default||modules[2];

