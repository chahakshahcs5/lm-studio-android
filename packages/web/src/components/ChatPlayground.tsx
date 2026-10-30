import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Square,
  Trash2,
  Sliders,
  Check,
  Copy,
  Sparkles,
  Bot,
  User,
  Zap,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { marked } from 'marked';
import {
  ChatMessage,
  EngineStatus,
  GenerationMetrics,
  InferenceParams,
  SystemPromptPreset,
} from '@lm-studio-android/shared';

const PRESET_SYSTEM_PROMPTS: SystemPromptPreset[] = [
  {
    id: 'general',
    name: 'General Assistant',
    description: 'Polite, intelligent, and versatile edge AI helper',
    content: 'You are an expert AI assistant running locally on an Android device via LM Studio Android. Provide helpful, accurate, and concise answers.',
  },
  {
    id: 'developer',
    name: 'Senior Architect',
    description: 'Clean code, modern patterns, zero filler phrases',
    content: 'You are a Senior Software Architect. Output modular, production-ready code in TypeScript/Python/Rust. Never write boilerplate explanations unless asked.',
  },
  {
    id: 'terminal',
    name: 'Concise Terminal Copilot',
    description: 'Direct shell commands, CLI flags, no preamble',
    content: 'You are a Linux and Termux terminal copilot. Return strictly shell commands or minimal direct syntax. No conversational filler.',
  },
  {
    id: 'reasoner',
    name: 'Distilled Reasoner',
    description: 'Step-by-step logic and structured deduction',
    content: 'You are a logic and reasoning engine. Break complex problems into discrete logical steps before stating your final conclusion.',
  },
];

interface ChatPlaygroundProps {
  engineStatus: EngineStatus | null;
  onTpsUpdate?: (tps: number) => void;
}

export const ChatPlayground: React.FC<ChatPlaygroundProps> = ({ engineStatus, onTpsUpdate }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [showParams, setShowParams] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // System Prompt State
  const [selectedPreset, setSelectedPreset] = useState<string>('developer');
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string>(
    PRESET_SYSTEM_PROMPTS.find((p) => p.id === 'developer')?.content || ''
  );

  // Tuning Parameters
  const [params, setParams] = useState<InferenceParams>({
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    repeatPenalty: 1.1,
    maxTokens: 2048,
    stream: true,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (contentToSend?: string) => {
    const text = (contentToSend || input).trim();
    if (!text || isStreaming) return;

    if (!engineStatus?.loaded) {
      alert('Please load a model from the Models pane first.');
      return;
    }

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const assistantMsgId = `asst-${Date.now()}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages([...updatedMessages, initialAssistantMsg]);
    setInput('');
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    let tokenCount = 0;
    let accumulatedContent = '';

    try {
      const apiMessages = [
        ...(customSystemPrompt ? [{ role: 'system', content: customSystemPrompt }] : []),
        ...updatedMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const res = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: engineStatus.currentModel?.name || 'local-model',
          messages: apiMessages,
          temperature: params.temperature,
          top_p: params.topP,
          top_k: params.topK,
          repeat_penalty: params.repeatPenalty,
          max_tokens: params.maxTokens,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      if (!reader) throw new Error('Response stream unavailable');

      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          if (trimmed === 'data: [DONE]') break;

          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              if (firstTokenTime === null) {
                firstTokenTime = Date.now();
              }
              tokenCount++;
              accumulatedContent += delta;

              const elapsedSec = (Date.now() - (firstTokenTime || startTime)) / 1000;
              const liveTps = elapsedSec > 0 ? tokenCount / elapsedSec : 0;
              if (onTpsUpdate) onTpsUpdate(liveTps);

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: accumulatedContent } : m
                )
              );
            }
          } catch {
            // ignore partial json
          }
        }
      }

      // Finish metrics
      const totalDurationMs = Date.now() - startTime;
      const ttft = firstTokenTime ? firstTokenTime - startTime : null;
      const finalTps =
        totalDurationMs > 0 && tokenCount > 0
          ? (tokenCount / ((totalDurationMs - (ttft || 0)) / 1000))
          : 0;

      const metrics: GenerationMetrics = {
        tokensPerSecond: Math.round(finalTps * 10) / 10,
        timeToFirstTokenMs: ttft ?? 0,
        totalDurationMs,
        evalCount: tokenCount,
      };

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, metrics } : m))
      );
      if (onTpsUpdate) onTpsUpdate(0);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: `**Error**: ${err.message || 'Generation halted'}` }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
      if (onTpsUpdate) onTpsUpdate(0);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
    if (onTpsUpdate) onTpsUpdate(0);
  };

  const handleClear = () => {
    if (isStreaming) handleStop();
    setMessages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden relative">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-studio-bg overflow-hidden relative transition-colors">
        {/* Top Control Bar */}
        <div className="h-12 border-b border-studio-border px-5 flex items-center justify-between bg-studio-surface/80 backdrop-blur-sm z-10 flex-shrink-0">
          {/* Preset Selector */}
          <div className="flex items-center gap-2 text-xs">
            <BookOpen className="w-3.5 h-3.5 text-studio-textMuted" />
            <span className="text-studio-textMuted">Persona:</span>
            <select
              value={selectedPreset}
              onChange={(e) => {
                const p = PRESET_SYSTEM_PROMPTS.find((x) => x.id === e.target.value);
                if (p) {
                  setSelectedPreset(p.id);
                  setCustomSystemPrompt(p.content);
                }
              }}
              className="bg-studio-card border border-studio-border rounded px-2.5 py-1 text-studio-text text-xs font-medium focus:outline-none focus:border-accent"
            >
              {PRESET_SYSTEM_PROMPTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowParams(!showParams)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors border ${
                showParams
                  ? 'bg-studio-card text-accent border-accent/30'
                  : 'text-studio-textMuted hover:text-studio-text border-transparent hover:border-studio-border'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Inference Tuning</span>
            </button>

            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-studio-textMuted hover:text-crimson-accent hover:bg-crimson-muted border border-transparent transition-colors"
                title="Clear current conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Message View */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-accent text-white flex items-center justify-center mb-4 shadow-accent-glow">
                <Sparkles className="w-6 h-6 fill-white stroke-white" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-studio-text font-mono">
                LM Studio Android Edge Engine
              </h2>
              <p className="text-sm text-studio-textMuted mt-2 max-w-md">
                Inference offloaded to phone ARM cores and mobile GPU. Select a prompt below or start chatting.
              </p>

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8 w-full">
                {[
                  {
                    title: 'Quantum Computing in 2 Sentences',
                    prompt: 'Explain the core principles of quantum computing in exactly two concise sentences.',
                  },
                  {
                    title: 'TypeScript SSE Client',
                    prompt: 'Write a clean TypeScript function that connects to an OpenAI-compatible SSE streaming endpoint.',
                  },
                  {
                    title: 'ARM big.LITTLE Scheduling',
                    prompt: 'Why does pinning LLM inference threads to big cores outperform using all 8 cores on mobile ARM chips?',
                  },
                  {
                    title: 'Python Memory Profiler',
                    prompt: 'Write a lightweight Python context manager to measure peak RAM allocation of an execution block.',
                  },
                ].map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(s.prompt)}
                    className="p-3.5 rounded-xl bg-studio-card border border-studio-border hover:border-accent text-left transition-all duration-150 hover:-translate-y-0.5 group shadow-studio-subtle"
                  >
                    <span className="text-xs font-semibold text-studio-text block group-hover:text-accent flex items-center justify-between">
                      {s.title}
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                    <span className="text-[11px] text-studio-textMuted line-clamp-2 mt-1">
                      {s.prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-4xl mx-auto ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-accent-muted border border-accent/30 flex items-center justify-center text-accent flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`flex flex-col max-w-[85%] ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`p-4 rounded-xl text-sm leading-relaxed shadow-studio-subtle ${
                      msg.role === 'user'
                        ? 'bg-studio-card border border-studio-border border-l-2 border-l-accent text-studio-text'
                        : 'bg-studio-surface border border-studio-border text-studio-text w-full'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <>
                        <div
                          className="prose-studio"
                          dangerouslySetInnerHTML={{
                            __html: marked.parse(msg.content || '') as string,
                          }}
                        />
                        {isStreaming && msg.id === messages[messages.length - 1].id && (
                          <span className="streaming-cursor" />
                        )}
                      </>
                    )}
                  </div>

                  {/* Assistant Generation Metrics Footer */}
                  {msg.role === 'assistant' && msg.metrics && (
                    <div className="flex items-center gap-3 mt-1.5 px-2 text-[11px] font-mono text-studio-textMuted">
                      <span className="flex items-center gap-1 text-accent font-semibold">
                        <Zap className="w-3 h-3" />
                        {msg.metrics.tokensPerSecond} t/s
                      </span>
                      <span>•</span>
                      <span>{msg.metrics.evalCount} tokens</span>
                      {msg.metrics.timeToFirstTokenMs && (
                        <>
                          <span>•</span>
                          <span>TTFT: {msg.metrics.timeToFirstTokenMs}ms</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{((msg.metrics.totalDurationMs || 0) / 1000).toFixed(1)}s</span>

                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="ml-auto flex items-center gap-1 text-studio-textMuted hover:text-studio-text transition-colors"
                        title="Copy message text"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-accent" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-studio-card border border-studio-border flex items-center justify-center text-studio-textMuted flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-studio-surface border-t border-studio-border flex-shrink-0 transition-colors">
          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-xl bg-studio-card border border-studio-border focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition-all p-2 flex items-end gap-2 shadow-studio-subtle">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  engineStatus?.loaded
                    ? `Message ${engineStatus.currentModel?.name}... (Ctrl + Enter to send)`
                    : 'Mount a model in the Models tab to enable generation...'
                }
                disabled={!engineStatus?.loaded}
                rows={1}
                className="flex-1 bg-transparent border-0 outline-none resize-none text-sm text-studio-text placeholder:text-studio-textMuted px-2 py-1 max-h-32 min-h-[36px]"
              />

              {isStreaming ? (
                <button
                  onClick={handleStop}
                  className="p-2 rounded-lg bg-crimson-muted text-crimson-accent border border-crimson-accent/30 hover:bg-crimson-accent/20 transition-all flex items-center gap-1.5 text-xs font-semibold"
                >
                  <Square className="w-4 h-4 fill-crimson-accent" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || !engineStatus?.loaded}
                  className="p-2 rounded-lg bg-accent text-white hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-accent-glow"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-studio-textMuted font-mono">
              <span>Press Ctrl + Enter to send</span>
              <span>Offloaded to Smartphone Unified RAM</span>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-out Parameters Sidebar */}
      {showParams && (
        <aside className="w-72 bg-studio-surface border-l border-studio-border p-4 flex flex-col gap-4 overflow-y-auto select-none z-20 transition-colors">
          <div className="flex items-center justify-between pb-2 border-b border-studio-border">
            <span className="font-mono text-xs font-bold text-studio-text uppercase tracking-wider">
              Inference Parameters
            </span>
            <button
              onClick={() => setShowParams(false)}
              className="text-studio-textMuted hover:text-studio-text text-xs"
            >
              ✕
            </button>
          </div>

          {/* Temperature */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-studio-text">Temperature</span>
              <span className="font-mono text-accent">{params.temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={params.temperature}
              onChange={(e) => setParams({ ...params, temperature: parseFloat(e.target.value) })}
              className="w-full accent-accent h-1.5 bg-studio-card rounded cursor-pointer"
            />
            <span className="text-[10px] text-studio-textMuted block">
              Controls randomness. Lower is more deterministic.
            </span>
          </div>

          {/* Top-P */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-studio-text">Top-P Sampling</span>
              <span className="font-mono text-accent">{params.topP}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={params.topP}
              onChange={(e) => setParams({ ...params, topP: parseFloat(e.target.value) })}
              className="w-full accent-accent h-1.5 bg-studio-card rounded cursor-pointer"
            />
          </div>

          {/* Top-K */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-studio-text">Top-K</span>
              <span className="font-mono text-accent">{params.topK}</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={params.topK}
              onChange={(e) => setParams({ ...params, topK: parseInt(e.target.value, 10) })}
              className="w-full accent-accent h-1.5 bg-studio-card rounded cursor-pointer"
            />
          </div>

          {/* Repeat Penalty */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-studio-text">Repeat Penalty</span>
              <span className="font-mono text-accent">{params.repeatPenalty}</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="1.5"
              step="0.05"
              value={params.repeatPenalty}
              onChange={(e) =>
                setParams({ ...params, repeatPenalty: parseFloat(e.target.value) })
              }
              className="w-full accent-accent h-1.5 bg-studio-card rounded cursor-pointer"
            />
          </div>

          {/* Context Tokens */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-studio-text">Max Output Tokens</span>
              <span className="font-mono text-accent">{params.maxTokens}</span>
            </div>
            <input
              type="range"
              min="256"
              max="4096"
              step="128"
              value={params.maxTokens}
              onChange={(e) => setParams({ ...params, maxTokens: parseInt(e.target.value, 10) })}
              className="w-full accent-accent h-1.5 bg-studio-card rounded cursor-pointer"
            />
          </div>
        </aside>
      )}
    </div>
  );
};
