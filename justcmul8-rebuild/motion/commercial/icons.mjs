import fs from 'fs';
const dir=new URL('../../node_modules/lucide-react/dist/esm/icons/',import.meta.url).href;
const names=["users", "list-ordered", "git-branch", "log-out", "play", "pause", "sparkles", "arrow-right", "check", "clock", "activity", "dices", "zap", "factory", "truck", "heart-pulse", "network", "car", "triangle-alert", "cpu", "plane", "shopping-cart", "warehouse", "server", "stethoscope", "bed-double", "door-open", "code", "globe", "bot", "gauge", "trending-down", "trending-up", "droplets", "shield-check", "wand-sparkles", "mouse-pointer-2", "user-round", "layers", "timer", "cloud", "package", "house", "chevron-right", "chevron-down", "pencil", "undo-2", "redo-2", "square", "share-2", "search", "panel-left", "plus", "minus", "maximize", "send", "circle-alert", "lock", "x", "ship", "utensils", "landmark", "headset", "pill", "ferris-wheel", "box", "boxes", "rotate-cw", "grip-vertical", "list-filter", "dollar-sign", "circle-check", "bell", "user", "hourglass", "arrow-up-right", "flame"];
const out={};
for(const n of names){const m=await import(dir+n+'.mjs'); out[n]=m.__iconNode.map(([tag,a])=>`<${tag} ${Object.entries(a).filter(([k])=>k!=='key').map(([k,v])=>`${k}="${v}"`).join(' ')}/>`).join('');}
fs.writeFileSync('icons.js','window.ICONS='+JSON.stringify(out)+';');
console.log(Object.keys(out).length);
