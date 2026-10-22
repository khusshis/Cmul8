// Single source of truth for the 60s spot. The voiceover is one continuous take (vo/full.wav, words.js from vo.py);
// every cut and sound cue is anchored to the moment a word is spoken. Loaded by scene.html and audio.js.
(function(){
const WORDS=typeof module!=='undefined'?require('./words.js'):window.WORDS;
const OFF=0.4; // voice starts 0.4s in, after the opening hit
const norm=s=>s.replace(/[^\w]/g,'').toLowerCase();
// time (s) the n-th occurrence of a word is spoken (0-based), so cues survive a re-recorded voiceover
const W=(w,n=0)=>{let k=0;for(const [a,,x] of WORDS){if(norm(x)!==norm(w))continue;if(k++===n)return a+OFF;}throw new Error('word not in VO: '+w+' #'+n);};
const A={every:W('Every'),breaking:W('breaking'),point:W('point'),queues:W('Queues'),machines:W('machines'),idle:W('idle'),costs:W('costs'),spiral:W('spiral'),long:W('long'),coming:W('coming'),
 until:W('Until'),now:W('now'),meet:W('Meet'),brand1:W('Just',0),describe:W('describe'),english:W('English'),ai:W('AI'),builds:W('builds'),seconds:W('seconds'),
 need:W('Need'),ask:W('ask'),rebuilds:W('rebuilds'),instantly:W('instantly'),hit:W('Hit'),run:W('run'),patient:W('patient'),order:W('order'),machine:W('machine'),time1:W('time',0),
 pinpoints:W('pinpoints'),bottleneck:W('bottleneck'),shows:W('shows'),fix:W('fix'),see:W('See'),impact:W('impact'),before:W('before',1),dime:W('dime'),dashboards:W('dashboards'),
 thousand:W('thousand'),monte:W('Monte'),decision:W('decision'),share:W('Share'),export:W('export'),from:W('From'),hospitals:W('hospitals'),factories:W('factories'),airports:W('airports'),warehouses:W('warehouses'),
 traffic:W('traffic'),networks:W('networks'),moves:W('moves'),simulate:W('simulate',1),real:W('real',1),python:W('Python'),browser:W('browser'),built:W('built'),team:W('team'),time2:W('time',1),
 no1:W('No',0),no2:W('No',1),no3:W('No',2),brand2:W('Just',3),start:W('Start'),free:W('free')};
A.loop=58.95; // the camera whips back to the opening frame so the last frame flows into the first
const TL={BPM:120,DUR:60,OFF,W,A,
 // prompts typed into the AI panel: [start, end, text]
 TYPE:[[A.describe+0.15,A.ai-0.55,'Hospital ER: patients get triaged, wait for 3 doctors, then go to a ward or home'],[A.need+0.3,A.rebuilds-0.75,'Add a fast-track lane for minor cases']],
 SEND:[A.ai-0.38,A.rebuilds-0.55]};
TL.POP1=[0,1,2,3,4,5,6].map(i=>A.ai+0.2+i*0.16); // blocks landing on the canvas
TL.FX_ALL=[
 [0,'impact',0.9],[A.every,'hit'],[A.breaking,'hit'],[A.point,'impact',0.8],
 [A.queues-0.2,'whoosh'],[A.queues,'hit'],[A.machines-0.2,'whoosh'],[A.idle,'hit'],[A.costs-0.2,'whoosh'],[A.spiral,'hit'],[A.long-0.15,'whoosh',1.2],[A.until,'riser',1.5],
 [A.until,'impact',0.7],[A.meet-0.45,'suck'],[A.meet,'impact',1.3],[A.meet+0.05,'shimmer'],
 [A.describe-0.5,'whoosh'],[TL.SEND[0],'click'],[A.ai-0.15,'whoosh',1.2],...TL.POP1.map((t,i)=>[t,'pop',i]),[A.seconds,'chime'],
 [A.need-0.25,'whoosh'],[TL.SEND[1],'click'],[A.rebuilds-0.35,'whoosh'],[A.rebuilds,'pop',3],[A.rebuilds+0.18,'pop',5],[A.instantly,'chime'],
 [A.hit-0.35,'whoosh'],[A.run-0.04,'click'],[A.run,'impact',0.7],[A.patient,'pop',2],[A.order,'pop',4],[A.machine,'pop',6],[A.time1-0.25,'whoosh'],
 [A.bottleneck,'alert'],[A.shows,'pop',3],[A.fix-0.04,'click'],[A.fix+0.05,'chime'],
 [A.see-0.55,'whoosh',1.4],[A.see,'pop',0],[A.see+0.08,'pop',2],[A.see+0.16,'pop',4],[A.impact,'hit'],[A.before,'whoosh'],[A.dime,'impact',0.6],[A.dashboards,'pop',5],[A.share-0.3,'whoosh'],[A.share,'pop',3],[A.export,'pop',6],[A.export+0.1,'chime'],[A.thousand-0.1,'whoosh'],[A.from,'riser',1.1],
 [A.from-0.25,'impact',0.8],[A.hospitals,'swipe'],[A.factories,'swipe'],[A.airports,'swipe'],[A.warehouses,'swipe'],[A.traffic,'swipe'],[A.networks,'swipe'],
 [(A.hospitals+A.factories)/2,'swipe'],[(A.factories+A.airports)/2,'swipe'],[(A.airports+A.warehouses)/2,'swipe'],[(A.warehouses+A.traffic)/2,'swipe'],
 [A.moves-0.15,'impact',0.9],[A.simulate,'hit'],
 [A.real-0.3,'whoosh',1.3],[A.browser-0.6,'whoosh'],[A.browser,'pop',4],[A.built-0.2,'whoosh'],[A.team,'pop',2],[A.team+0.12,'pop',4],[A.team+0.24,'pop',6],[A.no1,'riser',1.3],
 [A.no1,'impact',1],[A.no2,'impact',0.9],[A.no3,'impact',1.1],[A.brand2-0.45,'suck'],[A.brand2,'impact',1.4],[A.brand2+0.05,'shimmer'],
 [A.start,'pop',3],[A.start+0.1,'pop',5],[A.start+0.2,'pop',7],[A.free+0.75,'click'],[A.free+0.8,'chime'],[A.loop,'whoosh',1.5],[60,'riser',1.4],
];
// no swooshes on camera moves: they were distracting and repetitive; music + motion carry the transitions
TL.FX=TL.FX_ALL.filter(f=>f[1]!=='whoosh'&&f[1]!=='swipe'&&!(f[1]==='riser'&&Math.abs(f[0]-A.from)<0.01));
if(typeof module!=='undefined')module.exports=TL;else window.TL=TL;
})();
