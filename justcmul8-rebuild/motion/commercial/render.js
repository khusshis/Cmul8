// node render.js out.mp4 [fps=60] [scale=2] [workers=2] [t0=0] [t1=60]  (scale 2 = 3840x2160)
// Every frame is seek(t). K subframes across a 180° shutter are blended by ffmpeg tmix (motion blur).
// The timeline is split into short chunks; a worker pool renders each chunk to segs/NNN.mp4 in its own
// browser. A crashed chunk is retried in a fresh browser, finished chunks are kept (re-run = resume).
const {chromium}=require('playwright');const {spawn,execFileSync}=require('child_process');const path=require('path');const fs=require('fs');const {pathToFileURL}=require('url');
const ffmpeg=require('ffmpeg-static');
const CHUNK=50,K=4,TRIES=4;
// GPU: headless-shell + these flags rasterizes/composites on the NVIDIA dGPU via ANGLE/D3D11 (~4x faster 4K captures
// than the SwiftShader default). Verify with SystemInfo.getInfo: glRenderer should name the NVIDIA card.
const GPU=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-zero-copy'];
// Encoder: NVENC if this ffmpeg+driver can open it (frees the CPU/RAM that libx264 at 4K ate), else libx264.
// Workers: 2 is the safe default on 16 GB RAM / 6 GB VRAM; 3 at 4K overflows VRAM (nvenc OOM, RAM spill), 4 fails outright.
const nvenc=(()=>{try{execFileSync(ffmpeg,['-loglevel','error','-f','lavfi','-i','color=s=256x256','-frames:v','1','-c:v','h264_nvenc','-f','null','-']);return true;}catch{return false;}})();
const ENC=nvenc?['-c:v','h264_nvenc','-preset','p7','-tune','hq','-rc','vbr','-cq','16','-b:v','0','-profile:v','high']
 :['-c:v','libx264','-preset','medium','-crf','16','-profile:v','high','-tune','film','-threads','2'];
(async()=>{
 const [out,fpsA='60',scA='2',wA='2',t0A='0',t1A='60']=process.argv.slice(2);
 const FPS=+fpsA,SC=+scA,NW=+wA,sub=1/(FPS*2*K),t0=+t0A,t1=+t1A;
 const F0=Math.round(t0*FPS),N=Math.round(t1*FPS)-F0,NC=Math.ceil(N/CHUNK);
 const url=pathToFileURL(path.resolve(__dirname,'scene.html')).href+'?render&sc='+SC;
 const dir=path.resolve('segs');fs.mkdirSync(dir,{recursive:true});
 const seg=c=>path.join(dir,String(c).padStart(3,'0')+'.mp4');
 const T=Date.now();let next=0,done=0;console.log('encoder:',nvenc?'h264_nvenc':'libx264');
 async function renderChunk(c){
  const a=c*CHUNK,b=Math.min(N,a+CHUNK),tmp=seg(c)+'.part.mp4';
  let ff;const br=await chromium.launch({args:['--force-color-profile=srgb',...GPU]});
  try{
   const p=await br.newPage({viewport:{width:1920*SC,height:1080*SC}});
   await p.goto(url);await p.waitForFunction(()=>window.READY);await p.evaluate(z=>document.body.style.zoom=z,SC);
   const cdp=await p.context().newCDPSession(p);
   ff=spawn(ffmpeg,['-loglevel','error','-y','-f','image2pipe','-framerate',String(FPS*K),'-c:v','mjpeg','-i','-',
     '-vf',`format=gbrp,tmix=frames=${K}:weights='1 1 1 1',select='eq(mod(n\\,${K})\\,${K-1})',setpts=N/(${FPS})/TB,format=yuv420p`,
     '-r',String(FPS),...ENC,tmp]);
   ff.stderr.on('data',d=>process.stderr.write(d));ff.stdin.on('error',()=>{}); // a dead encoder fails this chunk (retried), not the whole run
   const closed=new Promise(r=>ff.on('close',r));let dead=false;closed.then(()=>dead=true);
   for(let f=a;f<b;f++)for(let k=0;k<K;k++){const t=Math.max(0,(F0+f)/FPS+(k-1.5)*sub);await p.evaluate(t=>seek(t),t);
     const r=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:95,optimizeForSpeed:true});
     if(dead)throw new Error('encoder exited early');if(!ff.stdin.write(Buffer.from(r.data,'base64')))await Promise.race([new Promise(r=>ff.stdin.once('drain',r)),closed]);}
   ff.stdin.end();if(await closed!==0)throw new Error('ffmpeg failed on chunk '+c);
   fs.renameSync(tmp,seg(c));
  }finally{if(ff&&ff.exitCode===null)ff.kill(); // a failed try must release its .part file before the retry
   await br.close().catch(()=>{});}
 }
 await Promise.all([...Array(NW)].map(async()=>{
  while(next<NC){const c=next++;
   if(fs.existsSync(seg(c))){done++;continue;}
   for(let i=1;;i++){try{await renderChunk(c);break;}catch(e){console.log(`chunk ${c} try ${i} failed: ${e.message.split('\n')[0]}`);if(i>=TRIES)throw e;}}
   console.log(`chunk ${++done}/${NC} done  ${((Date.now()-T)/1000).toFixed(0)}s`);}}));
 fs.writeFileSync(path.join(dir,'list.txt'),[...Array(NC)].map((_,c)=>`file '${seg(c).replace(/\\/g,'/')}'`).join('\n'));
 // picture + soundtrack (from audio.js), then a 1080p sibling for the web
 fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});const vid=path.join(dir,'video.mp4'),wav=path.resolve('soundtrack.wav');
 execFileSync(ffmpeg,['-loglevel','error','-y','-f','concat','-safe','0','-i',path.join(dir,'list.txt'),'-c','copy',vid]);
 execFileSync(ffmpeg,['-loglevel','error','-y','-i',vid,'-ss',String(t0),'-t',String(t1-t0),'-i',wav,'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','320k','-shortest','-movflags','+faststart',out]);
 if(SC>1)execFileSync(ffmpeg,['-loglevel','error','-y','-i',out,'-vf','scale=1920:1080:flags=lanczos','-c:v','libx264','-preset','slow','-crf','17','-profile:v','high','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',out.replace(/4K/i,'1080p').replace(/\.mp4$/,out.match(/4K/i)?'.mp4':'-1080p.mp4')]);
 fs.rmSync(dir,{recursive:true,force:true});
 console.log('rendered',out,N,'frames in',((Date.now()-T)/1000).toFixed(0)+'s');
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
