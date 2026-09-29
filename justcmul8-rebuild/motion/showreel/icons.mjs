import fs from 'fs';
const dir=new URL('../../node_modules/lucide-react/dist/esm/icons/',import.meta.url).href;
const names=['users','list-ordered','coffee','git-branch','armchair','log-out','play','pause','sparkles','arrow-right','check','trending-up','trending-down','clock','activity','chart-column','dices','zap','factory','truck','heart-pulse','network','car','triangle-alert','cpu'];
const out={};
for(const n of names){const m=await import(dir+n+'.mjs'); out[n]=m.__iconNode.map(([tag,a])=>`<${tag} ${Object.entries(a).filter(([k])=>k!=='key').map(([k,v])=>`${k}="${v}"`).join(' ')}/>`).join('');}
fs.writeFileSync('icons.js','window.ICONS='+JSON.stringify(out)+';');
console.log(Object.keys(out).length);
