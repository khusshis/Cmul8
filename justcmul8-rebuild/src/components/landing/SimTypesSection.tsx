"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useInView, useMotionValue, useMotionValueEvent, useScroll, useSpring } from "framer-motion";
import { useLenis } from "lenis/react";
import {
  ArrowRight, Boxes, Car, Cog, Cylinder, DoorOpen, Droplets, Factory, Flag, Fuel, Package, PackageCheck,
  Plus, RadioTower, Router, Server, Star, Truck, UserCheck, Users, Warehouse, Waves, type LucideIcon,
} from "lucide-react";
import { Backdrop, Reveal, ScrollCue, SectionHeader, spring } from "@/components/landing/motionKit";

type Token = "person" | "car" | "drop" | "box" | "parcel" | "packet";
type Station = { icon: LucideIcon; label: string };
export type SimType = {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  color: string; // accent
  tint: string; // soft tint
  token: Token;
  stations: [Station, Station, Station];
  examples: string[];
};

export const TYPES: SimType[] = [
  { id: "human", name: "Human Queue", desc: "People, lines, service systems", icon: Users, color: "#6d5bff", tint: "#eeebff", token: "person",
    stations: [{ icon: DoorOpen, label: "Arrive" }, { icon: Users, label: "Queue" }, { icon: UserCheck, label: "Serve" }],
    examples: ["Bank tellers", "ER triage", "Passport control"] },
  { id: "vehicle", name: "Vehicle", desc: "Traffic, vehicles, transport", icon: Car, color: "#f43f5e", tint: "#ffecef", token: "car",
    stations: [{ icon: Car, label: "Enter" }, { icon: Fuel, label: "Pump" }, { icon: Flag, label: "Exit" }],
    examples: ["Fuel pumps", "Traffic lights", "Car wash"] },
  { id: "liquid", name: "Liquid / Material", desc: "Flow of liquids or materials", icon: Droplets, color: "#0ea5e9", tint: "#e6f6fe", token: "drop",
    stations: [{ icon: Droplets, label: "Source" }, { icon: Cylinder, label: "Tank" }, { icon: Waves, label: "Outflow" }],
    examples: ["Water treatment", "Fuel storage", "Chemical flow"] },
  { id: "mfg", name: "Manufacturing", desc: "Production lines, machines", icon: Factory, color: "#10b981", tint: "#e7f8f1", token: "box",
    stations: [{ icon: Boxes, label: "Raw parts" }, { icon: Cog, label: "Machine" }, { icon: PackageCheck, label: "QC pass" }],
    examples: ["Assembly line", "Quality control", "CNC machining"] },
  { id: "logistics", name: "Logistics", desc: "Warehousing, supply chain", icon: Package, color: "#f97316", tint: "#fff1e6", token: "parcel",
    stations: [{ icon: Warehouse, label: "Inbound" }, { icon: Package, label: "Sort" }, { icon: Truck, label: "Dispatch" }],
    examples: ["Warehouse ops", "Sort centers", "Dock loading"] },
  { id: "network", name: "Network / Signal", desc: "Networks, signals, comms", icon: RadioTower, color: "#a78bfa", tint: "#f3eeff", token: "packet",
    stations: [{ icon: RadioTower, label: "Emit" }, { icon: Router, label: "Route" }, { icon: Server, label: "Receive" }],
    examples: ["Process pipes", "Broadcast fan-out", "Event latency"] },
];

const CYCLE_MS = 6000;

/* ---------- Isometric world ----------
   World units on a 10×6 platform, projected 30° isometric into a 640×420 viewBox.
   Each industry gets its own ground, buildings and props; the layout (road + 3 station spots) is shared. */
const S = 36;
const OX = 262;
const OY = 64;
const VB = { w: 640, h: 420 };
const iso = (x: number, y: number, z = 0): [number, number] => [(x - y) * 0.866 * S + OX, (x + y) * 0.5 * S - z * S + OY];
const pts = (...p: [number, number, number][]) => p.map(([x, y, z]) => iso(x, y, z).join(",")).join(" ");
const pct = ([x, y]: [number, number]) => ({ left: `${(x / VB.w) * 100}%`, top: `${(y / VB.h) * 100}%` });
const RX = 1.2247 * S; // screen half-width of a ground circle of radius 1
const RY = 0.7071 * S; // screen half-height of the same circle

// Route: an L-shape that runs in front of each station, so entities never pass behind a building.
const ROAD: [number, number][] = [[0.15, 2.6], [3.4, 2.6], [3.4, 4.2], [6.8, 4.2], [6.8, 5.4], [9.85, 5.4]];
const ROAD_D = "M " + ROAD.map(([x, y]) => iso(x, y).join(" ")).join(" L ");
const SPOTS = [{ x: 1.8, y: 1.3 }, { x: 5.0, y: 2.85 }, { x: 8.4, y: 4.05 }];
const LAMPS: [number, number][] = [[0.6, 3.25], [3.95, 4.85], [7.35, 5.95], [2.8, 1.95]];
const TREES: [number, number, number][] = [[0.7, 0.6, 1], [9.3, 0.7, 1.1], [9.4, 2.2, 0.85], [0.6, 5.2, 1.05], [4.4, 5.6, 0.9], [3.2, 0.5, 0.75]];

// Station heights per industry (the floating labels sit just above them).
const HEIGHTS: Record<string, [number, number, number]> = {
  human: [1.0, 1.35, 1.1],
  vehicle: [0.75, 1.3, 1.0],
  liquid: [2.05, 1.75, 0.5],
  mfg: [0.95, 1.55, 1.1],
  logistics: [1.05, 1.5, 0.95],
  network: [2.3, 1.85, 1.25],
};

type Ctx = { c: string; tint: string; live: boolean };

/* ---------- Primitives ---------- */

// A shaded box: top, front-left (+y) and front-right (+x) faces.
function Block({ x, y, w, d, h, z = 0, color, top, shade = 0.2 }: { x: number; y: number; w: number; d: number; h: number; z?: number; color: string; top: string; shade?: number }) {
  const [x0, x1, y0, y1, z1] = [x - w / 2, x + w / 2, y - d / 2, y + d / 2, z + h];
  return (
    <g>
      <polygon points={pts([x0, y1, z], [x1, y1, z], [x1, y1, z1], [x0, y1, z1])} fill={color} />
      <polygon points={pts([x1, y0, z], [x1, y1, z], [x1, y1, z1], [x1, y0, z1])} fill={color} />
      <polygon points={pts([x1, y0, z], [x1, y1, z], [x1, y1, z1], [x1, y0, z1])} fill="#000" opacity={shade} />
      <polygon points={pts([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1])} fill={top} />
      <polyline points={pts([x0, y1, z1], [x1, y1, z1], [x1, y0, z1])} fill="none" stroke="#fff" strokeOpacity={0.75} strokeWidth={1.1} />
    </g>
  );
}

// Upright cylinder with a soft left-to-right shading overlay.
function Cyl({ x, y, r, h, z = 0, color, top }: { x: number; y: number; r: number; h: number; z?: number; color: string; top: string }) {
  const [cx, cyB] = iso(x, y, z);
  const cyT = cyB - h * S;
  const [rx, ry] = [RX * r, RY * r];
  const body = `M ${cx - rx} ${cyT} L ${cx - rx} ${cyB} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cyB} L ${cx + rx} ${cyT} Z`;
  return (
    <g>
      <path d={body} fill={color} />
      <path d={body} fill="url(#cyl-shade)" />
      <ellipse cx={cx} cy={cyT} rx={rx} ry={ry} fill={top} />
      <ellipse cx={cx} cy={cyT} rx={rx} ry={ry} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={1} />
    </g>
  );
}

const Pole = ({ x, y, h, z = 0, color = "#94a3b8", w = 1.6 }: { x: number; y: number; h: number; z?: number; color?: string; w?: number }) => {
  const [a, b] = [iso(x, y, z), iso(x, y, z + h)];
  return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={w} strokeLinecap="round" />;
};

// Polyline through world points (pipes, ropes, beams).
const Run = ({ p, color, w, opacity = 1, dash }: { p: [number, number, number][]; color: string; w: number; opacity?: number; dash?: string }) => (
  <polyline points={pts(...p)} fill="none" stroke={color} strokeWidth={w} strokeOpacity={opacity} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />
);

// A blinking light (SMIL, runs only when live).
const Blink = ({ at, r = 2.4, color, dur = "1.2s", begin = "0s", live }: { at: [number, number]; r?: number; color: string; dur?: string; begin?: string; live: boolean }) => (
  <circle cx={at[0]} cy={at[1]} r={r} fill={color}>
    {live && <animate attributeName="opacity" values="1;0.25;1" dur={dur} begin={begin} repeatCount="indefinite" />}
  </circle>
);

function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const [bx, by] = iso(x, y, 0);
  return (
    <g>
      <ellipse cx={bx} cy={by} rx={10 * s} ry={5 * s} fill="#1e1b4b" opacity={0.1} />
      <line x1={bx} y1={by} x2={bx} y2={by - 12 * s} stroke="#8b6f5a" strokeWidth={2.4 * s} strokeLinecap="round" />
      <circle cx={bx} cy={by - 18 * s} r={9 * s} fill="#34d399" />
      <circle cx={bx + 2 * s} cy={by - 26 * s} r={6.5 * s} fill="#6ee7b7" />
      <circle cx={bx - 3 * s} cy={by - 21 * s} r={2.5 * s} fill="#fff" opacity={0.45} />
    </g>
  );
}

function Lamp({ x, y, c }: { x: number; y: number; c: string }) {
  const [hx, hy] = iso(x, y, 0.75);
  return (
    <g>
      <Pole x={x} y={y} h={0.75} color="#b9b6d3" />
      <circle cx={hx} cy={hy} r={7} fill={c} opacity={0.18} />
      <circle cx={hx} cy={hy} r={2.6} fill="#fff" />
    </g>
  );
}

// Office-style building with window bands, a door, side windows and an optional rooftop unit.
function Building({ x, y, h, c, tint, w = 1.5, d = 1.5, roofUnit = true, glass = false }: { x: number; y: number; h: number; c: string; tint: string; w?: number; d?: number; roofUnit?: boolean; glass?: boolean }) {
  const [hw, hd] = [w / 2, d / 2];
  return (
    <g>
      <polygon points={pts([x - hw, y + hd, 0], [x + hw + 0.3, y + hd + 0.2, 0], [x + hw + 0.3, y - hd + 0.2, 0], [x + hw, y - hd, 0])} fill="#1e1b4b" opacity={0.1} />
      <Block x={x} y={y} w={w} d={d} h={h} color={c} top="#fff" />
      <polygon points={pts([x - hw + 0.15, y - hd + 0.15, h], [x + hw - 0.15, y - hd + 0.15, h], [x + hw - 0.15, y + hd - 0.15, h], [x - hw + 0.15, y + hd - 0.15, h])} fill={tint} />
      {glass ? (
        // Full glass front
        <polygon points={pts([x - hw + 0.12, y + hd, 0.08], [x + hw - 0.12, y + hd, 0.08], [x + hw - 0.12, y + hd, h * 0.85], [x - hw + 0.12, y + hd, h * 0.85])} fill="#fff" opacity={0.62} />
      ) : (
        [0.52, 0.78].map((zf) => (
          <polygon key={zf} points={pts([x - hw + 0.2, y + hd, h * zf - 0.12], [x + 0.2, y + hd, h * zf - 0.12], [x + 0.2, y + hd, h * zf + 0.02], [x - hw + 0.2, y + hd, h * zf + 0.02])} fill="#fff" opacity={0.6} />
        ))
      )}
      {!glass && <polygon points={pts([x + 0.3, y + hd, 0], [x + hw - 0.15, y + hd, 0], [x + hw - 0.15, y + hd, 0.5], [x + 0.3, y + hd, 0.5])} fill="#1e1b4b" opacity={0.45} />}
      {[0.25, 0.55, 0.85].map((yf, k) => (
        <polygon key={k} points={pts([x + hw, y - hd + yf * d - 0.12, h * 0.55], [x + hw, y - hd + yf * d + 0.12, h * 0.55], [x + hw, y - hd + yf * d + 0.12, h * 0.75], [x + hw, y - hd + yf * d - 0.12, h * 0.75])} fill="#fff" opacity={0.45} />
      ))}
      {roofUnit && <Block x={x - 0.25} y={y - 0.25} w={0.5} d={0.45} h={0.22} z={h} color="#cbd5e1" top="#f1f5f9" />}
    </g>
  );
}

/* ---------- Grounds (the route surface) ---------- */

function Ground({ kind, c, live }: { kind: string; c: string; live: boolean }) {
  const corners = ROAD.slice(1, -1).map(([x, y]) => iso(x, y));
  switch (kind) {
    case "walk": // paved walkway: pale stones
      return (
        <g>
          <path d={ROAD_D} fill="none" stroke="#fff" strokeWidth={26} strokeLinejoin="round" />
          <path d={ROAD_D} fill="none" stroke="#e7e3f6" strokeWidth={22} strokeLinejoin="round" strokeDasharray="10 2" />
          <path d={ROAD_D} fill="none" stroke={c} strokeOpacity={0.14} strokeWidth={22} strokeLinejoin="round" />
        </g>
      );
    case "asphalt": // road with curbs and lane markings
      return (
        <g>
          <path d={ROAD_D} fill="none" stroke="#e2e8f0" strokeWidth={28} strokeLinejoin="round" />
          <path d={ROAD_D} fill="none" stroke="#475569" strokeWidth={23} strokeLinejoin="round" />
          <path d={ROAD_D} fill="none" stroke="#fff" strokeOpacity={0.85} strokeWidth={1.6} strokeDasharray="7 7" className={live ? "lp-dash" : undefined} />
        </g>
      );
    case "pipe": // a real pipe: body, highlight, flanges at the bends
      return (
        <g>
          <path d={ROAD_D} fill="none" stroke="#1e1b4b" strokeOpacity={0.12} strokeWidth={24} strokeLinejoin="round" transform="translate(0,4)" />
          <path d={ROAD_D} fill="none" stroke={c} strokeOpacity={0.55} strokeWidth={18} strokeLinejoin="round" />
          <path d={ROAD_D} fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={5} strokeLinejoin="round" transform="translate(0,-4)" />
          <path d={ROAD_D} fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={1.4} strokeDasharray="2 10" className={live ? "lp-dash" : undefined} />
          {corners.map(([x, y], i) => (
            <g key={i}>
              <ellipse cx={x} cy={y} rx={13} ry={10} fill={c} />
              <ellipse cx={x} cy={y - 1.5} rx={13} ry={9} fill="#fff" opacity={0.35} />
            </g>
          ))}
        </g>
      );
    case "belt": // conveyor belt with moving rollers
      return (
        <g>
          <path d={ROAD_D} fill="none" stroke="#94a3b8" strokeWidth={26} strokeLinejoin="round" />
          <path d={ROAD_D} fill="none" stroke="#334155" strokeWidth={21} strokeLinejoin="round" />
          <path d={ROAD_D} fill="none" stroke="#fff" strokeOpacity={0.18} strokeWidth={21} strokeDasharray="2 6" className={live ? "lp-dash" : undefined} />
          <path d={ROAD_D} fill="none" stroke={c} strokeOpacity={0.9} strokeWidth={1.4} transform="translate(0,-9)" />
        </g>
      );
    case "circuit": // PCB traces with pads
      return (
        <g>
          <path d={ROAD_D} fill="none" stroke={c} strokeOpacity={0.12} strokeWidth={26} strokeLinejoin="round" />
          {[-7, 0, 7].map((o) => (
            <path key={o} d={ROAD_D} fill="none" stroke={c} strokeOpacity={o ? 0.35 : 0.65} strokeWidth={o ? 1.4 : 2} strokeLinejoin="round" transform={`translate(0,${o})`} />
          ))}
          <path d={ROAD_D} fill="none" stroke="#fff" strokeWidth={2} strokeDasharray="4 18" className={live ? "lp-dash" : undefined} />
          {corners.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={7} fill="#fff" stroke={c} strokeWidth={2} />
              <circle cx={x} cy={y} r={2.5} fill={c} />
            </g>
          ))}
        </g>
      );
    default:
      return null;
  }
}

const GROUND: Record<string, string> = { human: "walk", vehicle: "asphalt", liquid: "pipe", mfg: "belt", logistics: "asphalt", network: "circuit" };

/* ---------- Stations per industry ---------- */

function Stations({ id, ctx }: { id: string; ctx: Ctx }) {
  const { c, tint, live } = ctx;
  const [A, B, C] = SPOTS;
  const [ha, hb, hc] = HEIGHTS[id];
  switch (id) {
    case "human":
      return [
        <g key="a">
          <Building x={A.x} y={A.y} h={ha} c={c} tint={tint} />
          {/* Striped awning over the entrance */}
          <polygon points={pts([A.x - 0.75, A.y + 0.75, ha * 0.66], [A.x + 0.75, A.y + 0.75, ha * 0.66], [A.x + 0.75, A.y + 1.12, ha * 0.5], [A.x - 0.75, A.y + 1.12, ha * 0.5])} fill={c} />
          <polygon points={pts([A.x - 0.75, A.y + 0.75, ha * 0.66], [A.x + 0.75, A.y + 0.75, ha * 0.66], [A.x + 0.75, A.y + 1.12, ha * 0.5], [A.x - 0.75, A.y + 1.12, ha * 0.5])} fill="url(#stripes)" />
        </g>,
        <Building key="b" x={B.x} y={B.y} h={hb} c={c} tint={tint} glass roofUnit={false} />,
        <Building key="c" x={C.x} y={C.y} h={hc} c={c} tint={tint} />,
      ];
    case "vehicle": {
      const pivot = iso(A.x + 0.25, 1.95, 0.45);
      return [
        <g key="a">
          {/* Toll booth + boom barrier that lifts */}
          <Block x={A.x} y={A.y} w={0.7} d={0.7} h={ha} color={c} top="#fff" />
          <polygon points={pts([A.x - 0.3, A.y + 0.35, ha * 0.45], [A.x + 0.3, A.y + 0.35, ha * 0.45], [A.x + 0.3, A.y + 0.35, ha * 0.85], [A.x - 0.3, A.y + 0.35, ha * 0.85])} fill="#fff" opacity={0.7} />
          <Block x={A.x} y={A.y} w={0.9} d={0.9} h={0.08} z={ha} color={c} top="#fff" />
          <Pole x={A.x + 0.25} y={1.95} h={0.45} color="#64748b" w={3} />
          <g>
            <line x1={pivot[0]} y1={pivot[1]} x2={iso(A.x + 0.25, 3.3, 0.45)[0]} y2={iso(A.x + 0.25, 3.3, 0.45)[1]} stroke="#ef4444" strokeWidth={3.5} strokeLinecap="round" />
            <line x1={pivot[0]} y1={pivot[1]} x2={iso(A.x + 0.25, 3.3, 0.45)[0]} y2={iso(A.x + 0.25, 3.3, 0.45)[1]} stroke="#fff" strokeWidth={3.5} strokeDasharray="5 5" />
            {live && <animateTransform attributeName="transform" type="rotate" values={`0 ${pivot[0]} ${pivot[1]};-38 ${pivot[0]} ${pivot[1]};-38 ${pivot[0]} ${pivot[1]};0 ${pivot[0]} ${pivot[1]};0 ${pivot[0]} ${pivot[1]}`} keyTimes="0;0.2;0.5;0.7;1" dur="3.4s" repeatCount="indefinite" />}
          </g>
        </g>,
        <g key="b">
          {/* Fuel-station canopy on four pillars, two pumps underneath */}
          {[[-0.65, -0.65], [0.65, -0.65], [-0.65, 0.65], [0.65, 0.65]].map(([dx, dy], k) => (
            <Pole key={k} x={B.x + dx} y={B.y + dy} h={hb} color="#cbd5e1" w={3} />
          ))}
          {[-0.32, 0.32].map((dx, k) => (
            <g key={k}>
              <Block x={B.x + dx} y={B.y + 0.1} w={0.24} d={0.34} h={0.5} color="#e2e8f0" top="#fff" />
              <polygon points={pts([B.x + dx - 0.12, B.y + 0.27, 0.32], [B.x + dx + 0.12, B.y + 0.27, 0.32], [B.x + dx + 0.12, B.y + 0.27, 0.44], [B.x + dx - 0.12, B.y + 0.27, 0.44])} fill={c} />
            </g>
          ))}
          <Block x={B.x} y={B.y} w={1.7} d={1.7} h={0.16} z={hb} color={c} top="#fff" />
          <polygon points={pts([B.x - 0.85, B.y + 0.85, hb + 0.02], [B.x + 0.85, B.y + 0.85, hb + 0.02], [B.x + 0.85, B.y + 0.85, hb + 0.13], [B.x - 0.85, B.y + 0.85, hb + 0.13])} fill="#fff" opacity={0.5} />
        </g>,
        <g key="c">
          {/* Car wash: building with striped entry */}
          <Building x={C.x} y={C.y} h={hc} c={c} tint={tint} />
          <polygon points={pts([C.x - 0.6, C.y + 0.75, 0], [C.x + 0.1, C.y + 0.75, 0], [C.x + 0.1, C.y + 0.75, 0.55], [C.x - 0.6, C.y + 0.75, 0.55])} fill="url(#stripes)" />
        </g>,
      ];
    }
    case "liquid":
      return [
        <g key="a">
          {/* Water tower: legs + tank */}
          {[[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]].map(([dx, dy], k) => (
            <Pole key={k} x={A.x + dx} y={A.y + dy} h={1.25} color="#94a3b8" w={2.4} />
          ))}
          <Run p={[[A.x - 0.35, A.y + 0.35, 0.3], [A.x + 0.35, A.y + 0.35, 0.9]]} color="#94a3b8" w={1.2} />
          <Run p={[[A.x + 0.35, A.y - 0.35, 0.3], [A.x + 0.35, A.y + 0.35, 0.9]]} color="#94a3b8" w={1.2} />
          <Cyl x={A.x} y={A.y} r={0.6} h={0.8} z={1.25} color={c} top={tint} />
        </g>,
        <g key="b">
          {/* Storage tank with a live level gauge */}
          <Cyl x={B.x} y={B.y} r={0.8} h={hb} color={c} top={tint} />
          {(() => {
            const [gx, gy] = iso(B.x + 0.2, B.y + 0.78, 0.2);
            const gh = (hb - 0.45) * S;
            return (
              <g>
                <rect x={gx - 4} y={gy - gh} width={8} height={gh} rx={4} fill="#fff" opacity={0.75} />
                <rect x={gx - 2.5} y={gy - gh * 0.6} width={5} height={gh * 0.6} rx={2.5} fill={c}>
                  {live && (
                    <>
                      <animate attributeName="height" values={`${gh * 0.35};${gh * 0.85};${gh * 0.35}`} dur="4s" repeatCount="indefinite" />
                      <animate attributeName="y" values={`${gy - gh * 0.35};${gy - gh * 0.85};${gy - gh * 0.35}`} dur="4s" repeatCount="indefinite" />
                    </>
                  )}
                </rect>
              </g>
            );
          })()}
        </g>,
        <g key="c">
          {/* Treatment basin with ripples */}
          <Block x={C.x} y={C.y} w={1.8} d={1.4} h={hc} color={c} top="#fff" />
          <polygon points={pts([C.x - 0.75, C.y - 0.55, hc], [C.x + 0.75, C.y - 0.55, hc], [C.x + 0.75, C.y + 0.55, hc], [C.x - 0.75, C.y + 0.55, hc])} fill={c} opacity={0.45} />
          {live &&
            [0, 1].map((k) => (
              <ellipse key={k} cx={iso(C.x, C.y, hc)[0]} cy={iso(C.x, C.y, hc)[1]} rx={4} ry={2.3} fill="none" stroke="#fff" strokeWidth={1.4}>
                <animate attributeName="rx" values="4;26" dur="2.4s" begin={`${k * 1.2}s`} repeatCount="indefinite" />
                <animate attributeName="ry" values="2.3;15" dur="2.4s" begin={`${k * 1.2}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0" dur="2.4s" begin={`${k * 1.2}s`} repeatCount="indefinite" />
              </ellipse>
            ))}
        </g>,
      ];
    case "mfg": {
      const sh = iso(B.x - 0.2, B.y - 0.2, hb); // robot arm shoulder
      return [
        <g key="a">
          {/* Parts rack with crates on the shelves */}
          <Block x={A.x} y={A.y} w={1.5} d={1.0} h={ha} color="#94a3b8" top="#e2e8f0" />
          {[0.05, 0.37, 0.69].map((z, r) =>
            [-0.45, 0.0, 0.45].map((dx, k) => (
              <Block key={`${r}-${k}`} x={A.x + dx} y={A.y + 0.62} w={0.3} d={0.22} h={0.22} z={z} color={(r + k) % 2 ? c : "#f59e0b"} top="#fff" />
            )),
          )}
        </g>,
        <g key="b">
          {/* Machine with a robot arm swinging on the roof */}
          <Building x={B.x} y={B.y} h={hb} c={c} tint={tint} roofUnit={false} />
          <Cyl x={B.x - 0.2} y={B.y - 0.2} r={0.18} h={0.12} z={hb} color="#475569" top="#94a3b8" />
          <g>
            <line x1={sh[0]} y1={sh[1] - 4} x2={sh[0] + 18} y2={sh[1] - 26} stroke="#475569" strokeWidth={5} strokeLinecap="round" />
            <line x1={sh[0] + 18} y1={sh[1] - 26} x2={sh[0] + 34} y2={sh[1] - 16} stroke="#64748b" strokeWidth={4} strokeLinecap="round" />
            <circle cx={sh[0] + 18} cy={sh[1] - 26} r={3.5} fill="#f59e0b" />
            <circle cx={sh[0] + 34} cy={sh[1] - 16} r={3} fill={c} />
            {live && <animateTransform attributeName="transform" type="rotate" values={`-18 ${sh[0]} ${sh[1]};22 ${sh[0]} ${sh[1]};-18 ${sh[0]} ${sh[1]}`} dur="2.6s" repeatCount="indefinite" />}
          </g>
        </g>,
        <g key="c">
          {/* QC building + scanner gate over the belt with a blinking laser */}
          <Building x={C.x} y={C.y} h={hc} c={c} tint={tint} />
          <Pole x={7.9} y={4.95} h={0.95} color="#64748b" w={4} />
          <Pole x={7.9} y={5.85} h={0.95} color="#64748b" w={4} />
          <Run p={[[7.9, 4.95, 0.95], [7.9, 5.85, 0.95]]} color="#475569" w={6} />
          <Run p={[[7.9, 4.95, 0.45], [7.9, 5.85, 0.45]]} color="#ef4444" w={1.8} opacity={live ? 0.9 : 0.5} />
          <Blink at={iso(7.9, 5.4, 0.95)} color="#22c55e" r={2.6} live={live} dur="0.9s" />
        </g>,
      ];
    }
    case "logistics":
      return [
        <g key="a">
          {/* Warehouse with roll-up doors */}
          <Block x={A.x} y={A.y} w={1.8} d={1.4} h={ha} color={c} top="#fff" />
          <polygon points={pts([A.x - 0.75, A.y - 0.55, ha], [A.x + 0.75, A.y - 0.55, ha], [A.x + 0.75, A.y + 0.55, ha], [A.x - 0.75, A.y + 0.55, ha])} fill={tint} />
          {[-0.45, 0.35].map((dx, k) => (
            <g key={k}>
              <polygon points={pts([A.x + dx - 0.28, A.y + 0.7, 0], [A.x + dx + 0.28, A.y + 0.7, 0], [A.x + dx + 0.28, A.y + 0.7, 0.62], [A.x + dx - 0.28, A.y + 0.7, 0.62])} fill="#e2e8f0" />
              {[0.12, 0.24, 0.36, 0.48].map((z) => (
                <Run key={z} p={[[A.x + dx - 0.28, A.y + 0.7, z], [A.x + dx + 0.28, A.y + 0.7, z]]} color="#94a3b8" w={1} />
              ))}
            </g>
          ))}
        </g>,
        <Building key="b" x={B.x} y={B.y} h={hb} c={c} tint={tint} />,
        <g key="c">
          <Building x={C.x} y={C.y} h={hc} c={c} tint={tint} roofUnit={false} />
          {/* Parked truck: trailer + cab + wheels */}
          <Block x={6.9} y={3.1} w={0.46} d={1.05} h={0.55} z={0.12} color="#f8fafc" top="#fff" shade={0.12} />
          <polygon points={pts([6.67, 2.75, 0.3], [6.67, 3.5, 0.3], [6.67, 3.5, 0.42], [6.67, 2.75, 0.42])} fill={c} />
          <polygon points={pts([7.13, 2.6, 0.3], [7.13, 3.6, 0.3], [7.13, 3.6, 0.42], [7.13, 2.6, 0.42])} fill={c} />
          <Block x={6.9} y={3.86} w={0.44} d={0.36} h={0.42} z={0.12} color={c} top="#fff" />
          <polygon points={pts([6.72, 4.04, 0.36], [7.08, 4.04, 0.36], [7.08, 4.04, 0.5], [6.72, 4.04, 0.5])} fill="#1e293b" opacity={0.75} />
          {[2.75, 3.4, 3.9].map((wy) => (
            <ellipse key={wy} cx={iso(7.13, wy, 0.06)[0]} cy={iso(7.13, wy, 0.06)[1]} rx={4} ry={4.5} fill="#1e293b" />
          ))}
        </g>,
      ];
    case "network": {
      const apex = iso(A.x, A.y, ha);
      return [
        <g key="a">
          {/* Radio tower: lattice legs, braces, pulsing rings */}
          {[[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]].map(([dx, dy], k) => (
            <Run key={k} p={[[A.x + dx, A.y + dy, 0], [A.x, A.y, ha]]} color="#64748b" w={2} />
          ))}
          {[0.5, 1.0, 1.5].map((z) => {
            const f = 1 - z / ha;
            return <Run key={z} p={[[A.x - 0.45 * f, A.y + 0.45 * f, z], [A.x + 0.45 * f, A.y + 0.45 * f, z], [A.x + 0.45 * f, A.y - 0.45 * f, z]]} color="#94a3b8" w={1.2} />;
          })}
          <circle cx={apex[0]} cy={apex[1]} r={4} fill={c} />
          {live &&
            [0, 1, 2].map((k) => (
              <circle key={k} cx={apex[0]} cy={apex[1]} r={4} fill="none" stroke={c} strokeWidth={1.6}>
                <animate attributeName="r" values="4;30" dur="2.4s" begin={`${k * 0.8}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0" dur="2.4s" begin={`${k * 0.8}s`} repeatCount="indefinite" />
              </circle>
            ))}
        </g>,
        <g key="b">
          {/* Server rack with rows of blinking LEDs */}
          <Block x={B.x} y={B.y} w={1.0} d={1.0} h={hb} color="#1e293b" top="#334155" shade={0.3} />
          {Array.from({ length: 6 }, (_, r) => (
            <g key={r}>
              <polygon points={pts([B.x - 0.4, B.y + 0.5, 0.2 + r * 0.26], [B.x + 0.4, B.y + 0.5, 0.2 + r * 0.26], [B.x + 0.4, B.y + 0.5, 0.36 + r * 0.26], [B.x - 0.4, B.y + 0.5, 0.36 + r * 0.26])} fill="#0f172a" />
              {[-0.28, -0.14, 0.0].map((dx, k) => (
                <Blink key={k} at={iso(B.x + dx, B.y + 0.5, 0.28 + r * 0.26)} r={1.6} color={k === 2 ? "#22c55e" : c} dur={`${0.7 + ((r * 3 + k) % 5) * 0.25}s`} begin={`${((r + k) % 4) * 0.2}s`} live={live} />
              ))}
            </g>
          ))}
        </g>,
        <g key="c">
          {/* Data centre + satellite dish on the roof */}
          <Building x={C.x} y={C.y} h={hc} c={c} tint={tint} roofUnit={false} />
          {(() => {
            const [dx, dy] = iso(C.x - 0.1, C.y - 0.1, hc);
            return (
              <g>
                <line x1={dx} y1={dy} x2={dx} y2={dy - 12} stroke="#64748b" strokeWidth={2.4} />
                <ellipse cx={dx} cy={dy - 18} rx={13} ry={7} fill="#f8fafc" stroke={c} strokeWidth={1.6} transform={`rotate(-28 ${dx} ${dy - 18})`} />
                <line x1={dx} y1={dy - 18} x2={dx + 9} y2={dy - 27} stroke="#64748b" strokeWidth={1.4} />
                <Blink at={[dx + 9, dy - 27]} r={2.2} color={c} live={live} />
              </g>
            );
          })()}
        </g>,
      ];
    }
    default:
      return null;
  }
}

/* ---------- Props per industry ---------- */

function Props({ id, ctx }: { id: string; ctx: Ctx }) {
  const { c, live } = ctx;
  switch (id) {
    case "human":
      return (
        <g>
          {/* Benches */}
          {[[2.4, 3.35], [5.6, 4.95]].map(([x, y], k) => (
            <g key={k}>
              <Block x={x} y={y} w={0.7} d={0.22} h={0.14} color="#b45309" top="#f59e0b" />
              <Block x={x} y={y - 0.12} w={0.7} d={0.06} h={0.2} z={0.14} color="#b45309" top="#f59e0b" />
            </g>
          ))}
          {/* Queue barriers: posts with ropes along the waiting line */}
          {[4.7, 3.7].map((py) => (
            <g key={py}>
              <Run p={[[3.8, py, 0.34], [4.3, py, 0.34], [4.8, py, 0.34]]} color={c} w={1.6} />
              {[3.8, 4.3, 4.8].map((px) => (
                <g key={px}>
                  <Pole x={px} y={py} h={0.38} color="#475569" w={2.2} />
                  <circle cx={iso(px, py, 0.38)[0]} cy={iso(px, py, 0.38)[1]} r={1.8} fill="#cbd5e1" />
                </g>
              ))}
            </g>
          ))}
        </g>
      );
    case "vehicle":
      return (
        <g>
          {/* Traffic lights at the bends */}
          {[[3.0, 3.25], [6.35, 4.85]].map(([x, y], k) => {
            const top = iso(x, y, 1.05);
            return (
              <g key={k}>
                <Pole x={x} y={y} h={1.05} color="#475569" w={2.2} />
                <rect x={top[0] - 4.5} y={top[1] - 4} width={9} height={22} rx={3} fill="#1e293b" />
                <circle cx={top[0]} cy={top[1] + 1} r={2.4} fill="#7f1d1d" />
                <circle cx={top[0]} cy={top[1] + 7} r={2.4} fill="#78350f" />
                <Blink at={[top[0], top[1] + 13]} color="#22c55e" live={live} dur="1.6s" begin={`${k * 0.5}s`} />
              </g>
            );
          })}
        </g>
      );
    case "liquid":
      return (
        <g>
          {/* Pipes tower → tank → basin, with a valve wheel */}
          <Run p={[[2.1, 1.3, 0.3], [4.25, 1.3, 0.3], [4.25, 2.3, 0.3]]} color={c} w={6} opacity={0.75} />
          <Run p={[[2.1, 1.3, 0.3], [4.25, 1.3, 0.3], [4.25, 2.3, 0.3]]} color="#fff" w={1.6} opacity={0.6} />
          <Run p={[[5.75, 2.85, 0.3], [7.45, 2.85, 0.3], [7.45, 3.4, 0.3]]} color={c} w={6} opacity={0.75} />
          <Run p={[[5.75, 2.85, 0.3], [7.45, 2.85, 0.3], [7.45, 3.4, 0.3]]} color="#fff" w={1.6} opacity={0.6} />
          {(() => {
            const [vx, vy] = iso(3.2, 1.3, 0.3);
            return (
              <g>
                <line x1={vx} y1={vy} x2={vx} y2={vy - 9} stroke="#64748b" strokeWidth={2} />
                <ellipse cx={vx} cy={vy - 10} rx={6} ry={3.2} fill="none" stroke="#ef4444" strokeWidth={2} />
              </g>
            );
          })()}
        </g>
      );
    case "mfg":
      return (
        <g>
          {/* Pallets with crates */}
          {[[1.5, 4.3], [2.4, 4.95]].map(([x, y], k) => (
            <g key={k}>
              <Block x={x} y={y} w={0.7} d={0.7} h={0.08} color="#a16207" top="#ca8a04" />
              <Block x={x - 0.15} y={y - 0.15} w={0.3} d={0.3} h={0.28} z={0.08} color={c} top="#fff" />
              <Block x={x + 0.17} y={y + 0.1} w={0.3} d={0.3} h={0.28} z={0.08} color="#f59e0b" top="#fff" />
              {k === 0 && <Block x={x - 0.15} y={y - 0.15} w={0.3} d={0.3} h={0.28} z={0.36} color="#f59e0b" top="#fff" />}
            </g>
          ))}
        </g>
      );
    case "logistics":
      return (
        <g>
          {/* Stacked shipping containers with ribs */}
          {[
            { x: 6.9, y: 1.2, z: 0, col: "#ef4444" },
            { x: 6.9, y: 1.75, z: 0, col: "#0ea5e9" },
            { x: 6.9, y: 1.2, z: 0.46, col: "#f59e0b" },
          ].map((k, i) => (
            <g key={i}>
              <Block x={k.x} y={k.y} w={1.25} d={0.48} h={0.46} z={k.z} color={k.col} top="#fff" />
              {[-0.45, -0.25, -0.05, 0.15, 0.35, 0.55].map((dx) => (
                <Run key={dx} p={[[k.x + dx, k.y + 0.24, k.z + 0.04], [k.x + dx, k.y + 0.24, k.z + 0.42]]} color="#000" w={1} opacity={0.18} />
              ))}
            </g>
          ))}
        </g>
      );
    case "network":
      return (
        <g>
          {/* Node posts with blinking tops */}
          {[[2.6, 3.4], [6.2, 3.55], [5.7, 5.15], [9.3, 4.9]].map(([x, y], k) => (
            <g key={k}>
              <Cyl x={x} y={y} r={0.12} h={0.35} color="#334155" top="#475569" />
              <Blink at={iso(x, y, 0.35)} r={2.6} color={c} live={live} dur={`${1 + k * 0.3}s`} />
            </g>
          ))}
        </g>
      );
    default:
      return null;
  }
}

/* ---------- Entities ---------- */

const SHIRTS = ["#6d5bff", "#f59e0b", "#10b981", "#ef4444", "#0ea5e9", "#ec4899"];
const PAINT = ["#f43f5e", "#0ea5e9", "#f59e0b", "#10b981", "#6366f1", "#e2e8f0"];

// Tiny isometric cube in local screen space (for cars, crates, parcels).
function LocalCube({ w, d, h, c, z = 0, topC }: { w: number; d: number; h: number; c: string; z?: number; topC?: string }) {
  const p = (x: number, y: number, zz: number) => [(x - y) * 0.866 * S, (x + y) * 0.5 * S - zz * S].join(",");
  const [a, b, z1] = [w / 2, d / 2, z + h];
  return (
    <g>
      <polygon points={[p(-a, b, z), p(a, b, z), p(a, b, z1), p(-a, b, z1)].join(" ")} fill={c} />
      <polygon points={[p(a, -b, z), p(a, b, z), p(a, b, z1), p(a, -b, z1)].join(" ")} fill={c} />
      <polygon points={[p(a, -b, z), p(a, b, z), p(a, b, z1), p(a, -b, z1)].join(" ")} fill="#000" opacity={0.22} />
      <polygon points={[p(-a, -b, z1), p(a, -b, z1), p(a, b, z1), p(-a, b, z1)].join(" ")} fill={topC ?? c} />
      <polygon points={[p(-a, -b, z1), p(a, -b, z1), p(a, b, z1), p(-a, b, z1)].join(" ")} fill="#fff" opacity={topC ? 0 : 0.3} />
    </g>
  );
}

function Entity({ kind, color, i, live }: { kind: Token; color: string; i: number; live: boolean }) {
  const shadow = <ellipse cx={0} cy={2} rx={10} ry={4.5} fill="#1e1b4b" opacity={0.16} />;
  switch (kind) {
    case "person": {
      const shirt = SHIRTS[i % SHIRTS.length];
      return (
        <g>
          {shadow}
          <g>
            {/* legs */}
            <rect x={-3.6} y={-7} width={3} height={8} rx={1.4} fill="#334155" />
            <rect x={0.6} y={-7} width={3} height={8} rx={1.4} fill="#1e293b" />
            {/* torso + arms */}
            <rect x={-5} y={-17} width={10} height={11} rx={4} fill={shirt} />
            <rect x={-6.4} y={-15.5} width={2.4} height={8} rx={1.2} fill={shirt} />
            <rect x={4} y={-15.5} width={2.4} height={8} rx={1.2} fill={shirt} opacity={0.85} />
            <rect x={-1.6} y={-15} width={3.2} height={2} rx={0.6} fill="#fff" opacity={0.8} />
            {/* head + hair */}
            <circle cy={-21.5} r={4.3} fill="#f5c9a4" />
            <path d="M -4.3 -22 A 4.3 4.3 0 0 1 4.3 -22 L 4.3 -23.5 A 4.3 3.4 0 0 0 -4.3 -23.5 Z" fill="#3f2a1d" />
            <circle cx={-1.4} cy={-22.6} r={1.3} fill="#fff" opacity={0.5} />
            {live && <animateTransform attributeName="transform" type="translate" values="0 0;0 -1.6;0 0" dur="0.45s" begin={`${i * 0.07}s`} repeatCount="indefinite" />}
          </g>
        </g>
      );
    }
    case "car": {
      const paint = PAINT[i % PAINT.length];
      const p = (x: number, y: number, z: number): [number, number] => [(x - y) * 0.866 * S, (x + y) * 0.5 * S - z * S];
      const wheel = (x: number, y: number) => <ellipse cx={p(x, y, 0.05)[0]} cy={p(x, y, 0.05)[1]} rx={3.2} ry={3.6} fill="#0f172a" />;
      return (
        <g>
          {shadow}
          {wheel(-0.2, 0.17)}
          {wheel(0.2, 0.17)}
          <LocalCube w={0.66} d={0.34} h={0.17} z={0.05} c={paint} />
          {/* cabin with tinted glass + reflection */}
          <LocalCube w={0.36} d={0.3} h={0.14} z={0.22} c="#1e293b" topC={paint} />
          <polygon points={[p(-0.16, 0.15, 0.25), p(-0.02, 0.15, 0.25), p(-0.08, 0.15, 0.33), p(-0.16, 0.15, 0.33)].map((q) => q.join(",")).join(" ")} fill="#fff" opacity={0.35} />
          {/* headlights (front = +x) and tail lights */}
          <circle cx={p(0.33, -0.08, 0.14)[0]} cy={p(0.33, -0.08, 0.14)[1]} r={1.6} fill="#fde68a" />
          <circle cx={p(0.33, 0.08, 0.14)[0]} cy={p(0.33, 0.08, 0.14)[1]} r={1.6} fill="#fde68a" />
          <circle cx={p(-0.33, 0.17, 0.14)[0]} cy={p(-0.33, 0.17, 0.14)[1]} r={1.3} fill="#ef4444" />
        </g>
      );
    }
    case "drop":
      return (
        <g>
          <ellipse cx={0} cy={2} rx={8} ry={3.6} fill={color} opacity={0.3} />
          <ellipse cx={0} cy={2} rx={11} ry={5} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={1} />
          <path d="M0 -21 C 5.5 -13, 9 -8.5, 9 -4.5 A 9 9 0 0 1 -9 -4.5 C -9 -8.5, -5.5 -13, 0 -21 Z" fill={color} />
          <path d="M0 -21 C 5.5 -13, 9 -8.5, 9 -4.5 A 9 9 0 0 1 0 4.5 Z" fill="#000" opacity={0.12} />
          <ellipse cx={-3} cy={-8} rx={2} ry={3.2} fill="#fff" opacity={0.7} />
          <circle cx={-1} cy={-13} r={1} fill="#fff" opacity={0.8} />
        </g>
      );
    case "box":
      return (
        <g>
          {shadow}
          <LocalCube w={0.36} d={0.36} h={0.34} c={i % 3 === 1 ? "#f59e0b" : color} />
          {/* tape across the top + a label on the side */}
          <polygon points={[[-0.03, -0.18], [0.03, -0.18], [0.03, 0.18], [-0.03, 0.18]].map(([x, y]) => [(x - y) * 0.866 * S, (x + y) * 0.5 * S - 0.34 * S].join(",")).join(" ")} fill="#fff" opacity={0.7} />
          <rect x={4} y={-7} width={5} height={4} fill="#fff" opacity={0.85} transform="skewY(-30)" />
        </g>
      );
    case "parcel":
      return (
        <g>
          {shadow}
          <LocalCube w={0.42} d={0.34} h={0.3} c="#c8a27a" topC="#dcbd98" />
          <polygon points={[[-0.03, -0.17], [0.03, -0.17], [0.03, 0.17], [-0.03, 0.17]].map(([x, y]) => [(x - y) * 0.866 * S, (x + y) * 0.5 * S - 0.3 * S].join(",")).join(" ")} fill="#a07850" />
          {/* shipping label in the accent colour */}
          <polygon points={[[0.05, 0.17, 0.08], [0.18, 0.17, 0.08], [0.18, 0.17, 0.2], [0.05, 0.17, 0.2]].map(([x, y, z]) => [(x - y) * 0.866 * S, (x + y) * 0.5 * S - z * S].join(",")).join(" ")} fill="#fff" />
          <polygon points={[[0.05, 0.17, 0.16], [0.18, 0.17, 0.16], [0.18, 0.17, 0.2], [0.05, 0.17, 0.2]].map(([x, y, z]) => [(x - y) * 0.866 * S, (x + y) * 0.5 * S - z * S].join(",")).join(" ")} fill={color} />
        </g>
      );
    case "packet":
      return (
        <g>
          <ellipse cx={0} cy={2} rx={7} ry={3} fill={color} opacity={0.3} />
          <circle cy={-11} r={10} fill={color} opacity={0.16} />
          <circle cy={-11} r={6} fill={color} />
          <circle cy={-11} r={6} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={-2} cy={-13} r={1.8} fill="#fff" opacity={0.85} />
          {live && (
            <circle cy={-11} r={6} fill="none" stroke={color} strokeWidth={1.4}>
              <animate attributeName="r" values="6;14" dur="1.2s" begin={`${i * 0.13}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0" dur="1.2s" begin={`${i * 0.13}s`} repeatCount="indefinite" />
            </circle>
          )}
        </g>
      );
  }
}

// The whole diorama for one industry (also used by the dashboard's New Simulation modal).
export function Diorama({ t, live }: { t: SimType; live: boolean }) {
  const N = 10;
  const DUR = 11;
  const slab = -0.55;
  const ctx: Ctx = { c: t.color, tint: t.tint, live };
  const H = HEIGHTS[t.id];
  return (
    <div className="absolute inset-0">
      <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="st-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor={t.tint} />
          </linearGradient>
          <linearGradient id="cyl-shade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity={0.3} />
            <stop offset="45%" stopColor="#fff" stopOpacity={0} />
            <stop offset="100%" stopColor="#000" stopOpacity={0.28} />
          </linearGradient>
          <pattern id="stripes" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <rect width="4" height="8" fill="#fff" opacity={0.55} />
          </pattern>
        </defs>

        {/* Soft floor shadow under the floating slab */}
        <ellipse cx={iso(5, 3, 0)[0]} cy={iso(5, 3, 0)[1] + 60} rx={250} ry={62} fill={t.color} opacity={0.12} />

        {/* Platform slab: light sides tinted with the accent */}
        <polygon points={pts([0, 6, slab], [10, 6, slab], [10, 6, 0], [0, 6, 0])} fill="#e4e1f3" />
        <polygon points={pts([10, 0, slab], [10, 6, slab], [10, 6, 0], [10, 0, 0])} fill="#d3cfe8" />
        <polygon points={pts([0, 6, slab], [10, 6, slab], [10, 6, 0], [0, 6, 0])} fill={t.color} opacity={0.28} />
        <polygon points={pts([10, 0, slab], [10, 6, slab], [10, 6, 0], [10, 0, 0])} fill={t.color} opacity={0.4} />
        <polyline points={pts([0, 6, -0.2], [10, 6, -0.2], [10, 0, -0.2])} fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={1} />
        <polygon points={pts([0, 0, 0], [10, 0, 0], [10, 6, 0], [0, 6, 0])} fill="url(#st-top)" />
        <g stroke={t.color} strokeOpacity={0.12} strokeWidth={1}>
          {Array.from({ length: 9 }, (_, i) => <line key={`x${i}`} x1={iso(i + 1, 0)[0]} y1={iso(i + 1, 0)[1]} x2={iso(i + 1, 6)[0]} y2={iso(i + 1, 6)[1]} />)}
          {Array.from({ length: 5 }, (_, i) => <line key={`y${i}`} x1={iso(0, i + 1)[0]} y1={iso(0, i + 1)[1]} x2={iso(10, i + 1)[0]} y2={iso(10, i + 1)[1]} />)}
        </g>
        <polyline points={pts([0, 6, 0], [10, 6, 0], [10, 0, 0])} fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={1.5} />

        {/* The domain's ground, trees, lamps and props */}
        <Ground kind={GROUND[t.id]} c={t.color} live={live} />
        {TREES.map(([tx, ty, ts], i) => <Tree key={`tree-${i}`} x={tx} y={ty} s={ts} />)}
        {LAMPS.map(([lx, ly], i) => <Lamp key={`lamp-${i}`} x={lx} y={ly} c={t.color} />)}
        <Props id={t.id} ctx={ctx} />

        {/* Stations drop in */}
        {(Stations({ id: t.id, ctx }) ?? []).map((node, i) => (
          <motion.g key={`${t.id}-st-${i}`} initial={{ y: -70, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring(11, 0.62, 0.1 + i * 0.1)}>
            {node}
            {/* Busy middle station: pulsing beacon above it */}
            {i === 1 && live && (
              <circle cx={iso(SPOTS[1].x, SPOTS[1].y, H[1])[0]} cy={iso(SPOTS[1].x, SPOTS[1].y, H[1])[1] - 8} r={4} fill="none" stroke={t.color} strokeWidth={2}>
                <animate attributeName="r" values="4;18" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}
          </motion.g>
        ))}

        {/* Entities: fast approach, crawl through the queue in front of the middle station, then out the far edge */}
        {live &&
          Array.from({ length: N }, (_, i) => (
            <g key={`${t.id}-e-${i}`}>
              <Entity kind={t.token} color={t.color} i={i} live={live} />
              <animateMotion dur={`${DUR}s`} begin={`${(-i * DUR) / N}s`} repeatCount="indefinite" path={ROAD_D} keyPoints="0;0.36;0.5;1" keyTimes="0;0.22;0.68;1" calcMode="linear" />
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.05;0.95;1" dur={`${DUR}s`} begin={`${(-i * DUR) / N}s`} repeatCount="indefinite" />
            </g>
          ))}
      </svg>

      {/* Floating labels above each station */}
      {SPOTS.map((s, i) => {
        const st = t.stations[i];
        const Icon = st.icon;
        return (
          <motion.div
            key={`${t.id}-lbl-${i}`}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={pct(iso(s.x, s.y, H[i] + 0.35))}
            initial={{ opacity: 0, y: -14, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={spring(13, 0.7, 0.35 + i * 0.1)}
          >
            <div className={i === 1 ? "lp-float" : "lp-float-slow"}>
              <div className="flex items-center gap-1.5 rounded-full bg-white/95 pl-1 pr-2.5 py-1 shadow-[0_8px_20px_-8px_rgba(0,0,0,.45)]">
                <span className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-white" style={{ background: t.color }}>
                  <Icon size={12} strokeWidth={2.4} />
                </span>
                <span className="text-[9px] sm:text-[11px] font-bold text-[#161622] whitespace-nowrap">{st.label}</span>
                {i === 1 && (
                  <span className="hidden sm:flex items-end gap-[2px] h-3 ml-0.5">
                    {[0, 1, 2].map((b) => (
                      <span key={b} className="lp-bar w-[3px] h-3 rounded-sm" style={{ background: t.color, animationDelay: `${b * 0.15}s` }} />
                    ))}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// Tilts toward the pointer for a real 3D feel; eases back when the pointer leaves.
function TiltStage({ children }: { children: React.ReactNode }) {
  const rx = useSpring(useMotionValue(0), { stiffness: 120, damping: 18 });
  const ry = useSpring(useMotionValue(0), { stiffness: 120, damping: 18 });
  return (
    <div
      className="absolute inset-0"
      style={{ perspective: 1100 }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        rx.set(((e.clientY - r.top) / r.height - 0.5) * -10);
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 12);
      }}
      onPointerLeave={() => { rx.set(0); ry.set(0); }}
    >
      <motion.div className="absolute inset-0" style={{ rotateX: rx, rotateY: ry }}>
        {children}
      </motion.div>
    </div>
  );
}

// Pin + scroll-scrub only where the whole stage fits on screen (desktop, not too short).
const PIN_QUERY = "(min-width: 1024px) and (min-height: 700px)";
const subscribePin = (cb: () => void) => {
  const m = window.matchMedia(PIN_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

export default function SimTypesSection() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const pinned = useSyncExternalStore(subscribePin, () => window.matchMedia(PIN_QUERY).matches, () => false);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const onScreen = useInView(stageRef, { amount: 0.3 });
  const lenis = useLenis();
  const t = TYPES[active];

  // Pinned: scrolling through the tall track steps through the industries.
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (!pinned) return;
    const i = Math.min(TYPES.length - 1, Math.max(0, Math.floor(v * TYPES.length)));
    setActive((a) => (a === i ? a : i));
  });

  // Not pinned (phones): auto-advance while visible and not touched.
  useEffect(() => {
    if (pinned || !onScreen || paused) return;
    const id = setTimeout(() => setActive((a) => (a + 1) % TYPES.length), CYCLE_MS);
    return () => clearTimeout(id);
  }, [active, onScreen, paused, pinned]);

  // Pinned: a tab click scrolls to the middle of that industry's stretch of the track.
  const pick = (i: number) => {
    const el = trackRef.current;
    if (!pinned || !el || !lenis) return setActive(i);
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    lenis.scrollTo(top + (span * (i + 0.5)) / TYPES.length, { duration: 1.1 });
  };

  return (
    // overflow-x-clip (not hidden) so the sticky stage keeps working
    <section id="simulations" className="relative pt-20 md:pt-32 pb-20 md:pb-24 px-4 bg-[#fcfcff] font-sans overflow-x-clip border-t border-[#f1f0fa]">
      <Backdrop tone="b" />
      <div className="relative z-10 max-w-[1240px] mx-auto">
        <SectionHeader
          title="Visualize"
          accent="Any Industry"
          sub="Pick a context and watch it run. Every type ships with its own animated entities, stations and flows."
          className="!mb-6 md:!mb-8"
        />
      </div>

      {/* Tall scroll track; the stage sticks while you scroll through it */}
      <div ref={trackRef} className="relative z-10" style={pinned ? { height: `${TYPES.length * 70 + 30}vh` } : undefined}>
        <div className={pinned ? "sticky top-0 h-screen flex items-center pt-16" : ""}>
        <div
          ref={stageRef}
          className="max-w-[1240px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[290px_1fr] gap-5 lg:gap-6 items-center"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Tabs: vertical list on desktop, swipeable row on mobile */}
          <Reveal y={20}>
            <div className="relative">
            {/* Scroll progress rail beside the tabs */}
            {pinned && (
              <div aria-hidden className="absolute -left-4 top-2 bottom-2 w-[3px] rounded-full bg-[#ecebf7] overflow-hidden">
                <motion.div className="h-full w-full origin-top rounded-full" style={{ scaleY: scrollYProgress, background: t.color, transition: "background-color .6s" }} />
              </div>
            )}
            <div role="tablist" aria-label="Simulation types" className="flex lg:flex-col gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 pb-1 lg:pb-0">
              {TYPES.map((ty, i) => {
                const on = i === active;
                const Icon = ty.icon;
                return (
                  <button
                    key={ty.id}
                    role="tab"
                    aria-selected={on}
                    onClick={() => pick(i)}
                    className="relative shrink-0 lg:w-full flex items-center gap-3 rounded-2xl p-2.5 pr-4 text-left"
                  >
                    {on && (
                      <motion.span
                        layoutId="simtype-pill"
                        className="absolute inset-0 rounded-2xl bg-white border border-[#ecebf7] shadow-[0_1px_2px_rgba(16,24,40,.05),0_10px_24px_-14px_rgba(16,24,40,.22)] overflow-hidden"
                        transition={spring(18, 0.85)}
                      >
                        {!pinned && onScreen && !paused && (
                          <motion.span
                            key={active}
                            className="absolute bottom-0 left-0 h-[2px] w-full origin-left"
                            style={{ background: ty.color }}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: CYCLE_MS / 1000, ease: "linear" }}
                          />
                        )}
                      </motion.span>
                    )}
                    <motion.span
                      className="relative flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
                      animate={{ backgroundColor: on ? ty.color : ty.tint, color: on ? "#ffffff" : ty.color, rotate: on ? -6 : 0 }}
                      transition={spring(16, 0.7)}
                    >
                      <Icon size={19} strokeWidth={2.2} />
                    </motion.span>
                    <span className="relative">
                      <span className={`block text-[14px] font-bold whitespace-nowrap transition-colors ${on ? "text-[#161622]" : "text-[#475569]"}`}>{ty.name}</span>
                      <span className="hidden lg:block text-[12px] text-[#94a3b8]">{ty.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            </div>
            {pinned && (
              <ScrollCue className="mt-6 pl-1" label={`Scroll to explore · ${active + 1}/${TYPES.length}`} />
            )}
          </Reveal>

          {/* Stage: bright studio, lit diorama. Pinned: width capped so the whole stage fits the screen height. */}
          <Reveal delay={0.1} y={30}>
            <div
              className="relative mx-auto w-full rounded-[2rem] overflow-hidden border border-[#ecebf7] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_30px_60px_-30px_rgba(16,24,40,.22)]"
              style={pinned ? { maxWidth: "calc((100vh - 16rem) * 1.52)" } : undefined}
            >
              {/* Studio backdrop: white fading into the industry tint, accent light pooling under the platform */}
              <motion.div
                aria-hidden
                className="absolute inset-0"
                animate={{ background: `radial-gradient(ellipse 60% 50% at 50% 68%, ${t.color}2e, transparent 70%), linear-gradient(180deg, #ffffff 0%, ${t.tint} 100%)` }}
                transition={{ duration: 0.8 }}
              />
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage: "radial-gradient(rgba(22,22,34,.09) 1.1px, transparent 1.6px)",
                  backgroundSize: "24px 24px",
                  maskImage: "radial-gradient(ellipse 75% 70% at 50% 40%, #000 20%, transparent 85%)",
                  WebkitMaskImage: "radial-gradient(ellipse 75% 70% at 50% 40%, #000 20%, transparent 85%)",
                }}
              />

              {/* HUD */}
              <div className="relative z-10 flex items-start justify-between gap-3 px-5 sm:px-7 pt-5 sm:pt-6">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: t.color }}>Live preview</div>
                    <div className="font-space font-bold text-[22px] sm:text-[28px] tracking-[-0.03em] text-[#161622]">{t.name}</div>
                  </motion.div>
                </AnimatePresence>
                <span className="flex items-center gap-2 h-8 px-3 rounded-full bg-white border border-[#ecebf7] text-[11px] font-bold text-[#12a150] shrink-0 shadow-[0_4px_12px_-6px_rgba(16,24,40,.2)]">
                  <span className="relative flex w-2 h-2">
                    <span className="absolute inset-0 rounded-full bg-[#12a150] animate-ping opacity-60" />
                    <span className="relative w-2 h-2 rounded-full bg-[#12a150]" />
                  </span>
                  Running
                </span>
              </div>

              {/* Live meters (illustrative, no figures) */}
              <div className="hidden md:block absolute right-6 top-20 z-10 w-44 rounded-2xl bg-white/85 border border-white p-3 shadow-[0_12px_28px_-14px_rgba(16,24,40,.3)]">
                {[
                  { k: "Throughput", d: "2.8s" },
                  { k: "Utilization", d: "3.6s" },
                  { k: "Queue length", d: "2.2s" },
                ].map((m, i) => (
                  <div key={m.k} className={i ? "mt-2.5" : ""}>
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94a3b8]">{m.k}</div>
                    <div className="mt-1 h-1.5 rounded-full bg-[#f1f0fa] overflow-hidden">
                      <div className="lp-meter h-full w-full rounded-full origin-left" style={{ background: t.color, animationDuration: m.d, transition: "background-color .6s" }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Diorama */}
              <div className="relative -mt-4 sm:-mt-8 aspect-[640/420]">
                <TiltStage>
                  <div className="lp-float-slow absolute inset-0">
                    <Diorama t={t} live={onScreen} />
                  </div>
                </TiltStage>
              </div>

              {/* Examples + CTA */}
              <div className="relative z-10 -mt-2 sm:-mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 sm:px-7 pb-5 sm:pb-6">
                <div className="flex flex-wrap gap-2">
                  {t.examples.map((ex, i) => (
                    <motion.span
                      key={`${t.id}-${ex}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={spring(16, 0.8, 0.2 + i * 0.06)}
                      className="h-8 inline-flex items-center px-3 rounded-full bg-white border border-[#ecebf7] text-[12px] font-semibold text-[#334155] shadow-[0_4px_12px_-8px_rgba(16,24,40,.25)]"
                    >
                      {ex}
                    </motion.span>
                  ))}
                </div>
                <Link
                  href="/signup"
                  className="group inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full text-white text-[13px] font-semibold shrink-0 transition-transform duration-300 hover:scale-[1.03] active:scale-[0.97]"
                  style={{ background: t.color, boxShadow: `0 10px 28px -8px ${t.color}` }}
                >
                  Try this template
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
        </div>
      </div>

      <div className="relative z-10 max-w-[1240px] mx-auto">
        <Reveal delay={0.2} className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-gray-500 font-medium">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-indigo-50 text-indigo-500 flex items-center justify-center"><Plus size={12} strokeWidth={3} /></div>
            Extensible: More types added regularly.
          </div>
          <div className="hidden sm:block text-gray-300">|</div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold">
            <Star size={12} fill="currentColor" /> Custom Types on Pro
          </div>
        </Reveal>
      </div>
    </section>
  );
}
