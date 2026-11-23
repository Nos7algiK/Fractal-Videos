'use client';

import React from 'react';
import { Image as ImageIcon, Lock, Sliders, Sparkles, Unlock } from 'lucide-react';
import FractalCanvas from '@/components/FractalCanvas';
import StudioHud, { PreviewWindowHeader } from '@/components/StudioHud';
import TouchTimelineBar from '@/components/TouchTimelineBar';
import DualXyPads from '@/components/DualXyPads';
import ShaderAndTextureDrawer from '@/components/ShaderAndTextureDrawer';
import VideoExportDrawer from '@/components/VideoExportDrawer';
import SimpleMacroControls from '@/components/SimpleMacroControls';
import PresetRibbonBar from '@/components/PresetRibbonBar';
import { useStudioStore } from '@/lib/store';
import { StudioInspectorTab } from '@/lib/types';

export default function HomePage() {
  const activeInspectorTab = useStudioStore((s) => s.activeInspectorTab);
  const setActiveInspectorTab = useStudioStore((s) => s.setActiveInspectorTab);
  const controlComplexityMode = useStudioStore((s) => s.controlComplexityMode);
  const setControlComplexityMode = useStudioStore((s) => s.setControlComplexityMode);
  const autoChoreographyEnabled = useStudioStore((s) => s.autoChoreographyEnabled);
  const setShaderParam = useStudioStore((s) => s.setShaderParam);
  const viewMode = useStudioStore((s) => s.viewMode);
  const showXyPads = useStudioStore((s) => s.showXyPads);
  const setShowXyPads = useStudioStore((s) => s.setShowXyPads);
  const fractalMode = useStudioStore((s) => s.fractalMode);
  const resetCamera = useStudioStore((s) => s.resetCamera);
  const isPreviewHidden = useStudioStore((s) => s.isPreviewHidden);
  const offlineRenderActive = useStudioStore((s) => s.offlineRenderProgress.active);

  const inspectorScrollRef = React.useRef<HTMLDivElement>(null);

  const isStudioMode = viewMode === 'studio';
  const isCleanPlayerMode = viewMode === 'clean-player';
  const isZenFullscreen = viewMode === 'zen-fullscreen';

  // Section 5 Sorted Logical Tabs: Tab 1 = [AI Image -> 3D Fractal], Tab 4 = [Colors, Clarity & FX]
  const inspectorTabs: { id: StudioInspectorTab; shortLabel: string; fullLabel: string }[] = [
    { id: 'image', shortLabel: 'AI Image → 3D', fullLabel: '1. AI Image → 3D Fractal' },
    { id: 'modes', shortLabel: 'Presets/Modes', fullLabel: '2. Presets, Modes & Flow' },
    { id: 'geometry', shortLabel: 'Tune Mode', fullLabel: '3. Tune Active Mode' },
    { id: 'fx', shortLabel: 'Colors & Clarity', fullLabel: '4. Colors, Clarity & FX' },
    { id: 'audio', shortLabel: 'Audio & Bass', fullLabel: '5. Audio Sync & Bass' },
    { id: 'export', shortLabel: 'AI & Export', fullLabel: '6. AI & Video Export' },
  ];

  const handleSelectTab = (tabId: StudioInspectorTab) => {
    setActiveInspectorTab(tabId);
    if (inspectorScrollRef.current) {
      inspectorScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const isDedicatedSubTabActiveInSimple =
    controlComplexityMode === 'simple' &&
    (activeInspectorTab === 'image' || activeInspectorTab === 'export');

  return (
    <main
      id="studio"
      data-testid="studio-main"
      data-view-mode={viewMode}
      data-preview-hidden={isPreviewHidden}
      className="w-screen h-[100dvh] min-h-[100dvh] flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden select-none"
    >
      {/* Top Bar (Visible on Desktop in State A: Studio VJ Mode) */}
      {isStudioMode && (
        <div className="hidden lg:block shrink-0">
          <StudioHud />
        </div>
      )}

      {/* Split-Screen Real-Time Tweaking Workspace (Pinned Top Video Preview + Bottom Settings on Mobile; Left/Right Split on Desktop) */}
      <div
        className={`flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 ${
          isStudioMode
            ? 'gap-1.5 p-1.5 sm:gap-2.5 sm:p-2.5 overflow-hidden'
            : isCleanPlayerMode
              ? 'gap-2 p-2 overflow-hidden'
              : 'gap-0 p-0 overflow-hidden'
        }`}
      >
        {/* TOP DOCK: Always-Visible Real-Time Video Preview + Compact Timeline Scrubber */}
        <section
          aria-label="Dedicated Video Preview Monitor Workspace"
          data-testid="top-video-preview-dock"
          className={`${
            isStudioMode
              ? isPreviewHidden
                ? offlineRenderActive
                  ? 'h-[260px] shrink-0 lg:h-full lg:min-h-0 lg:col-span-7 xl:col-span-8'
                  : 'h-[156px] shrink-0 lg:h-full lg:min-h-0 lg:col-span-7 xl:col-span-8'
                : 'h-[45dvh] min-h-[240px] max-h-[410px] shrink-0 lg:h-full lg:min-h-0 lg:max-h-none lg:col-span-7 xl:col-span-8'
              : 'flex-1 min-h-0 h-full lg:col-span-12'
          } flex flex-col transition-all duration-150 ${isZenFullscreen ? 'gap-0' : 'gap-1 sm:gap-1.5'}`}
        >
          {/* Framed Video Preview Monitor Window (100% Unobstructed in Real Time While Tweaking Settings) */}
          <div
            className={`flex-1 ${isPreviewHidden ? 'min-h-[68px]' : 'min-h-[160px]'} flex flex-col overflow-hidden ${
              isZenFullscreen
                ? 'bg-black border-0 rounded-none'
                : 'bg-zinc-900/90 border border-white/15 rounded-xl shadow-2xl'
            }`}
          >
            {isStudioMode && <PreviewWindowHeader />}
            <div
              className={`flex-1 min-h-0 relative bg-black flex items-center justify-center ${
                isStudioMode ? 'p-0.5 sm:p-1.5' : 'p-0'
              }`}
            >
              <FractalCanvas />
              {/* Desktop-only floating XY Pad popover; on mobile XY Pads live inside Fine Tune so the preview is never covered */}
              {isStudioMode && showXyPads && (
                <div className="hidden lg:block absolute inset-x-3 bottom-3 z-20 max-w-lg mx-auto bg-zinc-950/95 backdrop-blur-md border border-white/15 rounded-xl p-3 shadow-2xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-amber-300">
                      Floating Touch XY Pads
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowXyPads(false)}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200"
                    >
                      Close
                    </button>
                  </div>
                  <DualXyPads />
                </div>
              )}
            </div>
          </div>

          {/* Docked Interactive Waveform Timeline Seek Bar & Compact Transport Bar */}
          {!isZenFullscreen && <TouchTimelineBar />}
        </section>

        {/* BOTTOM DOCK ON MOBILE / RIGHT DOCK ON DESKTOP: Real-Time Settings & Fine-Tune Inspector */}
        {isStudioMode && (
          <aside
            aria-label="Studio Inspector Dock"
            data-testid="studio-inspector-dock"
            className="flex-1 min-h-0 lg:h-full lg:col-span-5 xl:col-span-4 flex flex-col bg-zinc-950 border border-white/15 rounded-xl overflow-hidden shadow-2xl"
          >
            {/* Persistent Studio Header Bar: [Simple vs Advanced] + [AI Image -> 3D Fractal 1-Tap Tab] + [Lock 1 Mode / Auto-Switch] */}
            <div
              data-hud-interactive="true"
              data-testid="inspector-complexity-segmented-control"
              className="shrink-0 flex flex-wrap items-center justify-between gap-1.5 px-2 py-1.5 bg-zinc-900 border-b border-white/10"
            >
              <div
                role="tablist"
                aria-label="Control Complexity Mode"
                className="flex-1 min-w-[175px] grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-zinc-950 border border-white/15"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={
                    controlComplexityMode === 'simple' && !isDedicatedSubTabActiveInSimple
                  }
                  data-testid="complexity-toggle-simple"
                  onClick={() => {
                    setControlComplexityMode('simple');
                    if (activeInspectorTab === 'image' || activeInspectorTab === 'export') {
                      setActiveInspectorTab('modes');
                    }
                  }}
                  className={`min-h-[32px] px-2 py-1 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    controlComplexityMode === 'simple' && !isDedicatedSubTabActiveInSimple
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 shadow-sm'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Simple</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={controlComplexityMode === 'advanced'}
                  data-testid="complexity-toggle-advanced"
                  onClick={() => setControlComplexityMode('advanced')}
                  className={`min-h-[32px] px-2 py-1 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    controlComplexityMode === 'advanced'
                      ? 'bg-gradient-to-r from-cyan-400 to-cyan-500 text-zinc-950 shadow-sm'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 shrink-0" />
                  <span>Advanced</span>
                </button>
              </div>

              {/* Dedicated Top-Level 1-Tap [AI Image -> 3D Fractal] Button (Always Accessible in Simple & Advanced Modes) */}
              <button
                type="button"
                data-testid="dedicated-ai-image-3d-tab-btn"
                onClick={() => handleSelectTab('image')}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeInspectorTab === 'image'
                    ? 'bg-cyan-400 text-zinc-950 border-cyan-300 shadow-md'
                    : 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border-cyan-400/45'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                <span>AI Image → 3D Fractal</span>
              </button>

              {/* 1-Tap Master Mode Lock Pill */}
              <button
                type="button"
                data-testid="header-mode-lock-toggle-btn"
                onClick={() =>
                  setShaderParam('autoChoreographyEnabled', !autoChoreographyEnabled)
                }
                title="Toggle between Lock Single Mode (Whole Video) and Auto-Switch per Song Section"
                className={`min-h-[34px] px-2 py-1 rounded-lg border text-[11px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  !autoChoreographyEnabled
                    ? 'bg-amber-400/15 text-amber-300 border-amber-400/40'
                    : 'bg-emerald-400/15 text-emerald-300 border-emerald-400/40'
                }`}
              >
                {!autoChoreographyEnabled ? (
                  <>
                    <Lock className="w-3 h-3 shrink-0" />
                    <span className="hidden sm:inline">Lock 1 Mode</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3 h-3 shrink-0" />
                    <span className="hidden sm:inline">Auto-Switch</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick-Access Preset Ribbon Bar (Save & Load Presets in 1 Tap) */}
            <PresetRibbonBar />

            {/* 6 Touch-Friendly Sorted Inspector Tabs (Visible when 'Advanced' is active) */}
            {controlComplexityMode === 'advanced' && (
              <div
                data-hud-interactive="true"
                data-testid="advanced-inspector-tabs-bar"
                className="shrink-0 grid grid-cols-6 bg-zinc-900 border-b border-white/10"
              >
                {inspectorTabs.map((tab) => {
                  const isSelected = activeInspectorTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      data-testid={`inspector-tab-btn-${tab.id}`}
                      onClick={() => handleSelectTab(tab.id)}
                      title={tab.fullLabel}
                      className={`min-h-[40px] py-1.5 px-1 text-[10px] sm:text-xs font-semibold text-center border-b-2 transition-colors whitespace-nowrap truncate cursor-pointer ${
                        isSelected
                          ? 'border-amber-400 bg-zinc-950 text-amber-400 font-bold'
                          : 'border-transparent text-zinc-300 hover:text-white'
                      }`}
                    >
                      {tab.shortLabel}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Persistent Back / Home Bar whenever the user is inside a sub-tab or viewing AI Image -> 3D / Export in Simple mode */}
            {((controlComplexityMode === 'advanced' && activeInspectorTab !== 'modes') ||
              isDedicatedSubTabActiveInSimple) && (
              <div
                data-testid="settings-subtab-nav-bar"
                className="shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 bg-zinc-900/95 border-b border-amber-400/30"
              >
                <button
                  type="button"
                  data-testid="back-to-home-modes-btn"
                  onClick={() => handleSelectTab('modes')}
                  className="min-h-[32px] px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <span>
                    {isDedicatedSubTabActiveInSimple
                      ? '← Back to 9 Simple Macro Sliders'
                      : '← Back to Presets & Modes'}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live Preview Active
                  </span>
                  <button
                    type="button"
                    data-testid="subtab-reset-camera-btn"
                    onClick={resetCamera}
                    title={`Reset Camera & View for Mode #${fractalMode + 1}`}
                    className="min-h-[32px] px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-[11px] font-medium text-zinc-200 transition-colors cursor-pointer"
                  >
                    Reset View
                  </button>
                </div>
              </div>
            )}

            {/* Active Inspector Panel Content (Scrollable independently below the Pinned Top Video Preview) */}
            <div
              ref={inspectorScrollRef}
              data-testid="inspector-scroll-container"
              className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-3.5"
            >
              {controlComplexityMode === 'simple' && !isDedicatedSubTabActiveInSimple ? (
                <SimpleMacroControls />
              ) : (
                <>
                  <VideoExportDrawer />
                  <ShaderAndTextureDrawer />
                  {activeInspectorTab === 'xypads' && <DualXyPads />}
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
