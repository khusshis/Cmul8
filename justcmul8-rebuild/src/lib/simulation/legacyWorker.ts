/// <reference lib="webworker" />
/**
 * worker.ts — Discrete-Event Simulation engine running in a Web Worker.
 *
 * Architecture: CPS (Continuation-Passing Style) event loop.
 * - MinHeap EventQueue orders events by (simTime, insertionSeq)
 * - DESResource handles capacity + priority queueing + preemption + breakdowns
 * - DESContainer handles continuous level with put/get waiters
 * - DESStore handles typed item buffer (SimPy Store)
 * - GraphSimulator translates SimGraph nodes into running DES processes
 *
 * Message protocol:
 *   IN:  { type:'start', params } | { type:'pause' } | { type:'resume' } | { type:'stop' }
 *   OUT: { type:'tick', data:SimTick } | { type:'complete', data:SimResult } | { type:'error', message }
 */

import type {
  SimParams, SimTick, SimResult, SimLog, NodeStats,
  SimGraph, SimNode, SimEdge,
  SourceParams, QueueParams, ResourceParams, ServiceParams,
  DecisionParams, ContainerParams, ChannelParams,
} from "./types";
import { sampleDistribution } from "./distributions";

// ─── Message Types ────────────────────────────────────────────────────────────
type InMsg  = { type:"start";params:SimParams }|{type:"pause"}|{type:"resume"}|{type:"stop"}|{type:"set_speed";multiplier:number};
type OutMsg = { type:"tick";data:SimTick }|{ type:"complete";data:SimResult }|{ type:"error";message:string };

// ─── Min-Heap Event Queue ─────────────────────────────────────────────────────
interface QueuedEvent { time:number; seq:number; cb:()=>void; }
class EventQueue {
  private h: QueuedEvent[] = [];
  private s = 0;
  push(time:number, cb:()=>void){ const e={time,seq:this.s++,cb}; this.h.push(e); this.up(this.h.length-1); }
  pop():QueuedEvent|undefined{
    if(!this.h.length) return;
    const r=this.h[0]; const l=this.h.pop()!;
    if(this.h.length){ this.h[0]=l; this.dn(0); }
    return r;
  }
  peek():QueuedEvent|undefined{ return this.h[0]; }
  get size(){ return this.h.length; }
  private lt(a:number,b:number){ const ea=this.h[a],eb=this.h[b]; return ea.time<eb.time||(ea.time===eb.time&&ea.seq<eb.seq); }
  private up(i:number){ while(i>0){const p=(i-1)>>1; if(this.lt(i,p)){[this.h[i],this.h[p]]=[this.h[p],this.h[i]];i=p;}else break;} }
  private dn(i:number){ const n=this.h.length; while(true){let m=i,l=2*i+1,r=2*i+2; if(l<n&&this.lt(l,m))m=l; if(r<n&&this.lt(r,m))m=r; if(m===i)break; [this.h[i],this.h[m]]=[this.h[m],this.h[i]]; i=m; } }
}

// ─── DES Resource ─────────────────────────────────────────────────────────────
interface ResReq { entityId:number; priority:number; onGranted:()=>void; alive:boolean; }
class DESResource {
  users:ResReq[]=[];
  waiting:ResReq[]=[];
  broken=false;
  constructor(readonly capacity:number){}
  request(entityId:number,priority:number,onGranted:()=>void):ResReq{
    const req:ResReq={entityId,priority,onGranted,alive:true};
    if(!this.broken && this.users.length<this.capacity){ this.users.push(req); onGranted(); }
    else { const i=this.waiting.findIndex(r=>r.priority>priority); i<0?this.waiting.push(req):this.waiting.splice(i,0,req); }
    return req;
  }
  release(req:ResReq){
    this.users=this.users.filter(r=>r!==req);
    this.tryNext();
  }
  renege(req:ResReq):boolean{
    const i=this.waiting.indexOf(req); if(i<0)return false;
    req.alive=false; this.waiting.splice(i,1); return true;
  }
  breakdown(){ this.broken=true; }
  repair(){
    this.broken=false;
    while(this.users.length<this.capacity && this.waiting.length){
      const req=this.waiting.shift()!;
      if(req.alive){ this.users.push(req); req.onGranted(); }
    }
  }
  private tryNext(){
    while(this.users.length<this.capacity && this.waiting.length && !this.broken){
      const req=this.waiting.shift()!;
      if(req.alive){ this.users.push(req); req.onGranted(); }
    }
  }
}

// ─── DES Container ────────────────────────────────────────────────────────────
interface Waiter{ amount:number; cb:()=>void; }
class DESContainer {
  level:number;
  private getQ:Waiter[]=[]; private putQ:Waiter[]=[];
  constructor(readonly capacity:number, init:number){ this.level=init; }
  put(amount:number,cb:()=>void){
    if(this.level+amount<=this.capacity){ this.level+=amount; cb(); this.flushGet(); }
    else { this.putQ.push({amount,cb:()=>{this.level+=amount;cb();this.flushGet();}}); }
  }
  get(amount:number,cb:()=>void){
    if(this.level>=amount){ this.level-=amount; cb(); this.flushPut(); }
    else { this.getQ.push({amount,cb:()=>{this.level-=amount;cb();this.flushPut();}}); }
  }
  private flushGet(){ while(this.getQ.length&&this.level>=this.getQ[0].amount){ const w=this.getQ.shift()!; w.cb(); } }
  private flushPut(){ while(this.putQ.length&&this.level+this.putQ[0].amount<=this.capacity){ const w=this.putQ.shift()!; w.cb(); } }
}

// ─── DES Store ────────────────────────────────────────────────────────────────
class DESStore {
  items:unknown[]=[]; private getQ:Array<(item:unknown)=>void>=[]; private putQ:Array<{item:unknown;cb:()=>void}>=[];
  constructor(readonly capacity:number){}
  put(item:unknown,cb:()=>void){
    if(this.items.length<this.capacity){ this.items.push(item); cb(); this.flushGet(); }
    else { this.putQ.push({item,cb}); }
  }
  get(cb:(item:unknown)=>void){
    if(this.items.length){ cb(this.items.shift()!); this.flushPut(); }
    else { this.getQ.push(cb); }
  }
  private flushGet(){ while(this.getQ.length&&this.items.length){ this.getQ.shift()!(this.items.shift()!); } }
  private flushPut(){ while(this.putQ.length&&this.items.length<this.capacity){ const{item,cb}=this.putQ.shift()!; this.items.push(item); cb(); } }
}

// ─── Node Statistics Tracker ──────────────────────────────────────────────────
interface NStats {
  label:string; nodeType:string;
  in:number; out:number; depth:number;
  busyStart:number|null; busyTime:number;
  waits:number[]; services:number[];
  level?:number;
  reneged:number; broken:number; downtime:number; downStart:number|null;
  dropped:number; latencies:number[];
}
function makeNStats(n:SimNode):NStats{
  return {label:n.label,nodeType:n.nodeType,in:0,out:0,depth:0,busyStart:null,busyTime:0,waits:[],services:[],reneged:0,broken:0,downtime:0,downStart:null,dropped:0,latencies:[]};
}
function buildNodeStats(t:NStats,now:number):NodeStats{
  const busyTime=t.busyTime+(t.busyStart!=null?now-t.busyStart:0);
  return {
    nodeId:"", nodeType:t.nodeType as any, label:t.label,
    entitiesIn:t.in, entitiesOut:t.out, currentDepth:t.depth,
    utilization: t.in>0 ? Math.min(1,busyTime/Math.max(now,1)) : 0,
    avgWaitTime: t.waits.length ? t.waits.reduce((a,b)=>a+b,0)/t.waits.length : 0,
    avgServiceTime: t.services.length ? t.services.reduce((a,b)=>a+b,0)/t.services.length : 0,
    level: t.level,
    renegeCount: t.reneged, breakdownCount: t.broken, totalDowntime: t.downtime,
    droppedCount: t.dropped,
    avgLatency: t.latencies.length ? t.latencies.reduce((a,b)=>a+b,0)/t.latencies.length : undefined,
    lateCount: undefined,
  };
}

// ─── Graph Simulator ──────────────────────────────────────────────────────────
class GraphSimulator {
  private eq = new EventQueue();
  private now = 0;
  private logs: SimLog[] = [];
  private timeline: Array<{simTime:number;completed:number;depth:Record<string,number>}> = [];
  private totalArrived = 0;
  private totalCompleted = 0;
  private entityCounter = 0;

  // Node objects keyed by node id
  private resources  = new Map<string,DESResource>();
  private containers = new Map<string,DESContainer>();
  private stores     = new Map<string,DESStore>();
  private stats      = new Map<string,NStats>();

  // Graph helpers
  private nodeMap = new Map<string,SimNode>();
  private outEdges = new Map<string,SimEdge[]>(); // source → [edges]

  constructor(private params: SimParams) {}

  // ── Build phase ──────────────────────────────────────────────────────────────
  build(){
    const { graph } = this.params;
    for(const n of graph.nodes){
      this.nodeMap.set(n.id,n);
      this.outEdges.set(n.id,[]);
      this.stats.set(n.id, makeNStats(n));
      this.buildNodeObj(n);
    }
    for(const e of graph.edges){
      this.outEdges.get(e.source)?.push(e);
    }
  }

  private buildNodeObj(n:SimNode){
    const p = n.params as any;
    switch(n.nodeType){
      case "resource":
      case "priority_resource":{
        const rp = p as ResourceParams;
        const res = new DESResource(rp.capacity??1);
        this.resources.set(n.id,res);
        // Breakdown process
        if(rp.meanTimeBetweenFailures){
          const triggerBreakdown=()=>{
            const ttf=sampleDistribution("exponential",rp.meanTimeBetweenFailures!,0);
            this.eq.push(this.now+ttf,()=>{
              const st=this.stats.get(n.id)!;
              st.broken++; st.downStart=this.now;
              res.breakdown();
              this.addLog(0,n.id,n.label,"breakdown");
              const ttr=sampleDistribution(rp.repairDistribution??"exponential",rp.repairTimeMean??1,0);
              this.eq.push(this.now+ttr,()=>{
                const s2=this.stats.get(n.id)!;
                s2.downtime+=(this.now-(s2.downStart??this.now));
                s2.downStart=null;
                res.repair();
                this.addLog(0,n.id,n.label,"repaired");
                triggerBreakdown();
              });
            });
          };
          triggerBreakdown();
        }
        break;
      }
      case "container":{
        const cp=p as ContainerParams;
        this.containers.set(n.id,new DESContainer(cp.capacity??1000,cp.initialLevel??0));
        break;
      }
      case "store":
      case "channel":{
        const cap=(p.capacity??p.bufferCapacity??-1);
        this.stores.set(n.id,new DESStore(cap<0?999999:cap));
        break;
      }
    }
  }

  // ── Start source processes ────────────────────────────────────────────────────
  startSources(){
    for(const n of this.params.graph.nodes){
      if(n.nodeType==="source"){
        const sp=n.params as SourceParams;
        const spawnNext=()=>{
          if(sp.maxEntities && this.totalArrived>=sp.maxEntities) return;
          const iat=sampleDistribution(sp.distribution,1/sp.arrivalRate,0);
          this.eq.push(this.now+iat,()=>{
            const eid=++this.entityCounter;
            this.totalArrived++;
            this.addLog(eid,n.id,n.label,"arrived");
            const st=this.stats.get(n.id)!; st.in++; st.depth++;
            this.routeEntity(eid,n.id,this.now,()=>{ st.depth--; });
            if(!sp.maxEntities || this.totalArrived<sp.maxEntities) spawnNext();
          });
        };
        spawnNext();
      }
    }
  }

  // ── Entity routing ────────────────────────────────────────────────────────────
  private routeEntity(eid:number, fromId:string, arrivalTime:number, onDone:()=>void){
    const edges=this.outEdges.get(fromId)??[];
    if(!edges.length){ onDone(); return; }
    const node=this.nodeMap.get(fromId)!;

    if(node.nodeType==="decision"){
      const dp=node.params as DecisionParams;
      const r=Math.random(); let cum=0;
      for(const route of dp.routes){
        cum+=route.probability;
        if(r<=cum){
          const target=this.nodeMap.get(route.targetId);
          if(target) this.processAtNode(eid,target,arrivalTime,onDone);
          return;
        }
      }
      // fallback: first edge
      const target=this.nodeMap.get(edges[0].target);
      if(target) this.processAtNode(eid,target,arrivalTime,onDone);
      return;
    }

    if(node.nodeType==="broadcaster"){
      // fan-out: duplicate entity to all targets
      let pending=edges.length;
      for(const e of edges){
        const target=this.nodeMap.get(e.target);
        if(target) this.processAtNode(eid,target,arrivalTime,()=>{ if(--pending===0) onDone(); });
      }
      if(!edges.length) onDone();
      return;
    }

    // Single path or primitive load balancing for multiple edges
    let nextEdge = edges[0];
    if (edges.length > 1) {
      if ((node as any)._rr === undefined) (node as any)._rr = 0;
      const idx = (node as any)._rr % edges.length;
      (node as any)._rr++;
      nextEdge = edges[idx];
    }
    
    const target=this.nodeMap.get(nextEdge.target);
    if(target) this.processAtNode(eid,target,arrivalTime,onDone);
    else onDone();
  }

  // ── Node processing ───────────────────────────────────────────────────────────
  private processAtNode(eid:number, node:SimNode, entryTime:number, onDone:()=>void){
    const p=node.params as any;
    const st=this.stats.get(node.id)!;
    st.in++;
    this.addLog(eid,node.id,node.label,"arrived");

    switch(node.nodeType){
      case "queue":{
        const qp=p as QueueParams;
        st.depth++;
        const queuedAt=this.now;
        this.addLog(eid,node.id,node.label,"queued");

        let served=false;
        // Patience timeout (reneging)
        if(qp.patienceTimeout){
          const patience=sampleDistribution(
            qp.patienceDistribution??"uniform",
            qp.patienceTimeout,
            qp.patienceMin??0,
            qp.patienceMax??qp.patienceTimeout
          );
          this.eq.push(this.now+patience,()=>{
            if(!served){
              served=true; st.depth--; st.reneged++; st.out++;
              this.addLog(eid,node.id,node.label,"reneged");
              onDone();
            }
          });
        }

        // Queue acts as pass-through with timing: entities exit after brief hold
        this.eq.push(this.now,()=>{
          if(served) return; // already reneged
          served=true;
          st.waits.push(this.now-queuedAt);
          st.depth--; st.out++;
          this.addLog(eid,node.id,node.label,"service_end");
          this.routeEntity(eid,node.id,this.now,onDone);
        });
        break;
      }

      case "resource":
      case "priority_resource":{
        const rp=p as ResourceParams;
        const res=this.resources.get(node.id)!;
        const queuedAt=this.now;
        let reneged=false;
        st.depth++;

        // Patience on the resource wait (using patienceTimeout from queue param if linked, or skip)
        const req=res.request(eid,0,()=>{
          if(reneged) return;
          const waitTime=this.now-queuedAt;
          st.waits.push(waitTime);
          st.depth--;
          if(st.busyStart==null) st.busyStart=this.now;
          const svcTime=sampleDistribution(rp.serviceDistribution,rp.serviceTimeMean,0);
          this.addLog(eid,node.id,node.label,"service_start");
          this.eq.push(this.now+svcTime,()=>{
            st.services.push(svcTime); st.out++;
            const busyNow=st.busyTime+(this.now-(st.busyStart??this.now));
            st.busyTime=busyNow; st.busyStart=null;
            res.release(req);
            this.addLog(eid,node.id,node.label,"service_end");
            this.routeEntity(eid,node.id,this.now,onDone);
          });
        });
        break;
      }

      case "service":{
        const sp=p as ServiceParams;
        const svcTime=sampleDistribution(sp.distribution,sp.durationMean,0);
        this.addLog(eid,node.id,node.label,"service_start");
        st.depth++;
        this.eq.push(this.now+svcTime,()=>{
          st.depth--; st.out++; st.services.push(svcTime);
          this.addLog(eid,node.id,node.label,"service_end");
          this.routeEntity(eid,node.id,this.now,onDone);
        });
        break;
      }

      case "container":{
        const cp=p as ContainerParams;
        const con=this.containers.get(node.id)!;
        st.depth++;
        con.put(cp.fillRate??1,()=>{
          st.depth--; st.out++; st.level=con.level;
          this.routeEntity(eid,node.id,this.now,onDone);
        });
        break;
      }

      case "store":{
        const store=this.stores.get(node.id)!;
        const cap=(p.capacity??-1);
        if(cap>=0 && store.items.length>=cap){
          st.dropped++; st.out++;
          this.addLog(eid,node.id,node.label,"dropped");
          onDone(); return;
        }
        st.depth++;
        store.put({eid,t:this.now},()=>{
          st.depth=store.items.length; st.out++;
          this.routeEntity(eid,node.id,this.now,onDone);
        });
        break;
      }

      case "channel":{
        const cp=p as ChannelParams;
        const store=this.stores.get(node.id)!;
        const cap=(cp.bufferCapacity??-1);
        if(cap>=0 && store.items.length>=cap){
          st.dropped++; st.out++;
          this.addLog(eid,node.id,node.label,"dropped");
          onDone(); return;
        }
        st.depth++;
        store.put({eid,t:this.now},()=>{
          st.depth=store.items.length;
          const delay=sampleDistribution(cp.delayDistribution,cp.propagationDelay,0);
          this.addLog(eid,node.id,node.label,"transmitted");
          this.eq.push(this.now+delay,()=>{
            store.get((_item)=>{
              st.depth=store.items.length; st.out++;
              st.latencies.push(delay);
              this.addLog(eid,node.id,node.label,"received");
              this.routeEntity(eid,node.id,this.now,onDone);
            });
          });
        });
        break;
      }

      case "decision":{
        // Routing handled by parent routeEntity call; just pass through
        st.out++;
        this.addLog(eid,node.id,node.label,"routed");
        this.routeEntity(eid,node.id,this.now,onDone);
        break;
      }

      case "broadcaster":{
        st.depth++;
        this.addLog(eid,node.id,node.label,"broadcast");
        st.depth--; st.out++;
        this.routeEntity(eid,node.id,this.now,onDone);
        break;
      }

      case "sink":{
        st.out++; this.totalCompleted++;
        this.addLog(eid,node.id,node.label,"completed");
        onDone();
        break;
      }

      default:{
        st.out++;
        this.routeEntity(eid,node.id,this.now,onDone);
      }
    }
  }

  // ── Log helper ────────────────────────────────────────────────────────────────
  private addLog(eid:number, nodeId:string, nodeLabel:string, event:SimLog["event"]){
    this.logs.push({simTime:this.now, entityId:eid, nodeId, nodeLabel, event});
  }

  // ── Run in chunks ─────────────────────────────────────────────────────────────
  buildNodeStatsSnapshot():Record<string,NodeStats>{
    const snap:Record<string,NodeStats>={};
    for(const [id,t] of this.stats){
      const ns=buildNodeStats(t,this.now);
      ns.nodeId=id;
      snap[id]=ns;
    }
    return snap;
  }

  /** Process events up to maxTime. Returns true if simulation is complete. */
  runUntil(maxTime:number, maxEvents=20000):boolean{
    let processed=0;
    while(this.eq.size>0 && processed<maxEvents){
      const ev=this.eq.peek()!;
      if(ev.time>maxTime) break;
      this.eq.pop();
      this.now=ev.time;
      ev.cb();
      processed++;
    }
    this.now=Math.max(this.now,maxTime);
    return this.now>=this.params.durationSeconds;
  }

  drainLogs():SimLog[]{
    const l=this.logs; this.logs=[]; return l;
  }

  buildResult():SimResult{
    const bottleneck=Array.from(this.stats.entries())
      .filter(([,t])=>t.nodeType==="resource"||t.nodeType==="queue")
      .sort(([,a],[,b])=>(b.depth-a.depth)||(b.waits.length-a.waits.length));
    const [bid,bt]=bottleneck[0]??["",null];
    return {
      simType:this.params.simType,
      totalSimTime:this.now,
      totalArrived:this.totalArrived,
      totalCompleted:this.totalCompleted,
      bottleneckNodeId:bid,
      bottleneckLabel:bt?.label??"",
      nodeStats:this.buildNodeStatsSnapshot(),
      timeline:this.timeline,
      logs:this.drainLogs(),
    };
  }

  get currentTime(){ return this.now; }
  get arrived(){ return this.totalArrived; }
  get completed(){ return this.totalCompleted; }
}

// ─── Worker Controller ────────────────────────────────────────────────────────
let sim: GraphSimulator|null=null;
let paused=false;
let stopped=false;
let tickNum=0;
let params: SimParams;

function emit(msg:OutMsg){ (self as any).postMessage(msg); }

function runChunk(){
  if(stopped||paused||!sim) return;
  const tickEnd=((tickNum+1)*params.tickIntervalSeconds);
  const done=sim.runUntil(Math.min(tickEnd,params.durationSeconds));
  const logs=sim.drainLogs();
  const snap=sim.buildNodeStatsSnapshot();

  const tick:SimTick={
    simTime:sim.currentTime,
    wallElapsed:0,
    totalArrived:sim.arrived,
    totalCompleted:sim.completed,
    nodeStats:snap,
    recentLogs:logs,
  };
  emit({type:"tick",data:tick});
  tickNum++;

  if(done){
    emit({type:"complete",data:sim.buildResult()});
    stopped=true;
  } else {
    const msToWait = params.speedMultiplier && params.speedMultiplier > 0
      ? (params.tickIntervalSeconds / params.speedMultiplier) * 1000
      : 0;
    setTimeout(runChunk, msToWait);
  }
}

(self as any).onmessage=(e:MessageEvent<InMsg>)=>{
  const msg=e.data;
  switch(msg.type){
    case "start":
      params=msg.params; stopped=false; paused=false; tickNum=0;
      sim=new GraphSimulator(params);
      try{ sim.build(); sim.startSources(); }
      catch(err:any){ emit({type:"error",message:String(err?.message??err)}); break; }
      runChunk();
      break;
    case "pause":  paused=true;  break;
    case "resume": paused=false; runChunk(); break;
    case "stop":   stopped=true; sim=null; break;
    case "set_speed": if (params) params.speedMultiplier = msg.multiplier; break;
  }
};
