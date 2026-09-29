// node render.js out.mp4 [fps=60] [scale=2] [workers=4] [t0=0] [t1=20]
// Every frame is seek(t). K subframes across a 180° shutter are blended by ffmpeg tmix (motion blur).
// The timeline is split into short chunks; a worker pool renders each chunk to segs/NNN.mp4 in its own
// browser. A crashed chunk is retried in a fresh browser, finished chunks are kept (re-run = resume).
const {chromium}=require('playwright');const {spawn,execFileSync}=require('child_process');const path=require('path');const fs=require('fs');const {pathToFileURL}=require('url');
const ffmpeg=require('ffmpeg-static');
const CHUNK=50,K=4,TRIES=4;
(async()=>{
 const [out,fpsA='60',scA='2',wA='4',t0A='0',t1A='20']=process.argv.slice(2);
 const FPS=+fpsA,SC=+scA,NW=+wA,sub=1/(FPS*2*K),t0=+t0A,t1=+t1A;
 const F0=Math.round(t0*FPS),N=Math.round(t1*FPS)-F0,NC=Math.ceil(N/CHUNK);
 const url=pathToFileURL(path.resolve(__dirname,'scene.html')).href+'?render';
 const dir=path.resolve('segs');fs.mkdirSync(dir,{recursive:true});
 const seg=c=>path.join(dir,String(c).padStart(3,'0')+'.mp4');
 const T=Date.now();let next=0,done=0;
 async function renderChunk(c){
  const a=c*CHUNK,b=Math.min(N,a+CHUNK),tmp=seg(c)+'.part.mp4';
  const br=await chromium.launch({args:['--force-color-profile=srgb']});
  try{
   const p=await br.newPage({viewport:{width:1920*SC,height:1080*SC}});
   await p.goto(url);await p.waitForFunction(()=>window.READY);await p.evaluate(z=>document.body.style.zoom=z,SC);
   const cdp=await p.context().newCDPSession(p);
   const ff=spawn(ffmpeg,['-loglevel','error','-y','-f','image2pipe','-framerate',String(FPS*K),'-c:v','mjpeg','-i','-',
     '-vf',`format=gbrp,tmix=frames=${K}:weights='1 1 1 1',select='eq(mod(n\\,${K})\\,${K-1})',setpts=N/(${FPS})/TB,format=yuv420p`,
     '-r',String(FPS),'-c:v','libx264','-preset','slow','-crf','14','-profile:v','high','-tune','film','-threads','3',tmp]);
   ff.stderr.on('data',d=>process.stderr.write(d));
   const closed=new Promise(r=>ff.on('close',r));
   for(let f=a;f<b;f++)for(let k=0;k<K;k++){const t=Math.max(0,(F0+f)/FPS+(k-1.5)*sub);await p.evaluate(t=>seek(t),t);
     const r=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:95,optimizeForSpeed:true});
     if(!ff.stdin.write(Buffer.from(r.data,'base64')))await new Promise(r=>ff.stdin.once('drain',r));}
   ff.stdin.end();if(await closed!==0)throw new Error('ffmpeg failed on chunk '+c);
   fs.renameSync(tmp,seg(c));
  }finally{await br.close().catch(()=>{});}
 }
 await Promise.all([...Array(NW)].map(async()=>{
  while(next<NC){const c=next++;
   if(fs.existsSync(seg(c))){done++;continue;}
   for(let i=1;;i++){try{await renderChunk(c);break;}catch(e){console.log(`chunk ${c} try ${i} failed: ${e.message.split('\n')[0]}`);if(i>=TRIES)throw e;}}
   console.log(`chunk ${++done}/${NC} done  ${((Date.now()-T)/1000).toFixed(0)}s`);}}));
 fs.writeFileSync(path.join(dir,'list.txt'),[...Array(NC)].map((_,c)=>`file '${seg(c).replace(/\\/g,'/')}'`).join('\n'));
 execFileSync(ffmpeg,['-loglevel','error','-y','-f','concat','-safe','0','-i',path.join(dir,'list.txt'),'-c','copy','-movflags','+faststart',out]);
 fs.rmSync(dir,{recursive:true,force:true});
 console.log('rendered',out,N,'frames in',((Date.now()-T)/1000).toFixed(0)+'s');
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
