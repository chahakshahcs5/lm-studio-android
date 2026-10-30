import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  PanelLeft,
  PanelLeftClose,
  Download,
  FileText,
  FileCode,
  RotateCcw,
  Pencil,
  X,
  Plus,
  Settings2,
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  ChatMessage,
  EngineStatus,
  GenerationMetrics,
  InferenceParams,
  ConversationSummary,
  Conversation,
  CustomPersona,
  InferencePreset,
} from '@lm-studio-android/shared';
import { CustomSelect } from './ui/CustomSelect';
import { copyToClipboard } from '../utils/clipboard';
import { ChatHistorySidebar } from './ChatHistorySidebar';
import { PersonaModal } from './PersonaModal';

const DEFAULT_PERSONAS: CustomPersona[] = [
  {
    id: 'general',
    name: 'General Assistant',
    description: 'Polite, intelligent, and versatile edge AI helper',
    content:
      'You are an expert AI assistant running locally on an Android device via LM Studio Android. Provide helpful, accurate, and concise answers.',
    isBuiltin: true,
  },
  {
    id: 'developer',
    name: 'Senior Architect',
    description: 'Clean code, modern patterns, zero filler phrases',
    content:
      'You are a Senior Software Architect. Output modular, production-ready code in TypeScript/Python/Rust. Never write boilerplate explanations unless asked.',
    isBuiltin: true,
  },
  {
    id: 'terminal',
    name: 'Concise Terminal Copilot',
    description: 'Direct shell commands, CLI flags, no preamble',
    content:
      'You are a Linux and Termux terminal copilot. Return strictly shell commands or minimal direct syntax. No conversational filler.',
    isBuiltin: true,
  },
  {
    id: 'reasoner',
    name: 'Distilled Reasoner',
    description: 'Step-by-step logic and structured deduction',
    content:
      'You are a logic and reasoning engine. Break complex problems into discrete logical steps before stating your final conclusion.',
    isBuiltin: true,
  },
];

interface ChatPlaygroundProps {
  engineStatus: EngineStatus | null;
  onTpsUpdate?: (liveTps: number, lastTps?: number) => void;
  onNavigateToModels?: () => void;
  onError?: (data: any) => void;
}

export const ChatPlayground: React.FC<ChatPlaygroundProps> = ({
  engineStatus,
  onTpsUpdate,
  onNavigateToModels,
  onError,
}) => {
  // Sidebar & Modal states
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState<boolean>(false);

  // Conversations State (Local File DB)
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>('New Conversation');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleInput, setTitleInput] = useState<string>('');

  // Messages State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [showParams, setShowParams] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Message Editing / Regeneration
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editMsgContent, setEditMsgContent] = useState<string>('');

  // Personas
  const [personas, setPersonas] = useState<CustomPersona[]>(DEFAULT_PERSONAS);
  const [selectedPreset, setSelectedPreset] = useState<string>('developer');
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string>(
    DEFAULT_PERSONAS.find((p) => p.id === 'developer')?.content || ''
  );

  // Tuning Parameters & Presets
  const [inferencePresets, setInferencePresets] = useState<InferencePreset[]>([]);
  const [selectedInferencePresetId, setSelectedInferencePresetId] = useState<string>('balanced');
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
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  // ============================================================================
  // Local File DB - Fetching & Synchronization
  // ============================================================================

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setConversations(data.data);
        return data.data as ConversationSummary[];
      }
    } catch (err) {
      console.warn('Could not load conversations from server:', err);
    }
    return [];
  }, []);

  const fetchPersonas = useCallback(async () => {
    try {
      const res = await fetch('/api/personas');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPersonas(data.data);
      }
    } catch {
      // keep defaults
    }
  }, []);

  const fetchPresets = useCallback(async () => {
    try {
      const res = await fetch('/api/presets/params');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setInferencePresets(data.data);
      }
    } catch {
      // ignore
    }
  }, []);

  // Initial data load on mount
  useEffect(() => {
    fetchConversations().then((list) => {
      if (list && list.length > 0) {
        // Load the most recently active conversation
        loadConversation(list[0].id);
      }
    });
    fetchPersonas();
    fetchPresets();
  }, [fetchConversations, fetchPersonas, fetchPresets]);

  const loadConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        const conv: Conversation = data.data;
        setActiveId(conv.id);
        setActiveTitle(conv.title || 'Untitled Chat');
        setMessages(conv.messages || []);
        if (conv.params) setParams(conv.params);
        if (conv.systemPrompt) setCustomSystemPrompt(conv.systemPrompt);
        if (conv.systemPromptId) setSelectedPreset(conv.systemPromptId);
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  const handleNewConversation = () => {
    if (isStreaming) handleStop();
    setActiveId(null);
    setActiveTitle('New Conversation');
    setMessages([]);
    setInput('');
  };

  const handleSelectConversation = (id: string) => {
    if (id === activeId) return;
    if (isStreaming) handleStop();
    loadConversation(id);
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      const data = await res.json();
      if (data.success) {
        if (activeId === id) setActiveTitle(newTitle);
        fetchConversations();
      }
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    }
  };

  const handleTogglePin = async (id: string, isPinned: boolean) => {
    try {
      await fetch(`/api/conversations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned }),
      });
      fetchConversations();
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      const updatedList = await fetchConversations();
      if (activeId === id) {
        if (updatedList.length > 0) {
          loadConversation(updatedList[0].id);
        } else {
          handleNewConversation();
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleClearAllConversations = async () => {
    try {
      await fetch('/api/conversations', { method: 'DELETE' });
      setConversations([]);
      handleNewConversation();
    } catch (err) {
      console.error('Failed to clear conversations:', err);
    }
  };

  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportConversation = (id: string, format: 'md' | 'json') => {
    const url = `/api/conversations/${id}/export?format=${format}`;
    const conv = conversations.find((c) => c.id === id);
    const safeTitle = (conv?.title || 'conversation')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 30);
    downloadFile(url, `${safeTitle}.${format}`);
  };

  const handleExportAll = () => {
    const url = '/api/conversations/export/all';
    downloadFile(url, `lm-studio-conversations-backup-${Date.now()}.json`);
  };

  const handleImportBackup = async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch('/api/conversations/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (data.success) {
        const list = await fetchConversations();
        if (list.length > 0) {
          loadConversation(list[0].id);
        }
      }
    } catch (err: any) {
      alert(`Import failed: ${err.message || 'Invalid JSON format'}`);
    }
  };

  // ============================================================================
  // Message Sending, Streaming & Real-time Persistence
  // ============================================================================

  const handleCopy = async (text: string, id: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSend = async (contentToSend?: string) => {
    const text = (contentToSend || input).trim();
    if (!text || isStreaming) return;

    if (!engineStatus?.loaded) {
      if (onError) {
        onError({
          title: 'No Active Model Loaded',
          message:
            'Inference cannot start because no GGUF model is mounted in device memory.',
          tips: [
            'Click on the Models tab in the header to view downloaded models.',
            'Click "Mount" on your preferred model to configure threads and start the engine.',
          ],
          onRetry: onNavigateToModels,
        });
      }
      return;
    }

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const assistantMsgId = `asst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

    // Ensure conversation exists in local file DB
    let currentConvId = activeId;
    if (!currentConvId) {
      try {
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedMessages,
            systemPrompt: customSystemPrompt,
            systemPromptId: selectedPreset,
            modelId: engineStatus.currentModel?.name,
            params,
          }),
        });
        const data = await res.json();
        if (data.success && data.data) {
          currentConvId = data.data.id;
          setActiveId(data.data.id);
          setActiveTitle(data.data.title);
          fetchConversations();
        }
      } catch (err) {
        console.error('Failed to create conversation on send:', err);
      }
    } else {
      // Sync user message to server immediately
      fetch(`/api/conversations/${currentConvId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          systemPrompt: customSystemPrompt,
          modelId: engineStatus.currentModel?.name,
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.data?.title) {
            setActiveTitle(d.data.title);
            fetchConversations();
          }
        })
        .catch(() => {});
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    let tokenCount = 0;
    let accumulatedContent = '';
    let lastUiFlush = Date.now();

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
      let streamDone = false;

      while (!streamDone) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          if (trimmed === 'data: [DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              if (firstTokenTime === null) {
                firstTokenTime = Date.now();
              }
              tokenCount++;
              accumulatedContent += delta;

              const now = Date.now();
              if (now - lastUiFlush >= 50) {
                lastUiFlush = now;
                const elapsedSec = (now - (firstTokenTime || startTime)) / 1000;
                const liveTps = elapsedSec > 0 ? tokenCount / elapsedSec : 0;
                if (onTpsUpdate) onTpsUpdate(liveTps);

                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: accumulatedContent } : m
                  )
                );
              }
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
          ? tokenCount / ((totalDurationMs - (ttft || 0)) / 1000)
          : 0;

      const metrics: GenerationMetrics = {
        tokensPerSecond: Math.round(finalTps * 10) / 10,
        timeToFirstTokenMs: ttft ?? 0,
        totalDurationMs,
        evalCount: tokenCount,
      };

      const finalAssistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: accumulatedContent,
        timestamp: Date.now(),
        metrics,
      };

      const finalAllMessages = [...updatedMessages, finalAssistantMsg];
      setMessages(finalAllMessages);

      // Persist full message array to Local File DB
      if (currentConvId) {
        fetch(`/api/conversations/${currentConvId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: finalAllMessages,
            systemPrompt: customSystemPrompt,
            modelId: engineStatus.currentModel?.name,
            params,
          }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.success && d.data?.title) {
              setActiveTitle(d.data.title);
            }
            fetchConversations();
          })
          .catch(() => {});
      }

      if (finalTps > 0) {
        fetch('/api/metrics/tps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tps: finalTps }),
        }).catch(() => {});
      }

      if (onTpsUpdate) onTpsUpdate(0, finalTps);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const errorMsg: ChatMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: `**Error**: ${err.message || 'Generation halted'}`,
          timestamp: Date.now(),
        };
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? errorMsg : m))
        );

        if (currentConvId) {
          fetch(`/api/conversations/${currentConvId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [...updatedMessages, errorMsg],
            }),
          }).catch(() => {});
        }
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
    if (activeId) {
      fetch(`/api/conversations/${activeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      }).then(() => fetchConversations());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Message regeneration & edit
  const startEditMessage = (msg: ChatMessage) => {
    setEditingMsgId(msg.id);
    setEditMsgContent(msg.content);
  };

  const cancelEditMessage = () => {
    setEditingMsgId(null);
    setEditMsgContent('');
  };

  const saveAndRegenerate = (msgId: string) => {
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx < 0) return;

    // Truncate messages to before this message
    const previousMessages = messages.slice(0, idx);
    setMessages(previousMessages);
    setEditingMsgId(null);
    handleSend(editMsgContent);
  };

  const deleteMessage = (msgId: string) => {
    const updated = messages.filter((m) => m.id !== msgId);
    setMessages(updated);
    if (activeId) {
      fetch(`/api/conversations/${activeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      }).then(() => fetchConversations());
    }
  };

  const saveInlineTitle = () => {
    if (activeId && titleInput.trim()) {
      handleRenameConversation(activeId, titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="flex-1 flex overflow-hidden relative">
      {/* Collapsible Chat History Sidebar */}
      <ChatHistorySidebar
        conversations={conversations}
        activeId={activeId}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(false)}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onClearAllConversations={handleClearAllConversations}
        onRenameConversation={handleRenameConversation}
        onTogglePin={handleTogglePin}
        onExportConversation={handleExportConversation}
        onExportAll={handleExportAll}
        onImportBackup={handleImportBackup}
      />

      {/* Main Chat Workspace Area */}
      <div className="flex-1 flex flex-col h-full min-h-0 bg-studio-bg overflow-hidden relative transition-colors">
        {/* Top Control Bar */}
        <div className="min-h-12 border-b border-studio-border px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2.5 bg-studio-surface/80 backdrop-blur-sm z-10 flex-shrink-0">
          {/* Left: Sidebar toggle & Title */}
          <div className="flex items-center gap-2">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 rounded-lg border border-studio-border hover:bg-studio-card text-studio-textMuted hover:text-studio-text transition-colors"
                title="Open Chat History Sidebar"
              >
                <PanelLeft className="w-4 h-4 text-accent" />
              </button>
            )}

            {isEditingTitle ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveInlineTitle();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                  autoFocus
                  className="px-2 py-0.5 rounded bg-studio-card border border-accent text-xs text-studio-text outline-none font-medium"
                />
                <button
                  onClick={saveInlineTitle}
                  className="p-1 text-accent hover:opacity-80"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="p-1 text-studio-textMuted hover:text-studio-text"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group">
                <span className="text-xs sm:text-sm font-semibold text-studio-text max-w-[200px] sm:max-w-xs truncate">
                  {activeTitle}
                </span>
                {activeId && (
                  <button
                    onClick={() => {
                      setTitleInput(activeTitle);
                      setIsEditingTitle(true);
                    }}
                    className="p-1 rounded text-studio-textMuted hover:text-studio-text opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Rename chat"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Center/Right: Persona Selector & Quick Actions */}
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {/* Persona Selector with Custom Manager trigger */}
            <div className="flex items-center gap-1.5">
              <span className="text-studio-textMuted font-medium flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-accent" />
                <span className="hidden sm:inline">Persona:</span>
              </span>
              <CustomSelect
                value={selectedPreset}
                onChange={(val) => {
                  const p = personas.find((x) => x.id === val);
                  if (p) {
                    setSelectedPreset(p.id);
                    setCustomSystemPrompt(p.content);
                  }
                }}
                options={personas.map((p) => ({
                  value: p.id,
                  label: p.name,
                  description: p.description,
                }))}
                size="sm"
              />
              <button
                onClick={() => setIsPersonaModalOpen(true)}
                className="p-1.5 rounded-lg border border-studio-border hover:bg-studio-card text-studio-textMuted hover:text-accent transition-colors"
                title="Manage Custom System Personas"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Inference Tuning */}
            <button
              onClick={() => setShowParams(!showParams)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors border ${
                showParams
                  ? 'bg-studio-card text-accent border-accent/30'
                  : 'text-studio-textMuted hover:text-studio-text border-transparent hover:border-studio-border'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Inference Tuning</span>
            </button>

            {/* Export Current Chat */}
            {activeId && messages.length > 0 && (
              <button
                onClick={() => handleExportConversation(activeId, 'md')}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-studio-textMuted hover:text-accent border border-transparent hover:border-studio-border transition-colors"
                title="Export Conversation to Markdown"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}

            {/* Clear */}
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-studio-textMuted hover:text-crimson-accent hover:bg-crimson-muted border border-transparent transition-colors"
                title="Clear messages in current chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Message / Welcome View */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-4">
          {messages.length === 0 ? (
            <div className="min-h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center py-2">
              <div className="w-12 h-12 rounded-2xl bg-accent text-white flex items-center justify-center mb-3 shadow-accent-glow flex-shrink-0">
                <Sparkles className="w-6 h-6 fill-white stroke-white" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-studio-text font-mono">
                LM Studio Android Edge Engine
              </h2>
              <p className="text-xs sm:text-sm text-studio-textMuted mt-1.5 max-w-md">
                Inference offloaded to phone ARM cores and mobile GPU. Chats are automatically saved to your local device file DB.
              </p>

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-5 w-full">
                {[
                  {
                    title: 'Quantum Computing in 2 Sentences',
                    prompt:
                      'Explain the core principles of quantum computing in exactly two concise sentences.',
                  },
                  {
                    title: 'TypeScript SSE Client',
                    prompt:
                      'Write a clean TypeScript function that connects to an OpenAI-compatible SSE streaming endpoint.',
                  },
                  {
                    title: 'ARM big.LITTLE Scheduling',
                    prompt:
                      'Why does pinning LLM inference threads to big cores outperform using all 8 cores on mobile ARM chips?',
                  },
                  {
                    title: 'Python Memory Profiler',
                    prompt:
                      'Write a lightweight Python context manager to measure peak RAM allocation of an execution block.',
                  },
                ].map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(s.prompt)}
                    className="p-3 rounded-xl bg-studio-card border border-studio-border hover:border-accent text-left transition-all duration-150 hover:-translate-y-0.5 group shadow-studio-subtle"
                  >
                    <span className="text-xs font-semibold text-studio-text block group-hover:text-accent flex items-center justify-between">
                      {s.title}
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                    <span className="text-[11px] text-studio-textMuted line-clamp-2 mt-0.5">
                      {s.prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-4xl mx-auto group ${
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
                    {editingMsgId === msg.id ? (
                      /* Inline Message Editor */
                      <div className="w-full bg-studio-card border border-accent rounded-xl p-3 flex flex-col gap-2">
                        <textarea
                          value={editMsgContent}
                          onChange={(e) => setEditMsgContent(e.target.value)}
                          rows={3}
                          className="w-full bg-studio-bg border border-studio-border rounded-lg p-2 text-xs text-studio-text outline-none focus:border-accent resize-none"
                        />
                        <div className="flex justify-end gap-2 text-xs">
                          <button
                            onClick={cancelEditMessage}
                            className="px-2.5 py-1 rounded text-studio-textMuted hover:text-studio-text"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveAndRegenerate(msg.id)}
                            className="px-3 py-1 rounded bg-accent text-white font-medium hover:opacity-90 flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Save & Regenerate</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Regular Message Bubble */
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
                                __html: DOMPurify.sanitize(
                                  marked.parse(msg.content || '', { async: false }) as string
                                ),
                              }}
                            />
                            {isStreaming && msg.id === messages[messages.length - 1].id && (
                              <span className="streaming-cursor" />
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Message Action Footer */}
                    <div className="flex items-center gap-2 mt-1.5 px-2 text-[11px] font-mono text-studio-textMuted">
                      {msg.role === 'assistant' && msg.metrics && (
                        <>
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
                        </>
                      )}

                      {/* User message edit button */}
                      {msg.role === 'user' && !isStreaming && (
                        <button
                          onClick={() => startEditMessage(msg)}
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-studio-textMuted hover:text-accent transition-opacity mr-1"
                          title="Edit message & branch"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      )}

                      {/* Delete message button */}
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-studio-textMuted hover:text-crimson-accent transition-opacity mr-1"
                        title="Delete message"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>

                      {/* Copy message button */}
                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="flex items-center gap-1 text-studio-textMuted hover:text-studio-text transition-colors ml-auto"
                        title="Copy message text"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-accent" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-studio-card border border-studio-border flex items-center justify-center text-studio-textMuted flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
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
              <span>Press Enter to send (Shift + Enter for new line)</span>
              <span>Saved locally to device storage</span>
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

          {/* Quick Presets */}
          {inferencePresets.length > 0 && (
            <div className="space-y-1.5 pb-2 border-b border-studio-border">
              <span className="text-xs font-semibold text-studio-text">Tuning Profile</span>
              <CustomSelect
                value={selectedInferencePresetId}
                onChange={(val) => {
                  setSelectedInferencePresetId(val);
                  const p = inferencePresets.find((x) => x.id === val);
                  if (p) setParams(p.params);
                }}
                options={inferencePresets.map((p) => ({
                  value: p.id,
                  label: p.name,
                  description: p.description,
                }))}
                size="sm"
              />
            </div>
          )}

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

      {/* Persona Management Modal */}
      <PersonaModal
        isOpen={isPersonaModalOpen}
        onClose={() => setIsPersonaModalOpen(false)}
        personas={personas}
        selectedPersonaId={selectedPreset}
        onSelectPersona={(p) => {
          setSelectedPreset(p.id);
          setCustomSystemPrompt(p.content);
        }}
        onSavePersona={async (personaData) => {
          const res = await fetch('/api/personas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(personaData),
          });
          const data = await res.json();
          if (data.success && data.data) {
            await fetchPersonas();
            setSelectedPreset(data.data.id);
            setCustomSystemPrompt(data.data.content);
          }
        }}
        onDeletePersona={async (id) => {
          await fetch(`/api/personas/${id}`, { method: 'DELETE' });
          await fetchPersonas();
          if (selectedPreset === id) {
            setSelectedPreset('developer');
            setCustomSystemPrompt(DEFAULT_PERSONAS[1].content);
          }
        }}
      />
    </div>
  );
};
