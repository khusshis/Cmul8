// node stills.js t1 t2 ...  -> stills/t.png at 1080p
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');const {pathToFileURL}=require('url');
(async()=>{fs.mkdirSync('stills',{recursive:true});
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto(pathToFileURL(path.resolve('scene.html')).href+'?render');await p.waitForFunction(()=>window.READY);
 for(const t of process.argv.slice(2)){await p.evaluate(t=>seek(t),+t);await p.screenshot({path:`stills/${t}.png`});}
 console.log(errs.length?errs.join('\n'):'ok');await b.close();})();
