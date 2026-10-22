// node audio.js soundtrack.wav — offline synth: original score + sound design + voiceover (vo/*.wav from vo.js), mixed and mastered.
// Everything is placed from timeline.js so picture and sound share one clock. 48 kHz, 16-bit stereo.
const fs=require('fs');const TL=require('./timeline.js');
const SR=48000,DUR=TL.DUR,N=Math.ceil((DUR+0.5)*SR),BEAT=60/TL.BPM;
const bus=()=>[new Float32Array(N),new Float32Array(N)];
const MUS=bus(),FXB=bus(),VOB=bus(),REV=bus(),DLY=bus(); // dry buses + reverb / delay sends
const MO=process.env.MUSIC_ONLY==='1',REVM=MO?bus():null; // MUSIC_ONLY=1: also write music-only.wav (music's own reverb send)
let seed=1234567;const rand=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const noise=()=>rand()*2-1;
const hz=m=>440*Math.pow(2,(m-69)/12);
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const inR=(t,a,b)=>t>=a&&t<b;
// TPT state-variable filter; call f(x,fc,q) then read f.lp / f.bp / f.hp
function svf(){let a=0,b=0;const f=(x,fc,q=0.707)=>{const g=Math.tan(Math.PI*Math.min(fc,SR*0.45)/SR),k=1/q,a1=1/(1+g*(g+k)),a2=g*a1,a3=g*a2;const v3=x-b,v1=a1*a+a2*v3,v2=b+a2*a+a3*v3;a=2*v1-a;b=2*v2-b;f.lp=v2;f.bp=v1;f.hp=x-k*v1-v2;return v2;};return f;}
// band-limited saw (polyBLEP)
function saw(){let p=rand();return inc=>{p+=inc;if(p>=1)p-=1;let v=2*p-1;if(p<inc){const x=p/inc;v-=x+x-x*x-1;}else if(p>1-inc){const x=(p-1)/inc;v-=x*x+x+x+1;}return v;};}
// write a mono generator into a stereo bus with pan and optional sends
function voice(B,t0,dur,gen,{pan=0,gain=1,rev=0,dly=0}={}){const s0=Math.round(t0*SR),n=Math.round(dur*SR),gl=gain*Math.cos((pan+1)*Math.PI/4),gr=gain*Math.sin((pan+1)*Math.PI/4);
 for(let i=0;i<n;i++){const j=s0+i;if(j<0)continue;if(j>=N)break;const v=gen(i/SR,i);if(v===0)continue;B[0][j]+=v*gl;B[1][j]+=v*gr;if(rev){REV[0][j]+=v*gl*rev;REV[1][j]+=v*gr*rev;if(REVM&&B===MUS){REVM[0][j]+=v*gl*rev;REVM[1][j]+=v*gr*rev;}}if(dly){DLY[0][j]+=v*gl*dly;DLY[1][j]+=v*gr*dly;}}}

/* ---------------- arrangement ---------------- */
// Score: intro in D minor (Dm9 Bbmaj7 Gm9 Asus4>A, tense), then F major / D minor body:
// Bbmaj9 F/A Dm9 Csus4>C (IV I vi V). End card Fmaj9 Dm9 Bbmaj9 Csus4>C9, and C9 resolves into the Dm downbeat at t=0 (loop).
const TAU=2*Math.PI,hum=()=>(rand()-0.5)*0.012;  // +-6 ms humanize
const V={Dm:[50,57,64,65,69],Bb:[46,53,57,62,65],Gm:[43,50,57,58,62],Asus:[45,52,57,62,64],A:[45,52,57,61,64],
 BbM9:[46,53,57,60,62],FA:[45,53,57,60,67],Dm9:[50,53,57,60,64],Csus:[48,53,55,60,62],C:[48,52,55,60,62],F9:[48,53,57,64,67],C9:[48,52,55,58,62]};
const A=TL.A,U=A.until,M=A.meet,REAL=A.real-0.3,NO1=A.no1,NO2=A.no2,NO3=A.no3,B2=A.brand2,MEND=B2-0.42,LP=A.loop,LB=Math.floor(LP/2)*2;
// harmony segments [t0,t1,voicing,bassRoot]; bars are 2 s (one bar of 4/4 at 120 BPM) on the absolute grid
const SEG=[];const seg=(a,b,v,r)=>{if(b>a)SEG.push([a,b,v,r]);};
[[V.Dm,38],[V.Bb,34],[V.Gm,31]].forEach(([v,r],b)=>seg(2*b,2*b+2,v,r));seg(6,7,V.Asus,33);seg(7,U,V.A,33);
{const MC=[[V.BbM9,34],[V.FA,33],[V.Dm9,38],[V.Csus,36]];
 for(let b=4;2*b<NO1;b++){const a=Math.max(2*b,M),e=Math.min(2*b+2,NO1),k=(b-4)%4;
  if(k===3){seg(a,Math.min(2*b+1,e),V.Csus,36);seg(Math.max(a,2*b+1),e,V.C,36);}else seg(a,e,...MC[k]);}}
seg(NO1,NO2,V.BbM9,34);seg(NO2,NO3,V.C,36);seg(NO3,MEND,V.Dm9,38);
seg(B2,LB-4,V.F9,41);seg(LB-4,LB-2,V.Dm9,38);seg(LB-2,LB,V.BbM9,34);seg(LB,LP,V.Csus,36);seg(LP,DUR,V.C9,36);
const segAt=t=>{let s=SEG[0];for(const x of SEG)if(x[0]<=t)s=x;return s;};
const chordAt=t=>segAt(t)[2],rootAt=t=>segAt(t)[3];
// sections
const ON=t=>t<U-0.08||(t>=M&&t<MEND)||t>=B2;               // silent 'Until now' gap and pre-logo breath
const PUNCH=t=>t>=NO1-1&&t<B2;                         // roll + three stab hits
const BUILD=t=>t>=LP;                                  // loop lift into t=0
const DIMEGAP=t=>t>=A.dime&&t<A.dime+0.4;
const IND=t=>t>=A.from&&t<A.simulate;                  // industries montage: extra energy
const LIGHT=t=>t>=REAL&&t<NO1-1;                       // tech section: lighter
const HITK=[M,NO1,NO2,NO3,B2];const nearHit=t=>HITK.some(h=>t>h-0.12&&t<h+0.3);
const kicks=[];

function kick(t,g=1){kicks.push(t);let ph=0;const f=svf();voice(MUS,t,0.45,(u)=>{ph+=(47+125*Math.exp(-u*30))/SR;f(noise(),2600,0.7);const v=Math.sin(TAU*ph)*Math.exp(-u*6.5)+f.lp*Math.exp(-u*170)*0.45;return Math.tanh(v*1.3)/1.3*0.95*g;});}
function clap(t,g=1){const f=svf(),b=svf();voice(MUS,t,0.35,(u)=>{const e=[0,0.009,0.018,0.027].reduce((s,o)=>s+(u>=o?Math.exp(-(u-o)*(o<0.025?150:15)):0),0);f(noise(),1500,1.0);b(f.bp,4500,0.7);return (f.bp*0.8+b.lp*0.2)*e*0.65*g;},{rev:0.32,pan:0.04});}
function hat(t,open,g=1,pan=0){const f=svf();voice(MUS,t,open?0.3:0.06,(u)=>{f(noise(),open?7500:9000,0.7);return f.hp*Math.exp(-u*(open?12:75))*0.25*g;},{pan,rev:open?0.1:0});}
function shaker(t,g=1){const f=svf();voice(MUS,t,0.09,(u)=>{f(noise(),6500,1.2);return f.bp*Math.min(1,u/0.006)*Math.exp(-u*45)*0.25*g;},{pan:0.35,rev:0.05});}
function snare(t,g=1){const f=svf();let ph=0;voice(MUS,t,0.25,(u)=>{ph+=(200+60*Math.exp(-u*40))/SR;f(noise(),2800,0.8);return (f.bp*0.7+Math.sin(TAU*ph)*0.4)*Math.exp(-u*18)*0.5*g;},{rev:0.25});}
// sub + a filtered saw an octave up so the line reads on small speakers
function bass(t,m,dur,g=1){const o=saw(),f=svf(),h=hz(m);let ph=0;voice(MUS,t,dur+0.03,(u)=>{const env=Math.min(1,u/0.003)*(u<dur?1:Math.exp(-(u-dur)*90));ph+=h/SR;return (Math.sin(TAU*ph)*0.9+f(o(2*h/SR),300+800*Math.exp(-u*12),0.8)*0.3)*env*0.3*g;});}
function pluck(t,m,g=1,cut=1){const o1=saw(),o2=saw(),f=svf(),h=hz(m);voice(MUS,t,0.45,(u)=>f(o1(h/SR)+o2(h*1.008/SR)*0.7,(500+4200*Math.exp(-u*18))*cut,1.0)*Math.exp(-u*8)*0.075*g,{pan:Math.sin(t*2.1)*0.5,rev:0.25,dly:0.3});}
// FM electric piano: 1:1 modulator with decaying index (bark) + 14:1 tine, velocity -> brightness and level, pitch-dependent decay
function epiano(t,m,dur,vel=0.7,g=1){const h=hz(m),k=0.6+0.05*Math.max(0,m-40),tn=h*14<16000,pan=clamp((m-66)/24,-0.45,0.45),v=vel*(0.85+0.3*rand());
 voice(MUS,t+hum(),dur+0.4,(u)=>{const rel=u<dur?1:Math.exp(-(u-dur)*14),I=v*(1.2*Math.exp(-u*7)+0.3),s=TAU*h*u;
  const c=Math.sin(s+I*Math.sin(s))+(tn?Math.sin(14*s)*Math.exp(-u*40)*0.1*v:0);return c*Math.exp(-u*k)*Math.min(1,u/0.0015)*rel*0.11*v*g;},{pan,rev:0.3,dly:0.1});}
// lead: soft FM bell (1:4) over a warm two-saw tone with delayed vibrato
function lead(t,m,dur,vel=1){const h=hz(m),o1=saw(),o2=saw(),f=svf();
 voice(MUS,t+hum()*0.5,dur+0.8,(u)=>{const hh=h*(1+0.0045*Math.sin(TAU*5.3*u)*clamp((u-0.3)/0.4)),s=1-0.3*clamp(Math.min(u,dur)/1.2);
  const env=Math.min(1,u/0.012)*s*(u<dur?1:Math.exp(-(u-dur)*7));const syn=f(o1(hh/SR)+o2(hh*1.006/SR)*0.7,hh*2.5+1500*Math.exp(-u*7),0.8);
  const bl=Math.sin(TAU*h*u+1.4*Math.exp(-u*7)*Math.sin(TAU*4*h*u))*Math.exp(-u*2.2);return (syn*0.3+bl*0.7)*env*0.25*vel;},{pan:0.08,rev:0.35,dly:0.28});}
// strings/pad: per note 3 detuned polyBLEP saws per side (wide), lowpass (cut = Hz or fn of absolute time), high-passed under the bass
function pad(t,notes,dur,cut,g=1,att=0.25,rel=1){notes.forEach(m=>{const h=hz(m);[-1,1].forEach(side=>{const dt=side<0?[-0.011,-0.0035,0.007]:[-0.007,0.0035,0.011],os=dt.map(saw),f=svf(),hp=svf();
 voice(MUS,t,dur+rel*1.6,(u)=>{const env=clamp(u/att)*(u<dur?1:Math.exp(-(u-dur)*3/rel));let v=0;for(let k=0;k<3;k++)v+=os[k](h*(1+dt[k])/SR);f(v,typeof cut==='function'?cut(t+u):cut,0.6);hp(f.lp,130,0.7);return hp.hp*env*0.022*g;},{pan:side*0.75,rev:0.45});});});}
function stab(t,notes,g=1){notes.forEach((m,ni)=>{const o=saw(),o2=saw(),f=svf(),h=hz(m+12);voice(MUS,t,0.5,(u)=>f(o(h/SR)+o2(h*1.01/SR),900+5000*Math.exp(-u*10),0.8)*Math.exp(-u*6)*0.06*g,{pan:(ni-2)*0.3,rev:0.4});});}
function swell(t0,t1,notes,g=1){const len=t1-t0;notes.forEach((m,ni)=>{const o=saw(),o2=saw(),f=svf(),h=hz(m);voice(MUS,t0,len,(u)=>{const x=u/len;return f(o(h/SR)+o2(h*1.007/SR),400+3000*x*x,0.7)*x*x*x*0.08*g;},{pan:(ni-2)*0.3,rev:0.4});});}
const fill=(tEnd,beats=1,g=1)=>{const s=BEAT/4;for(let t=Math.round((tEnd-beats*BEAT)/s)*s;t<tEnd-1e-6;t+=s)snare(t,g*(0.35+0.65*(1-(tEnd-t)/(beats*BEAT))));};
const upper=(v,lo=60,hi=79)=>v.map(m=>m+12).filter(m=>m>=lo&&m<=hi);

// intro drive (0-U): low drone, filter opening into the 'Until now' stop
{const o=saw(),o2=saw(),f=svf();voice(MUS,0,U+0.05,(u)=>{const e=clamp(u/0.02)*(u<U-0.03?1:0);const v=o(hz(38)/SR)+o2(hz(45)/SR)*0.6+Math.sin(2*Math.PI*hz(26)*u)*1.2;return f(v,160+500*clamp(u/U),1.2)*e*0.22;},{rev:0.2});}
const cut=t=>t<U?500+1900*clamp(t/U):t<M+0.5?3600:LIGHT(t)?1300+900*clamp((t-REAL)/(NO1-1-REAL)):PUNCH(t)?3000:IND(t)?3300:BUILD(t)?2600+5000*clamp((t-LP)/(DUR-LP))**2:t>=B2?3400:2900;
SEG.forEach(([a,b,v],i)=>{if(a>=MEND&&a<B2)return;const hit=a===0||a===M||PUNCH(a)||a===B2;pad(a,v,b-a,cut,a===M||a===B2?1.4:PUNCH(a)?1.2:a<U?0.8:1,hit?0.03:0.22,b===U||b===MEND||b===DUR?0.05:PUNCH(a)?0.6:1);}); // hard stops into the two breaths
swell(M-0.45,M+0.01,V.BbM9,1);  // reversed swell through the 'Until now' breath into the drop

// drums, 16th grid
for(let i=0;i*BEAT/4<DUR;i++){const t=i*BEAT/4,b16=i%4,beat=i/4;
 if(b16===0&&ON(t)&&!PUNCH(t)&&!BUILD(t)&&!DIMEGAP(t)&&!nearHit(t))kick(t,t<U?0.85+0.15*t/U:LIGHT(t)?0.85:1);
 const groove=ON(t)&&t>=M&&!PUNCH(t)&&!BUILD(t)&&!DIMEGAP(t);
 if(b16===0&&beat%2===1&&(groove&&!LIGHT(t)||(t<U&&t>=4)))clap(t,t<U?0.7:1);
 if(ON(t)&&t>=1&&!BUILD(t)&&!(t>=NO1&&t<B2)&&(!LIGHT(t)||b16%2===0))hat(t,false,(b16===2?1:0.5+0.15*(i%2))*(t<U?0.6+0.4*t/U:1)*(IND(t)?1.2:1),(i%2?0.25:-0.25));
 if(groove&&!LIGHT(t)&&b16===2)hat(t,true,IND(t)?0.75:0.55,0.15);
 if(ON(t)&&(IND(t)||(t>=A.see&&t<A.from)||(t>=B2+0.5&&!BUILD(t))))shaker(t,(b16===2?1:0.55)*(IND(t)?1:0.7));
}
HITK.forEach((t,i)=>kick(t,i===0||i===4?1.3:1.15));[NO1,NO2,NO3].forEach(t=>clap(t,1.1));
fill(Math.round(A.see/BEAT)*BEAT,1,0.8);fill(Math.floor(A.from/BEAT)*BEAT,1,0.8);
for(let k=0;k<6;k++)snare(A.dime+k*BEAT/8*1.33,0.4+0.6*k/6);
{let t=NO1-1;while(t<NO1){snare(t,0.3+0.7*(t-NO1+1));t+=t<NO1-0.3?BEAT/4:BEAT/8;}}
// loop lift: 32nd-grid snare roll from A.loop thinning 8ths -> 16ths -> 32nds, cresc. into the t=0 downbeat
for(let k=Math.ceil(LP/(BEAT/8));k*BEAT/8<DUR-1e-6;k++){const t=k*BEAT/8,x=(t-LP)/(DUR-LP);if(x<0.4?k%4===0:x<0.75?k%2===0:true)snare(t,0.3+0.8*x);}

// bass, arp (16ths), e-piano
for(let i=0;i*BEAT/4<DUR;i++){const t=i*BEAT/4,b16=i%4,v=chordAt(t),r=rootAt(t);
 if(ON(t)&&!BUILD(t)&&!(t>=NO1&&t<B2)&&b16%2===0&&!(t<M&&t>=U)){const pat=t<U?[0,0,0,12,0,0,0,12]:[0,0,12,0,0,12,0,7],j=(i/2)%8;
  if(!LIGHT(t)||j%2===0)bass(t,r+pat[j],(LIGHT(t)?BEAT:BEAT/2)-0.03,t<U?0.85:1);}
 if(ON(t)&&t>=3&&!BUILD(t)&&!(t>=NO1&&t<B2)&&!(t<M&&t>=U)){const up=v.map(m=>m+12),seq=[0,2,1,3,4,2,3,1];pluck(t,up[seq[i%8]%up.length],IND(t)?1.1:0.8,t<U?0.35+0.55*t/U:LIGHT(t)?0.6:IND(t)?1.15:0.9);}
 if(t<U-0.08&&b16%2===0){const up=upper(v,60,77),p=[0,1,2,1,3,1,2,1];epiano(t,up[p[(i/2)%8]%up.length],BEAT/2,0.35+0.45*t/U,0.9);}  // tense intro ostinato
 if(LIGHT(t)&&b16%2===0){const up=upper(v,60,81),p=[0,1,2,3,2,1,3,2];epiano(t,up[p[(i/2)%8]%up.length],BEAT*0.6,0.6);}  // tech: e-piano carries the motion
}
// e-piano chord comping (beat 1, the 'and' of 2, beat 4) through the body and end card
for(let b=4;2*b<LP;b++)[0,1.5,3].forEach((bt,j)=>{const t=2*b+bt*BEAT;if(t<M||!ON(t)||PUNCH(t)||LIGHT(t))return;upper(chordAt(t),60,79).forEach(m=>epiano(t,m,j===0?BEAT*1.4:BEAT*0.9,j===0?0.62:0.48));});
[M,B2,0].forEach(t=>upper(chordAt(t),56,79).forEach(m=>epiano(t,m,1.6,0.75)));  // chord hits on the drops (and the loop downbeat)
[NO1,NO2,NO3].forEach(t=>{stab(t,chordAt(t),1.2);upper(chordAt(t),56,79).forEach(m=>epiano(t,m,0.6,0.85));bass(t,rootAt(t),Math.min(0.75,(t===NO3?MEND:t===NO1?NO2:NO3)-t-0.05),1.1);});
[A.hospitals,A.factories,A.airports,A.warehouses,A.traffic,A.networks,A.moves].forEach((t,i)=>stab(t,chordAt(t),i===6?1.2:0.7));
// loop lift: bass pedal on C, rising C9 e-piano arpeggio in 16ths resolving into the Dm downbeat at t=0
bass(LP,36,DUR-LP-0.02,0.8);
{const ar=[60,64,67,70,72,74,76,79,82,84];let j=0;for(let k=Math.ceil(LP/(BEAT/4));k*BEAT/4<DUR-1e-6;k++,j++)epiano(k*BEAT/4,ar[Math.min(j,ar.length-1)],BEAT/2,0.45+0.04*j);}

// hook: [beat offset, midi, beats]; bars Bb F Dm C (phrase starts on a Bbmaj9 bar)
const HOOK=[[0,74,1.5],[1.5,72,0.5],[2,74,0.5],[2.5,77,1.5],[4,76,1],[5,74,0.5],[5.5,72,2.5],[8,74,1.5],[9.5,72,0.5],[10,74,0.5],[10.5,81,1.5],[12,79,1],[13,77,0.5],[13.5,79,2.5]];
const HOOKEND=[[0,81,1.5],[1.5,79,0.5],[2,77,2],[4,74,1.5],[5.5,76,0.5],[6,77,1],[7,81,1],[8,82,1.5],[9.5,81,0.5],[10,77,2],[12,79,(LP-LB)/BEAT]]; // F Dm Bb C
const phrase=(t0,notes,from,vel=1)=>notes.forEach(([bt,m,d])=>{let t=t0+bt*BEAT,e=t+d*BEAT;if(e<=from)return;t=Math.max(t,from);lead(t,m,e-t-0.04,vel);});
phrase(8,HOOK,M,1);                                   // drop: hook enters on the logo
{const bf=Math.floor(A.from/2),hb=bf-2-(((bf-6)%4)+4)%4;phrase(2*hb,HOOK,2*hb,0.9);} // returns; its high A lands on 'from' (industries)
phrase(LB-6,HOOKEND,B2,1.05);                         // end card: full statement, resolves into the loop lift

/* ---------------- sound design ---------------- */
function whoosh(t,len=0.7,g=1,dir=1){const f=svf();voice(FXB,t,len,(u)=>{const x=u/len,e=Math.sin(Math.PI*Math.pow(x,0.8));f(noise(),300+4500*Math.pow(x,1.5),1.4);return f.bp*e*0.55*g;},{pan:0,rev:0.3});
 const f2=svf();voice(FXB,t,len,(u)=>{const x=u/len;f2(noise(),500+3500*x,2);return f2.bp*Math.sin(Math.PI*x)*0.25*g;},{pan:dir*0.6});}
function impact(t,g=1){let ph=0;voice(FXB,t,3,(u)=>{ph+=(28+70*Math.exp(-u*5))/SR;return Math.sin(2*Math.PI*ph)*Math.exp(-u*1.6)*0.9*g;});
 const f=svf();voice(FXB,t,1.6,(u)=>{f(noise(),300+3000*Math.exp(-u*6),0.8);return f.lp*Math.exp(-u*5)*0.6*g;},{rev:0.6});
 [hz(74),hz(81),hz(86)].forEach((h,i)=>voice(FXB,t,2.5,(u)=>Math.sin(2*Math.PI*h*u)*Math.exp(-u*2.2)*0.035*g,{pan:(i-1)*0.5,rev:0.8}));}
function hit(t,g=1){let ph=0;voice(FXB,t,1.2,(u)=>{ph+=(48+60*Math.exp(-u*18))/SR;return Math.sin(2*Math.PI*ph)*Math.exp(-u*4.5)*0.75*g;},{rev:0.4});
 const f=svf();voice(FXB,t,0.4,(u)=>{f(noise(),1200,0.6);return f.lp*Math.exp(-u*22)*0.5*g;},{rev:0.5});
 voice(FXB,t,1.5,(u)=>(Math.sin(2*Math.PI*1318*u)*0.5+Math.sin(2*Math.PI*1976*u)*0.3)*Math.exp(-u*5)*0.05*g,{rev:0.9,pan:0.2});}
function riser(t,len,g=1){const f=svf();let ph=0;voice(FXB,t,len,(u)=>{const x=u/len;ph+=(200+1400*x*x)/SR;f(noise(),400+9000*x*x,3);return (f.bp*0.18+Math.sin(2*Math.PI*ph)*0.07)*x*x*g; /* softer, more tonal than airy */},{rev:0.5});}
function suck(t,len=0.5,g=1){const f=svf();voice(FXB,t,len,(u)=>{const x=u/len;f(noise(),8000-6500*x,1.5);return f.bp*x*x*x*0.8*g;},{rev:0.2});}
const reverse=(t,len)=>{const f=svf();voice(FXB,t,len,(u)=>{f(noise(),6000,0.6);return f.hp*Math.pow(u/len,2.5)*0.5;},{rev:0.4});};
const PENTA=[62,65,67,69,72,74,77,79];
function pop(t,k=0,g=1){const h=hz(PENTA[k%8]+12);let ph=0;voice(FXB,t,0.22,(u)=>{ph+=h*(1+0.6*Math.exp(-u*60))/SR;return Math.sin(2*Math.PI*ph)*Math.exp(-u*24)*0.16*g;},{pan:(k-3.5)*0.12,rev:0.25});}
function click(t,g=1){const f=svf();voice(FXB,t,0.05,(u)=>{f(noise(),3500,1.2);return (f.bp*0.6+Math.sin(2*Math.PI*2200*u)*0.3)*Math.exp(-u*120)*0.5*g;});}
function bell(t,m,g=1,pan=0){const h=hz(m);voice(FXB,t,2.2,(u)=>(Math.sin(2*Math.PI*h*u)+0.4*Math.sin(2*Math.PI*h*2.76*u)*Math.exp(-u*4)+0.2*Math.sin(2*Math.PI*h*5.4*u)*Math.exp(-u*8))*Math.exp(-u*2.4)*0.07*g,{pan,rev:0.6,dly:0.2});}
const chime=t=>{bell(t,81);bell(t+0.09,86,0.8,0.3);};
const shimmer=t=>[74,79,81,86,88,93].forEach((m,i)=>bell(t+i*0.07,m,0.55,(i%2?0.5:-0.5)));
const alert=t=>{bell(t,76,0.9,-0.2);bell(t+0.16,72,0.9,0.2);};
const swipe=t=>whoosh(t-0.2,0.38,0.7,(t%2)?1:-1);
function downer(t){const o=saw(),f=svf();voice(FXB,t,0.7,(u)=>{const x=u/0.7;return f(o(hz(50)*(1-0.85*x)/SR),2500*(1-x)+100,0.8)*(1-x)*0.18;},{rev:0.3});}
const KIND={hit:(t,a)=>hit(t,a?1.4:1),riser:(t,a)=>riser(t-a,a),suck:t=>suck(t,0.5),impact:(t,a)=>impact(t,a),shimmer,whoosh:(t,a)=>whoosh(t,0.7,a||1),pop:(t,a)=>pop(t,a),click,chime,alert,swipe,downer,roll:()=>{},reverse:(t,a)=>reverse(t-a,a),drone:()=>{}};
TL.FX.forEach(([t,k,a])=>KIND[k](t,a));
// typing ticks, one per character
TL.TYPE.forEach(([a,b,s])=>{for(let i=0;i<s.length;i++){const t=a+(b-a)*(i+1)/s.length;const f=svf();const pitch=2500+rand()*1500;voice(FXB,t,0.03,(u)=>{f(noise(),pitch,2);return f.bp*Math.exp(-u*200)*0.3;},{pan:(rand()-0.5)*0.4});}});

/* ---------------- voiceover: one continuous take ---------------- */
const voIv=[];
{const b=fs.readFileSync('vo/full.wav');const s=new Int16Array(b.buffer,b.byteOffset+44,(b.length-44)>>1);const n=s.length,fd=Math.round(0.006*SR),hpf=svf(),pres=svf();
 require('./words.js').forEach(([a,e])=>{const s0=a+TL.OFF,e0=e+TL.OFF,l=voIv[voIv.length-1];if(l&&s0-l[1]<0.45)l[1]=e0;else voIv.push([s0,e0]);});
 voice(VOB,TL.OFF,n/SR,(u,k)=>{let x=s[k]/32768*Math.min(1,k/fd,(n-k)/fd);hpf(x,90,0.7);x=hpf.hp;pres(x,3500,0.8);x+=pres.bp*0.25;return Math.tanh(x*2.2)/2.2*1.9;},{rev:0.05});}

/* ---------------- effects processing ---------------- */
// stereo ping-pong delay (dotted eighth)
{const d=Math.round(BEAT*0.75*SR),fb=0.38;const [L,R]=DLY;for(let i=d;i<N;i++){L[i]+=R[i-d]*fb;R[i]+=L[i-d]*fb;}for(let i=0;i<N;i++){REV[0][i]+=L[i]*0.2;REV[1][i]+=R[i]*0.2;if(REVM){REVM[0][i]+=L[i]*0.2;REVM[1][i]+=R[i]*0.2;}MUS[0][i]+=L[i]*0.5;MUS[1][i]+=R[i]*0.5;}}
// Freeverb (8 combs + 4 allpasses per side)
function freeverb(inp,spread){const k=SR/44100,CB=[1116,1188,1277,1356,1422,1491,1557,1617].map(x=>Math.round((x+spread)*k)),AP=[556,441,341,225].map(x=>Math.round((x+spread)*k));
 const out=new Float32Array(N),cb=CB.map(n=>({b:new Float32Array(n),i:0,f:0})),ap=AP.map(n=>({b:new Float32Array(n),i:0}));const room=0.86,damp=0.3;
 for(let j=0;j<N;j++){const x=inp[j]*0.015;let y=0;for(const c of cb){const o=c.b[c.i];c.f=o*(1-damp)+c.f*damp;c.b[c.i]=x+c.f*room;if(++c.i>=c.b.length)c.i=0;y+=o;}
  for(const a of ap){const o=a.b[a.i];a.b[a.i]=y+o*0.5;y=o-y;if(++a.i>=a.b.length)a.i=0;}out[j]=y;}return out;}
const RL=freeverb(REV[0],0),RR=freeverb(REV[1],23),RM=MO&&[freeverb(REVM[0],0),freeverb(REVM[1],23)];

/* ---------------- mix & master ---------------- */
// sidechain from kicks (music only), ducking under the voice (music + a little fx)
const sc=new Float32Array(N).fill(1);kicks.forEach(t=>{const s0=Math.round(t*SR);for(let i=0;i<0.3*SR&&s0+i<N;i++)sc[s0+i]=Math.min(sc[s0+i],1-0.55*Math.exp(-i/SR/0.09));});
const duck=new Float32Array(N);{let g=1;for(let i=0;i<N;i++){const t=i/SR,on=voIv.some(([a,b])=>t>=a-0.06&&t<b+0.12);const tgt=on?0.45:1;g+=(tgt-g)*(tgt<g?1/(0.03*SR):1/(0.35*SR));duck[i]=g;}}
const OUT=bus(),VOG=0.9,MOUT=MO&&bus(),NS=Math.round(DUR*SR);
for(let i=0;i<N;i++){// no master fades: the film loops; the tail past DUR is wrapped onto t=0 below
 for(let c=0;c<2;c++){const mus=MUS[c][i]*sc[i]*duck[i]*0.9,fx=FXB[c][i]*(0.55+0.45*duck[i]),rv=(c?RR:RL)[i]*duck[i];OUT[c][i]=(mus+fx+rv*0.9+VOB[c][i]*VOG);if(MO)MOUT[c][i]=MUS[c][i]*sc[i]*0.9+RM[c][i]*0.9;}}
// balance check: voice vs. (ducked) music+fx energy while the voice speaks
{let v=0,m=0;const fv=svf(),fm=svf();voIv.forEach(([a,b])=>{for(let i=Math.round(a*SR);i<Math.round(b*SR);i++){fv(VOB[0][i],300);fm(OUT[0][i]-VOB[0][i]*VOG,300);v+=(fv.hp*VOG)**2;m+=fm.hp**2;}});console.log('voice-over-bed (>300Hz) during VO: '+(10*Math.log10(v/m)).toFixed(1)+' dB');}
// seamless loop: decays/reverb rendered past DUR continue at t=0 (sample NS-1 -> 0 is continuous)
for(const B of MO?[OUT,MOUT]:[OUT])for(let c=0;c<2;c++)for(let i=NS;i<N;i++)B[c][i-NS]+=B[c][i]*0.5*(1+Math.cos(Math.PI*(i-NS)/(N-NS)));
// gain to target, soft-knee limiter
let pk=0;for(let c=0;c<2;c++)for(let i=0;i<NS;i++)pk=Math.max(pk,Math.abs(OUT[c][i]));
const G=(+process.env.GAIN||1.24)/pk*0.9;const lim=x=>{const a=Math.abs(x);return a<0.74?x:Math.sign(x)*(0.74+0.1*Math.tanh((a-0.74)/0.1));};
function writeWav(file,B){const wav=Buffer.alloc(44+NS*4);
wav.write('RIFF',0);wav.writeUInt32LE(36+NS*4,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(SR,24);wav.writeUInt32LE(SR*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(NS*4,40);
for(let i=0;i<NS;i++)for(let c=0;c<2;c++)wav.writeInt16LE(Math.round(clamp(lim(B[c][i]*G),-1,1)*32767),44+i*4+c*2);
fs.writeFileSync(file,wav);}
writeWav(process.argv[2]||'soundtrack.wav',OUT);if(MO){writeWav('music-only.wav',MOUT);console.log('wrote music-only.wav');}console.log('wrote',process.argv[2]||'soundtrack.wav',DUR+'s, raw peak',pk.toFixed(2));
