import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  Conversation,
  ConversationSummary,
  CreateConversationDTO,
  UpdateConversationDTO,
  ChatMessage,
  CustomPersona,
  InferencePreset,
} from '@lm-studio-android/shared';

export class FileDatabase {
  private baseDir: string;
  private conversationsDir: string;
  private indexPath: string;
  private personasPath: string;
  private presetsPath: string;

  private indexCache: ConversationSummary[] = [];
  private isInitialized = false;

  constructor() {
    this.baseDir = process.env.DATA_DIR || path.join(os.homedir(), '.lm-studio-android', 'data');
    this.conversationsDir = path.join(this.baseDir, 'conversations');
    this.indexPath = path.join(this.conversationsDir, 'index.json');
    this.personasPath = path.join(this.baseDir, 'personas.json');
    this.presetsPath = path.join(this.baseDir, 'presets.json');
    this.init();
  }

  public getBaseDir(): string {
    return this.baseDir;
  }

  private init() {
    try {
      if (!fs.existsSync(this.conversationsDir)) {
        fs.mkdirSync(this.conversationsDir, { recursive: true });
      }

      // Initialize or rebuild index
      if (!fs.existsSync(this.indexPath)) {
        this.rebuildIndex();
      } else {
        this.loadIndex();
      }

      // Initialize custom personas if not present
      if (!fs.existsSync(this.personasPath)) {
        this.initDefaultPersonas();
      }

      // Initialize inference presets if not present
      if (!fs.existsSync(this.presetsPath)) {
        this.initDefaultPresets();
      }

      this.isInitialized = true;
    } catch (err) {
      console.error('[FileDB] Initialization error:', err);
    }
  }

  private atomicWriteJson(filePath: string, data: any) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');

    try {
      fs.renameSync(tempPath, filePath);
    } catch {
      // Windows file lock recovery: unlink first if exists, then rename
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        fs.renameSync(tempPath, filePath);
      } catch (err) {
        // Fallback: direct write
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch {}
      }
    }
  }

  private loadIndex() {
    try {
      const content = fs.readFileSync(this.indexPath, 'utf8');
      this.indexCache = JSON.parse(content);
      if (!Array.isArray(this.indexCache)) {
        this.indexCache = [];
        this.rebuildIndex();
      }
    } catch {
      this.rebuildIndex();
    }
  }

  private saveIndex() {
    this.atomicWriteJson(this.indexPath, this.indexCache);
  }

  public rebuildIndex(): ConversationSummary[] {
    const summaries: ConversationSummary[] = [];
    if (!fs.existsSync(this.conversationsDir)) {
      this.indexCache = [];
      return [];
    }

    const files = fs.readdirSync(this.conversationsDir);
    for (const file of files) {
      if (file === 'index.json' || !file.endsWith('.json')) continue;
      const filePath = path.join(this.conversationsDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const conv: Conversation = JSON.parse(content);
        if (conv && conv.id) {
          const firstUserMsg = conv.messages.find((m) => m.role === 'user');
          const preview = firstUserMsg ? firstUserMsg.content.slice(0, 100) : '';
          summaries.push({
            id: conv.id,
            title: conv.title || 'Untitled Chat',
            createdAt: conv.createdAt || Date.now(),
            updatedAt: conv.updatedAt || Date.now(),
            messageCount: conv.messages ? conv.messages.length : 0,
            preview,
            modelId: conv.modelId,
            isPinned: !!conv.isPinned,
          });
        }
      } catch {
        // Ignore unparseable files
      }
    }

    this.indexCache = this.sortSummaries(summaries);
    this.saveIndex();
    return this.indexCache;
  }

  private sortSummaries(list: ConversationSummary[]): ConversationSummary[] {
    return list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }

  private generateTitleFromPrompt(prompt: string): string {
    const cleaned = prompt
      .replace(/[#*`_>\n\r]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return 'New Chat';
    return cleaned.length > 38 ? `${cleaned.slice(0, 38).trim()}...` : cleaned;
  }

  // ============================================================================
  // Conversations API
  // ============================================================================

  public listConversations(query?: string): ConversationSummary[] {
    if (!query || !query.trim()) {
      return this.indexCache;
    }
    const q = query.toLowerCase().trim();
    return this.indexCache.filter((item) =>
      item.title.toLowerCase().includes(q) ||
      (item.preview && item.preview.toLowerCase().includes(q))
    );
  }

  public getConversation(id: string): Conversation | null {
    const filePath = path.join(this.conversationsDir, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content) as Conversation;
    } catch {
      return null;
    }
  }

  public createConversation(dto: CreateConversationDTO = {}): Conversation {
    const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();

    let title = dto.title?.trim();
    if (!title) {
      const firstUserMsg = dto.messages?.find((m) => m.role === 'user');
      title = firstUserMsg ? this.generateTitleFromPrompt(firstUserMsg.content) : 'New Chat';
    }

    const conversation: Conversation = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      systemPrompt: dto.systemPrompt,
      systemPromptId: dto.systemPromptId,
      messages: dto.messages || [],
      modelId: dto.modelId,
      params: dto.params,
      isPinned: !!dto.isPinned,
    };

    const filePath = path.join(this.conversationsDir, `${id}.json`);
    this.atomicWriteJson(filePath, conversation);

    const firstUserMsg = conversation.messages.find((m) => m.role === 'user');
    const preview = firstUserMsg ? firstUserMsg.content.slice(0, 100) : '';

    const summary: ConversationSummary = {
      id,
      title: conversation.title,
      createdAt: now,
      updatedAt: now,
      messageCount: conversation.messages.length,
      preview,
      modelId: conversation.modelId,
      isPinned: conversation.isPinned,
    };

    this.indexCache = this.sortSummaries([summary, ...this.indexCache]);
    this.saveIndex();

    return conversation;
  }

  public updateConversation(id: string, updates: UpdateConversationDTO): Conversation | null {
    const existing = this.getConversation(id);
    if (!existing) return null;

    const now = Date.now();

    if (updates.title !== undefined) existing.title = updates.title.trim() || 'Untitled Chat';
    if (updates.systemPrompt !== undefined) existing.systemPrompt = updates.systemPrompt;
    if (updates.systemPromptId !== undefined) existing.systemPromptId = updates.systemPromptId;
    if (updates.modelId !== undefined) existing.modelId = updates.modelId;
    if (updates.params !== undefined) existing.params = updates.params;
    if (updates.isPinned !== undefined) existing.isPinned = updates.isPinned;
    if (updates.messages !== undefined) {
      existing.messages = updates.messages;
      // If title is default "New Chat", auto-generate from the first user prompt
      if (existing.title === 'New Chat' || existing.title === 'Untitled Chat') {
        const firstUserMsg = existing.messages.find((m) => m.role === 'user');
        if (firstUserMsg) {
          existing.title = this.generateTitleFromPrompt(firstUserMsg.content);
        }
      }
    }

    existing.updatedAt = now;

    const filePath = path.join(this.conversationsDir, `${id}.json`);
    this.atomicWriteJson(filePath, existing);

    const firstUserMsg = existing.messages.find((m) => m.role === 'user');
    const preview = firstUserMsg ? firstUserMsg.content.slice(0, 100) : '';

    const idx = this.indexCache.findIndex((s) => s.id === id);
    const updatedSummary: ConversationSummary = {
      id,
      title: existing.title,
      createdAt: existing.createdAt,
      updatedAt: now,
      messageCount: existing.messages.length,
      preview,
      modelId: existing.modelId,
      isPinned: existing.isPinned,
    };

    if (idx >= 0) {
      this.indexCache[idx] = updatedSummary;
    } else {
      this.indexCache.push(updatedSummary);
    }

    this.indexCache = this.sortSummaries([...this.indexCache]);
    this.saveIndex();

    return existing;
  }

  public deleteConversation(id: string): boolean {
    const filePath = path.join(this.conversationsDir, `${id}.json`);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      this.indexCache = this.indexCache.filter((s) => s.id !== id);
      this.saveIndex();
      return true;
    } catch {
      return false;
    }
  }

  public clearAllConversations(): boolean {
    try {
      if (fs.existsSync(this.conversationsDir)) {
        const files = fs.readdirSync(this.conversationsDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(this.conversationsDir, file));
          }
        }
      }
      this.indexCache = [];
      this.saveIndex();
      return true;
    } catch {
      return false;
    }
  }

  public exportConversationMarkdown(id: string): string | null {
    const conv = this.getConversation(id);
    if (!conv) return null;

    const dateStr = new Date(conv.createdAt).toLocaleString();
    let md = `# ${conv.title}\n\n`;
    md += `* **Date**: ${dateStr}\n`;
    if (conv.modelId) md += `* **Model**: ${conv.modelId}\n`;
    if (conv.systemPrompt) {
      md += `* **System Persona**: ${conv.systemPrompt}\n`;
    }
    md += `\n---\n\n`;

    for (const msg of conv.messages) {
      if (msg.role === 'user') {
        md += `### 👤 User\n\n${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        md += `### 🤖 Assistant\n\n${msg.content}\n\n`;
        if (msg.metrics) {
          const parts: string[] = [];
          if (msg.metrics.tokensPerSecond) parts.push(`${msg.metrics.tokensPerSecond} t/s`);
          if (msg.metrics.evalCount) parts.push(`${msg.metrics.evalCount} tokens`);
          if (msg.metrics.timeToFirstTokenMs) parts.push(`TTFT: ${msg.metrics.timeToFirstTokenMs}ms`);
          if (msg.metrics.totalDurationMs) {
            parts.push(`${(msg.metrics.totalDurationMs / 1000).toFixed(1)}s`);
          }
          if (parts.length > 0) {
            md += `> *Telemetry: ${parts.join(' • ')}*\n\n`;
          }
        }
      } else if (msg.role === 'system') {
        md += `### ⚙️ System\n\n${msg.content}\n\n`;
      }
      md += `---\n\n`;
    }

    return md;
  }

  public exportAllConversations(): Conversation[] {
    const result: Conversation[] = [];
    for (const item of this.indexCache) {
      const conv = this.getConversation(item.id);
      if (conv) result.push(conv);
    }
    return result;
  }

  public importConversations(conversations: Conversation[]): { imported: number; errors: number } {
    let imported = 0;
    let errors = 0;

    for (const conv of conversations) {
      if (!conv || !conv.id || !Array.isArray(conv.messages)) {
        errors++;
        continue;
      }

      try {
        const filePath = path.join(this.conversationsDir, `${conv.id}.json`);
        this.atomicWriteJson(filePath, conv);
        imported++;
      } catch {
        errors++;
      }
    }

    this.rebuildIndex();
    return { imported, errors };
  }

  // ============================================================================
  // Custom Personas / System Prompts API
  // ============================================================================

  private initDefaultPersonas() {
    const defaults: CustomPersona[] = [
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
    this.atomicWriteJson(this.personasPath, defaults);
  }

  public listPersonas(): CustomPersona[] {
    try {
      if (!fs.existsSync(this.personasPath)) {
        this.initDefaultPersonas();
      }
      const data = fs.readFileSync(this.personasPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  public savePersona(persona: Omit<CustomPersona, 'id'> & { id?: string }): CustomPersona {
    const list = this.listPersonas();
    const id = persona.id || `persona-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newPersona: CustomPersona = {
      ...persona,
      id,
      createdAt: Date.now(),
      isBuiltin: false,
    };

    const idx = list.findIndex((p) => p.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...newPersona, isBuiltin: list[idx].isBuiltin };
    } else {
      list.push(newPersona);
    }

    this.atomicWriteJson(this.personasPath, list);
    return newPersona;
  }

  public deletePersona(id: string): boolean {
    const list = this.listPersonas();
    const target = list.find((p) => p.id === id);
    if (target?.isBuiltin) {
      return false; // Don't delete built-in presets
    }
    const filtered = list.filter((p) => p.id !== id);
    this.atomicWriteJson(this.personasPath, filtered);
    return true;
  }

  // ============================================================================
  // Parameter Presets API
  // ============================================================================

  private initDefaultPresets() {
    const defaults: InferencePreset[] = [
      {
        id: 'balanced',
        name: 'Balanced Daily',
        description: 'Standard temperature (0.7) and Top-P (0.9) for all-around tasks',
        isBuiltin: true,
        params: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          repeatPenalty: 1.1,
          maxTokens: 2048,
          stream: true,
        },
      },
      {
        id: 'coding-logic',
        name: 'Code & Structured Logic',
        description: 'Low temperature (0.2) for exact syntax and deterministic reasoning',
        isBuiltin: true,
        params: {
          temperature: 0.2,
          topP: 0.8,
          topK: 20,
          repeatPenalty: 1.15,
          maxTokens: 3072,
          stream: true,
        },
      },
      {
        id: 'creative-writing',
        name: 'Creative Writing',
        description: 'Higher temperature (0.95) and Top-P (0.95) for diverse vocabulary and storytelling',
        isBuiltin: true,
        params: {
          temperature: 0.95,
          topP: 0.95,
          topK: 50,
          repeatPenalty: 1.05,
          maxTokens: 2048,
          stream: true,
        },
      },
      {
        id: 'strict-deterministic',
        name: 'Strict / Deterministic',
        description: 'Near-zero temperature (0.05) for data extraction and classification',
        isBuiltin: true,
        params: {
          temperature: 0.05,
          topP: 0.5,
          topK: 10,
          repeatPenalty: 1.2,
          maxTokens: 1024,
          stream: true,
        },
      },
    ];
    this.atomicWriteJson(this.presetsPath, defaults);
  }

  public listPresets(): InferencePreset[] {
    try {
      if (!fs.existsSync(this.presetsPath)) {
        this.initDefaultPresets();
      }
      const data = fs.readFileSync(this.presetsPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  public savePreset(preset: Omit<InferencePreset, 'id'> & { id?: string }): InferencePreset {
    const list = this.listPresets();
    const id = preset.id || `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newPreset: InferencePreset = {
      ...preset,
      id,
      isBuiltin: false,
    };

    const idx = list.findIndex((p) => p.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...newPreset, isBuiltin: list[idx].isBuiltin };
    } else {
      list.push(newPreset);
    }

    this.atomicWriteJson(this.presetsPath, list);
    return newPreset;
  }

  public deletePreset(id: string): boolean {
    const list = this.listPresets();
    const target = list.find((p) => p.id === id);
    if (target?.isBuiltin) {
      return false;
    }
    const filtered = list.filter((p) => p.id !== id);
    this.atomicWriteJson(this.presetsPath, filtered);
    return true;
  }
}

export const fileDb = new FileDatabase();

