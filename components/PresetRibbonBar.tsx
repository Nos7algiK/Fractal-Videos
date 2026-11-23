'use client';

import React, { useEffect, useState } from 'react';
import { Bookmark, Check, Palette, Plus, Star, Sparkles } from 'lucide-react';
import { useStudioStore } from '@/lib/store';
import { captureCanvasThumbnailDataUrl } from './FractalCanvas';
import { COSINE_PALETTE_PRESETS, FRACTAL_MODE_INFO } from '@/lib/presets';
import { evaluateCosinePalette } from '@/lib/dsp-math';

export default function PresetRibbonBar() {
  const presets = useStudioStore((s) => s.presets);
  const activePresetId = useStudioStore((s) => s.activePresetId);
  const loadPreset = useStudioStore((s) => s.loadPreset);
  const saveNewPreset = useStudioStore((s) => s.saveNewPreset);
  const hydratePresetsFromStorage = useStudioStore((s) => s.hydratePresetsFromStorage);
  const palette = useStudioStore((s) => s.palette);
  const setPalette = useStudioStore((s) => s.setPalette);

  const [isSaving, setIsSaving] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [savedToast, setSavedToast] = useState<string | null>(null);

  useEffect(() => {
    hydratePresetsFromStorage();
  }, [hydratePresetsFromStorage]);

  const handleQuickSave = (e: React.FormEvent) => {
    e.preventDefault();
    const thumb = captureCanvasThumbnailDataUrl(160, 90);
    const created = saveNewPreset(presetNameInput, 'User Custom', thumb);
    setPresetNameInput('');
    setIsSaving(false);
    setSavedToast(`Saved "${created.name}"`);
    window.setTimeout(() => setSavedToast(null), 2400);
  };

  return (
    <div
      data-testid="preset-ribbon-bar"
      className="shrink-0 bg-[#070A12]/95 border-b border-white/10 px-2.5 py-1.5 space-y-1"
    >
      {/* Row 1: 25 Factory + User Presets Horizontal Ribbon */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300/90 shrink-0 pr-1">
          <Bookmark className="w-3 h-3 text-amber-400" />
          <span className="hidden sm:inline">Presets ({presets.length})</span>
        </span>

        {/* Quick-Save Trigger Button */}
        <button
          type="button"
          data-testid="save-preset-ribbon-btn"
          onClick={() => setIsSaving((prev) => !prev)}
          className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
            isSaving
              ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/60'
              : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-400/40'
          }`}
          title="Save current visualizer mode, macro sliders, and colors as a reusable preset"
        >
          <Plus className="w-3 h-3" />
          <span>Save Preset</span>
        </button>

        {savedToast && (
          <span
            data-testid="preset-saved-toast"
            className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[10px] font-semibold"
          >
            <Check className="w-3 h-3" />
            {savedToast}
          </span>
        )}

        {/* Horizontal Scrollable Preset Pills */}
        {presets.map((preset) => {
          const isActive = preset.id === activePresetId;
          const modeInfo =
            FRACTAL_MODE_INFO[preset.snapshot?.fractalMode ?? 0] ?? FRACTAL_MODE_INFO[0];
          return (
            <button
              key={preset.id}
              type="button"
              data-testid={`preset-pill-${preset.id}`}
              onClick={() => loadPreset(preset.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/25 to-amber-500/20 text-white border-cyan-400/60 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                  : 'bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 border-white/10'
              }`}
              title={`${preset.name} — ${modeInfo.shortName}: ${preset.description}`}
            >
              {preset.isFavorite && (
                <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />
              )}
              {!preset.isFactory && (
                <Sparkles className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
              )}
              <span className="truncate max-w-[130px]">{preset.name}</span>
            </button>
          );
        })}
      </div>

      {/* Row 2: Quick-Access Horizontal 24 Color Swatch Ribbon */}
      <div
        data-testid="color-swatch-ribbon"
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5"
      >
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-cyan-300/90 shrink-0 pr-1">
          <Palette className="w-3 h-3 text-cyan-400" />
          <span className="hidden sm:inline">Colors ({COSINE_PALETTE_PRESETS.length})</span>
        </span>
        {COSINE_PALETTE_PRESETS.map((p) => {
          const isCurrent =
            p.palette.d[0] === palette.d[0] &&
            p.palette.d[1] === palette.d[1] &&
            p.palette.d[2] === palette.d[2];
          const stops = [0.1, 0.5, 0.85].map((t) => {
            const [r, g, b] = evaluateCosinePalette(t, p.palette);
            return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
          });
          return (
            <button
              key={p.id}
              type="button"
              data-testid={`ribbon-palette-swatch-${p.id}`}
              onClick={() => setPalette(p.palette)}
              title={`${p.name} (${p.badge || 'Cosine Palette'})`}
              className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium border transition-all cursor-pointer ${
                isCurrent
                  ? 'bg-cyan-500/20 text-white border-cyan-400 shadow-sm'
                  : 'bg-black/40 hover:bg-white/[0.08] text-slate-300 border-white/10'
              }`}
            >
              <span
                className="w-3.5 h-3.5 rounded-sm shrink-0 border border-white/25"
                style={{ background: `linear-gradient(135deg, ${stops.join(', ')})` }}
              />
              <span className="truncate max-w-[105px]">{p.name}</span>
            </button>
          );
        })}
      </div>

      {/* Inline Save Preset Form */}
      {isSaving && (
        <form
          onSubmit={handleQuickSave}
          data-testid="quick-save-preset-form"
          className="mt-1.5 flex items-center gap-1.5 bg-black/50 p-1.5 rounded-lg border border-emerald-400/35"
        >
          <input
            type="text"
            data-testid="quick-save-preset-input"
            value={presetNameInput}
            onChange={(e) => setPresetNameInput(e.target.value)}
            placeholder="Name your preset (e.g. My Neon 4D Drop)..."
            className="flex-1 min-w-0 bg-white/[0.05] border border-white/15 rounded-md px-2.5 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            autoFocus
          />
          <button
            type="submit"
            data-testid="confirm-save-preset-btn"
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Snapshot</span>
          </button>
          <button
            type="button"
            onClick={() => setIsSaving(false)}
            className="shrink-0 px-2 py-1 rounded-md bg-white/[0.06] hover:bg-white/10 text-slate-300 text-xs cursor-pointer"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}

