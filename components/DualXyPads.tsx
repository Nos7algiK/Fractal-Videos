'use client';

import React, { useRef, useState } from 'react';
import { Crosshair, Sliders, X } from 'lucide-react';
import { transientState, useStudioStore } from '@/lib/store';

export default function DualXyPads() {
  const showXyPads = useStudioStore((s) => s.showXyPads);
  const setShowXyPads = useStudioStore((s) => s.setShowXyPads);
  const setShaderParam = useStudioStore((s) => s.setShaderParam);

  const [pad1Pos, setPad1Pos] = useState<[number, number]>(transientState.xyPad1);
  const [pad2Pos, setPad2Pos] = useState<[number, number]>(transientState.xyPad2);

  const pad1Ref = useRef<HTMLDivElement>(null);
  const pad2Ref = useRef<HTMLDivElement>(null);

  const updatePad1 = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = pad1Ref.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    const cx = Number(((nx - 0.5) * 2.0).toFixed(2));
    const cy = Number(((ny - 0.5) * 2.0).toFixed(2));
    transientState.xyPad1 = [cx, cy];
    setPad1Pos([cx, cy]);
  };

  const updatePad2 = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = pad2Ref.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = Number(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)).toFixed(2));
    const ny = Number(Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height)).toFixed(2));
    transientState.xyPad2 = [nx, ny];
    setPad2Pos([nx, ny]);
    setShaderParam('textureMix', ny);
  };

  const cutoffHz = Math.round(180 * Math.pow(100, pad2Pos[0]));

  return (
    <div
      data-hud-interactive="true"
      data-testid="dual-xy-pads-panel"
      aria-label="Dual Interactive Touch XY Pads"
      className="space-y-3 text-zinc-100"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-amber-400" />
            Dual Performance Touch XY Pads (60Hz Zero-Latency)
          </h2>
          <p className="text-[11px] text-zinc-400">
            Sweep 4D W-axis slice, Julia constants, world elevation & psychedelic filter/texture mix.
          </p>
        </div>
        {showXyPads && (
          <button
            type="button"
            onClick={() => setShowXyPads(false)}
            aria-label="Close XY Pads"
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Pad 1: Geometry & 4D Slice (u_paramA, u_paramB) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-200">XY Pad 1: 4D Slice & Geometry</span>
            <span className="font-mono tabular-nums text-amber-400">
              ({pad1Pos[0].toFixed(2)}, {pad1Pos[1].toFixed(2)})
            </span>
          </div>
          <div
            ref={pad1Ref}
            role="slider"
            aria-label="Geometry and 4D Slice XY Pad"
            aria-valuenow={Math.round(pad1Pos[0] * 100)}
            tabIndex={0}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              updatePad1(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons > 0) updatePad1(e);
            }}
            className="relative h-36 w-full bg-zinc-900 border border-amber-400/35 rounded-lg overflow-hidden cursor-crosshair select-none"
            style={{ touchAction: 'none' }}
          >
            <div className="absolute inset-x-0 top-1/2 h-px bg-white/10 pointer-events-none" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/10 pointer-events-none" />
            <div
              className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-amber-400 border-2 border-zinc-950 shadow-lg pointer-events-none transition-transform duration-75"
              style={{
                left: `${((pad1Pos[0] + 1) / 2) * 100}%`,
                top: `${(1 - (pad1Pos[1] + 1) / 2) * 100}%`,
              }}
            />
            <div className="absolute bottom-1.5 left-2 text-[10px] text-zinc-400 pointer-events-none">
              X: 4D XW / Zeno Twist · Y: 4D YW / Zeno Zoom / World Elev
            </div>
          </div>
        </div>

        {/* Pad 2: Psychedelic FX & Texture Mix */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-200 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              XY Pad 2: Psychedelic FX & Texture
            </span>
            <span className="font-mono tabular-nums text-cyan-400">
              {cutoffHz}Hz · {Math.round(pad2Pos[1] * 100)}%
            </span>
          </div>
          <div
            ref={pad2Ref}
            role="slider"
            aria-label="Psychedelic FX and Texture Mix XY Pad"
            aria-valuenow={Math.round(pad2Pos[0] * 100)}
            tabIndex={0}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              updatePad2(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons > 0) updatePad2(e);
            }}
            className="relative h-36 w-full bg-zinc-900 border border-cyan-400/35 rounded-lg overflow-hidden cursor-crosshair select-none"
            style={{ touchAction: 'none' }}
          >
            <div className="absolute inset-x-0 top-1/2 h-px bg-white/10 pointer-events-none" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/10 pointer-events-none" />
            <div
              className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-cyan-400 border-2 border-zinc-950 shadow-lg pointer-events-none transition-transform duration-75"
              style={{
                left: `${pad2Pos[0] * 100}%`,
                top: `${(1 - pad2Pos[1]) * 100}%`,
              }}
            />
            <div className="absolute bottom-1.5 left-2 text-[10px] text-zinc-400 pointer-events-none">
              X: Kaleido / Zeno Arrow Slice · Y: Emblem / Droste Mix
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
