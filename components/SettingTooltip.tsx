'use client';

import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import { SETTING_TOOLTIPS } from '@/lib/presets';

interface SettingTooltipProps {
  settingKey?: string;
  text?: string;
  description?: string;
  label?: string;
  align?: 'left' | 'center' | 'right';
}

export default function SettingTooltip({
  settingKey,
  text,
  description: descriptionProp,
  label,
  align = 'left',
}: SettingTooltipProps) {
  const description = descriptionProp || text || (settingKey ? SETTING_TOOLTIPS[settingKey] : '');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  if (!description) return null;

  const alignClass =
    align === 'right'
      ? 'right-0'
      : align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : 'left-0';

  return (
    <span
      ref={containerRef}
      className="relative inline-flex items-center align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        data-testid={settingKey ? `tooltip-trigger-${settingKey}` : 'tooltip-trigger'}
        aria-label={label ? `Info about ${label}` : 'Parameter description'}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full transition-colors cursor-help ${
          open
            ? 'text-cyan-300 bg-cyan-500/25 border border-cyan-400/50'
            : 'text-slate-400 hover:text-cyan-300 bg-white/[0.04] hover:bg-cyan-500/15 border border-white/10'
        }`}
      >
        <HelpCircle className="w-2.5 h-2.5" />
      </button>

      {open && (
        <span
          role="tooltip"
          data-testid="active-setting-tooltip"
          className={`
            pointer-events-none absolute bottom-full mb-1.5 z-50
            w-56 sm:w-64 p-2 rounded-lg
            bg-[#0A0E18]/95 backdrop-blur-xl border border-cyan-400/35
            shadow-[0_10px_28px_rgba(0,0,0,0.85)]
            text-[10px] leading-relaxed font-normal text-slate-200 normal-case tracking-normal
            ${alignClass}
          `}
        >
          {label && (
            <span className="block font-semibold text-cyan-300 mb-0.5 text-[10px]">
              {label}
            </span>
          )}
          <span className="block text-slate-200/95">{description}</span>
        </span>
      )}
    </span>
  );
}
