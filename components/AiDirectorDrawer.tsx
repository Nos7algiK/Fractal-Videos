'use client';

import React from 'react';
import { Wand2, Sparkles, Clock, Check } from 'lucide-react';
import { useStudioStore } from '@/lib/store';
import { evaluateCosinePalette } from '@/lib/dsp-math';
import { FRACTAL_MODE_INFO } from '@/lib/presets';
import { FractalMode } from '@/lib/types';

export default function AiDirectorDrawer() {
  const activeInspectorTab = useStudioStore((s) => s.activeInspectorTab);
  const aiPromptInput = useStudioStore((s) => s.aiPromptInput);
  const isGeneratingAi = useStudioStore((s) => s.isGeneratingAi);
  const aiError = useStudioStore((s) => s.aiError);
  const acousticSummary = useStudioStore((s) => s.acousticSummary);
  const choreographies = useStudioStore((s) => s.choreographies);
  const activeChoreographyIndex = useStudioStore((s) => s.activeChoreographyIndex);
  const autoChoreographyEnabled = useStudioStore((s) => s.autoChoreographyEnabled);
  const activeSectionName = useStudioStore((s) => s.activeSectionName);
  const setShaderParam = useStudioStore((s) => s.setShaderParam);
  const applyChoreography = useStudioStore((s) => s.applyChoreography);
  const selectChoreographyIndex = useStudioStore((s) => s.selectChoreographyIndex);
  const setFractalMode = useStudioStore((s) => s.setFractalMode);

  if (activeInspectorTab !== 'export') return null;

  const activeChoreo = choreographies[activeChoreographyIndex] ?? choreographies[0];

  const handleGenerateChoreography = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPromptInput.trim() || isGeneratingAi) return;

    setShaderParam('isGeneratingAi', true);
    setShaderParam('aiError', null);

    try {
      const res = await fetch('/api/ai-choreograph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPromptInput.trim(),
          acousticSummary,
        }),
      });
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const data = await res.json();
      if (data.choreography) {
        applyChoreography(data.choreography, true);
      }
    } catch (err) {
      setShaderParam(
        'aiError',
        err instanceof Error ? err.message : 'Unable to generate AI choreography'
      );
    } finally {
      setShaderParam('isGeneratingAi', false);
    }
  };

  return (
    <div
      data-hud-interactive="true"
      aria-label="AI Art Director and Visual Choreography"
      className="space-y-4 text-zinc-100"
    >
      <div>
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-amber-400" />
          AI Art Director & Synesthetic Choreography
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Synthesizes 28D track acoustics with your creative vibe into Cosine Palettes and section keyframes.
        </p>
      </div>

      {/* Form to generate custom AI Visual Choreography */}
      <form onSubmit={handleGenerateChoreography} className="space-y-2">
        <label htmlFor="ai-vibe-prompt" className="block text-xs font-medium text-zinc-300">
          Creative Vibe Prompt
        </label>
        <input
          id="ai-vibe-prompt"
          type="text"
          value={aiPromptInput}
          onChange={(e) => setShaderParam('aiPromptInput', e.target.value)}
          placeholder="e.g. Cyberpunk Interstellar Wormhole with liquid gold highlights..."
          className="w-full bg-zinc-900 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
        />
        <button
          type="submit"
          disabled={isGeneratingAi || !aiPromptInput.trim()}
          className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {isGeneratingAi ? 'Choreographing...' : 'Generate AI Choreography'}
        </button>
        {aiError && <p className="text-xs text-red-400">{aiError}</p>}
      </form>

      {/* Extracted 28-Dimensional Track Acoustic Summary */}
      {acousticSummary && (
        <div className="p-3 bg-zinc-900/90 border border-white/10 rounded-lg">
          <div className="flex items-center justify-between gap-2 mb-2 text-xs">
            <span className="font-medium text-zinc-200 truncate">
              28D Profile: <span className="text-amber-400">{acousticSummary.trackName}</span>
            </span>
            <span className="text-zinc-400 font-mono tabular-nums shrink-0">
              {acousticSummary.estimatedBpm} BPM · {acousticSummary.dominantKey}
            </span>
          </div>
          <div className="grid grid-cols-28 gap-0.5 h-6 items-end" aria-label="28-Dimensional Acoustic Feature Vector">
            {acousticSummary.featureVector28D.map((val, idx) => (
              <div
                key={idx}
                className="bg-amber-400/75 rounded-t-xs transition-all"
                style={{ height: `${Math.max(15, Math.round(val * 100))}%` }}
                title={`Band Feature ${idx + 1}: ${val}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Curated & AI-Generated Choreography Presets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-300">Choreography Presets</span>
          <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoChoreographyEnabled}
              onChange={(e) => setShaderParam('autoChoreographyEnabled', e.target.checked)}
              className="rounded border-white/20 bg-zinc-900 text-amber-500"
            />
            <span>Auto-Sync Keyframes</span>
          </label>
        </div>

        <div className="space-y-2">
          {choreographies.map((choreo, idx) => {
            const isSelected = idx === activeChoreographyIndex;
            const c0 = evaluateCosinePalette(0.15, choreo.palette);
            const c1 = evaluateCosinePalette(0.5, choreo.palette);
            const c2 = evaluateCosinePalette(0.85, choreo.palette);
            const grad = `linear-gradient(90deg, rgb(${Math.round(c0[0]*255)},${Math.round(c0[1]*255)},${Math.round(c0[2]*255)}), rgb(${Math.round(c1[0]*255)},${Math.round(c1[1]*255)},${Math.round(c1[2]*255)}), rgb(${Math.round(c2[0]*255)},${Math.round(c2[1]*255)},${Math.round(c2[2]*255)}))`;

            return (
              <button
                key={`${choreo.name}-${idx}`}
                type="button"
                onClick={() => selectChoreographyIndex(idx)}
                className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                  isSelected
                    ? 'bg-zinc-900 border-amber-400/80 text-white'
                    : 'bg-zinc-900/50 border-white/10 text-zinc-300 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold truncate">{choreo.name}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </div>
                <p className="text-[11px] text-zinc-400 line-clamp-1 mb-1.5">{choreo.vibeDescription}</p>
                <div className="h-1.5 w-full rounded-sm" style={{ background: grad }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Song Section Timeline Keyframes */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 mb-2">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>Song Sections (Click to audition)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {activeChoreo.timelineKeyframes.map((kf) => {
            const isCurrent = activeSectionName === kf.section;
            const modeLabel = FRACTAL_MODE_INFO[kf.fractalMode]?.shortName ?? `Mode ${kf.fractalMode}`;
            return (
              <button
                key={kf.section}
                type="button"
                onClick={() => {
                  setShaderParam('activeSectionName', kf.section);
                  setShaderParam('cameraSpeed', kf.speedMultiplier);
                  setShaderParam('bloomIntensity', kf.bloomIntensity);
                  setShaderParam('bulbPower', kf.bulbPower);
                  setShaderParam('kleinianScale', kf.kleinianScale);
                  setShaderParam('foldLimit', kf.foldLimit);
                  setShaderParam('chaosMode', kf.chaosMode);
                  setFractalMode(kf.fractalMode as FractalMode);
                }}
                className={`p-2 rounded-lg border text-left transition-colors ${
                  isCurrent
                    ? 'bg-zinc-900 border-cyan-400 text-white'
                    : 'bg-zinc-900/60 border-white/10 text-zinc-300 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>{kf.section}</span>
                  <span className="font-mono tabular-nums text-[10px] text-zinc-400">
                    {Math.round(kf.startTimeRatio * 100)}%
                  </span>
                </div>
                <div className="text-[10px] text-amber-400 truncate mt-0.5">{modeLabel}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
