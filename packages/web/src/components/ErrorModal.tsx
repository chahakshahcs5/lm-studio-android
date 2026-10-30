import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  X,
  Copy,
  Check,
  Terminal,
  HelpCircle,
  RotateCcw,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface ErrorModalData {
  isOpen: boolean;
  title: string;
  message: string;
  details?: string;
  tips?: string[];
  onRetry?: () => void;
  onOpenConfig?: () => void;
}

interface ErrorModalProps {
  data: ErrorModalData | null;
  onClose: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ data, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [showFullLogs, setShowFullLogs] = useState(false);

  if (!data || !data.isOpen) return null;

  const { title, message, details, tips, onRetry, onOpenConfig } = data;

  const rawLogs = details || message || '';

  // Heuristic diagnostic categorization
  const isFlashAttn =
    rawLogs.toLowerCase().includes('flash-attn') ||
    rawLogs.toLowerCase().includes('-fa');
  const isOOM =
    rawLogs.toLowerCase().includes('out of memory') ||
    rawLogs.toLowerCase().includes('bad_alloc') ||
    rawLogs.toLowerCase().includes('failed to allocate') ||
    rawLogs.toLowerCase().includes('oom');
  const isBinaryMissing =
    rawLogs.toLowerCase().includes('not found') ||
    rawLogs.toLowerCase().includes('enoent') ||
    rawLogs.toLowerCase().includes('binary');

  const defaultTips: string[] = [];
  if (isFlashAttn) {
    defaultTips.push(
      'Flash-Attention syntax varies across llama.cpp builds. The server now auto-detects [on|off], but you can also uncheck Flash-Attention in the acceleration settings.'
    );
  }
  if (isOOM) {
    defaultTips.push(
      'Phone RAM limit exceeded. Lower the Context Window to 1024 or 2048 tokens to conserve memory.'
    );
    defaultTips.push(
      'Choose a smaller model quantization (e.g. Q4_K_M or 1.5B/3B parameters) or enable KV Cache Quantization (q4_0).'
    );
  }
  if (isBinaryMissing) {
    defaultTips.push(
      'Ensure llama-server is installed via Termux: pkg install -y tur-repo && pkg install -y llama-cpp'
    );
  }
  if (defaultTips.length === 0 && (!tips || tips.length === 0)) {
    defaultTips.push(
      'Review acceleration parameters (Threads, Context Window, and KV Quantization).'
    );
    defaultTips.push(
      'Check Termux terminal logs or inspect ~/llama_server.log for low-level crash traces.'
    );
  }

  const activeTips = tips && tips.length > 0 ? tips : defaultTips;

  const handleCopy = () => {
    const textToCopy = `=== LM STUDIO ANDROID DIAGNOSTIC REPORT ===\nTitle: ${title}\nMessage: ${message}\n\n=== LOG OUTPUT ===\n${rawLogs}\n===========================================`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-studio-surface border border-crimson-accent/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 text-studio-text relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-crimson-accent/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-studio-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-crimson-accent/15 border border-crimson-accent/30 flex items-center justify-center text-crimson-accent flex-shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-crimson-accent/10 border border-crimson-accent/30 text-crimson-accent">
                  Engine Diagnostic
                </span>
              </div>
              <h3 className="font-mono text-sm font-bold text-studio-text mt-0.5">
                {title}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-studio-textMuted hover:text-studio-text hover:bg-studio-card transition-colors"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* High-level Message */}
        <div className="p-3 rounded-xl bg-crimson-accent/10 border border-crimson-accent/20 text-xs text-studio-text leading-relaxed">
          <p className="font-medium">{message}</p>
        </div>

        {/* Terminal Diagnostics Output */}
        {rawLogs && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-studio-textMuted">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-accent" />
                <span>llama_server.log snippet</span>
              </span>
              <button
                onClick={() => setShowFullLogs(!showFullLogs)}
                className="flex items-center gap-1 text-[10px] hover:text-studio-text transition-colors"
              >
                <span>{showFullLogs ? 'Collapse' : 'Expand'}</span>
                {showFullLogs ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            </div>

            <div
              className={`p-3 rounded-xl bg-black/80 border border-studio-border font-mono text-[11px] text-red-300/90 whitespace-pre-wrap break-all overflow-y-auto ${
                showFullLogs ? 'max-h-56' : 'max-h-28'
              }`}
            >
              {rawLogs}
            </div>
          </div>
        )}

        {/* Smart Remediation Tips */}
        {activeTips.length > 0 && (
          <div className="p-3 rounded-xl bg-studio-card border border-studio-border text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-accent text-[11px] font-mono">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Recommended Fixes</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-studio-textMuted text-[11px] leading-relaxed">
              {activeTips.map((tip, idx) => (
                <li key={idx} className="marker:text-accent">
                  <span className="text-studio-text font-normal">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-2 flex items-center justify-between gap-2 border-t border-studio-borderSubtle">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-studio-card border border-studio-border text-studio-text hover:text-accent hover:border-accent transition-all active:scale-95"
            title="Copy diagnostic output to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-accent" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-studio-textMuted" />
                <span>Copy Log</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            {onOpenConfig && (
              <button
                onClick={() => {
                  onClose();
                  onOpenConfig();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-studio-surface border border-studio-border text-studio-text hover:text-accent hover:border-accent transition-all active:scale-95"
              >
                <Sliders className="w-3.5 h-3.5 text-accent" />
                <span>Reconfigure</span>
              </button>
            )}

            {onRetry && (
              <button
                onClick={() => {
                  onClose();
                  onRetry();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:brightness-110 shadow-accent-glow transition-all active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-studio-card border border-studio-border text-studio-text hover:bg-studio-border/30 transition-all active:scale-95"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
