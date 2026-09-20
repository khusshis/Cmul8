"use client";

import React from "react";
import { Play, Pause, RotateCcw, X } from "lucide-react";

interface PlaybackControlsProps {
  playing: boolean;
  onTogglePlay: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  onClose?: () => void;
  onReplay?: () => void;
  /** Playback position, shown as a progress bar and sim-time readout. */
  progress?: { index: number; total: number; simTime: number };
}

export default function PlaybackControls({
  playing,
  onTogglePlay,
  speed,
  onSpeedChange,
  onClose,
  onReplay,
  progress,
}: PlaybackControlsProps) {
  const speedOptions = [0.5, 1, 2, 5, 10];

  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/95 backdrop-blur-md border border-indigo-100 shadow-[0_12px_36px_rgba(87,66,255,0.18)] pointer-events-auto">
      {/* Live Badge */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-100 text-[#5742FF] text-[11px] font-black uppercase tracking-wider">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>Digital Twin</span>
      </div>

      <div className="h-4 w-[1px] bg-gray-200" />

      {/* Play / Pause */}
      <button
        onClick={onTogglePlay}
        className="w-8 h-8 rounded-xl bg-[#5742FF] hover:bg-[#4531E5] text-white flex items-center justify-center transition-all shadow-xs"
        title={playing ? "Pause animation layer" : "Resume animation layer"}
      >
        {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
      </button>

      {onReplay && (
        <button
          onClick={onReplay}
          className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-all"
          title="Replay the run from the start"
        >
          <RotateCcw size={14} />
        </button>
      )}

      {/* Speed Controls */}
      <div className="flex items-center rounded-xl bg-gray-100 p-0.5 border border-gray-200/60">
        {speedOptions.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-black transition-all ${
              speed === s
                ? "bg-white text-[#5742FF] shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {progress && (
        <div className="flex flex-col gap-1 w-28" title="Playback position through the recorded run">
          <div className="h-1.5 rounded-full bg-indigo-100 overflow-hidden">
            <div
              className="h-full bg-[#5742FF] rounded-full"
              style={{ width: `${progress.total > 0 ? Math.min(100, (progress.index / progress.total) * 100) : 0}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-gray-500 leading-none">
            {progress.total === 0 ? "Run a simulation" : `t = ${progress.simTime.toFixed(1)}s · ${progress.index}/${progress.total}`}
          </span>
        </div>
      )}

      {onClose && (
        <>
          <div className="h-4 w-[1px] bg-gray-200" />
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"
            title="Exit Digital Twin View"
          >
            <X size={14} />
          </button>
        </>
      )}
    </div>
  );
}
