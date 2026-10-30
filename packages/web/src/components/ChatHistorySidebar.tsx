import React, { useState } from 'react';
import {
  Plus,
  Search,
  Pin,
  PinOff,
  Trash2,
  Edit2,
  Download,
  Upload,
  MessageSquare,
  Clock,
  Check,
  X,
  FileText,
  FileCode,
  FolderDown,
} from 'lucide-react';
import { ConversationSummary } from '@lm-studio-android/shared';

interface ChatHistorySidebarProps {
  conversations: ConversationSummary[];
  activeId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onClearAllConversations: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onTogglePin: (id: string, currentPin: boolean) => void;
  onExportConversation: (id: string, format: 'md' | 'json') => void;
  onExportAll: () => void;
  onImportBackup: (file: File) => void;
}

export const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
  conversations,
  activeId,
  isOpen,
  onToggle,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onClearAllConversations,
  onRenameConversation,
  onTogglePin,
  onExportConversation,
  onExportAll,
  onImportBackup,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [exportMenuId, setExportMenuId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const filtered = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      c.title.toLowerCase().includes(q) ||
      (c.preview && c.preview.toLowerCase().includes(q))
    );
  });

  const pinnedList = filtered.filter((c) => c.isPinned);
  const unpinnedList = filtered.filter((c) => !c.isPinned);

  const formatRelativeTime = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  const startRename = (conv: ConversationSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveRename = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackup(file);
      e.target.value = '';
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <aside className="w-72 sm:w-80 h-full flex flex-col bg-studio-surface border-r border-studio-border select-none z-30 transition-all flex-shrink-0">
      {/* Top Header / Actions */}
      <div className="p-3 border-b border-studio-border flex flex-col gap-2.5 bg-studio-surface/90">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-studio-text">
              Chat History
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-studio-card text-studio-textMuted border border-studio-border">
              {conversations.length}
            </span>
          </div>

          <button
            onClick={onToggle}
            className="p-1 rounded text-studio-textMuted hover:text-studio-text hover:bg-studio-card transition-colors text-xs"
            title="Collapse Sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-accent text-white hover:opacity-95 text-xs font-semibold shadow-accent-glow transition-all active:scale-[0.99]"
        >
          <Plus className="w-4 h-4" />
          <span>New Conversation</span>
        </button>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-studio-textMuted" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-studio-card border border-studio-border text-xs text-studio-text placeholder:text-studio-textMuted outline-none focus:border-accent transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-studio-textMuted hover:text-studio-text"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {conversations.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-studio-textMuted">
            <MessageSquare className="w-8 h-8 opacity-30 mb-2" />
            <p className="text-xs font-medium">No conversations saved yet</p>
            <p className="text-[11px] opacity-75 mt-0.5">
              Start chatting and your history will be safely stored on your device.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-xs text-studio-textMuted">
            No matches found for "{searchQuery}"
          </div>
        ) : (
          <>
            {/* Pinned Section */}
            {pinnedList.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-accent font-semibold flex items-center gap-1.5">
                  <Pin className="w-3 h-3" />
                  <span>Pinned Chats</span>
                </div>
                {pinnedList.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isActive={conv.id === activeId}
                    isEditing={editingId === conv.id}
                    editTitle={editTitle}
                    exportMenuOpen={exportMenuId === conv.id}
                    onSelect={() => onSelectConversation(conv.id)}
                    onStartRename={(e) => startRename(conv, e)}
                    onSaveRename={(e) => saveRename(conv.id, e)}
                    onCancelRename={() => setEditingId(null)}
                    onChangeEditTitle={(val) => setEditTitle(val)}
                    onTogglePin={(e) => {
                      e.stopPropagation();
                      onTogglePin(conv.id, !conv.isPinned);
                    }}
                    onToggleExportMenu={(e) => {
                      e.stopPropagation();
                      setExportMenuId(exportMenuId === conv.id ? null : conv.id);
                    }}
                    onExport={(format) => {
                      onExportConversation(conv.id, format);
                      setExportMenuId(null);
                    }}
                    onDelete={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    formatTime={formatRelativeTime}
                  />
                ))}
              </div>
            )}

            {/* All / Recent Section */}
            <div className="space-y-1">
              {pinnedList.length > 0 && (
                <div className="px-2 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-studio-textMuted font-semibold">
                  <span>Recent Conversations</span>
                </div>
              )}
              {unpinnedList.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  isActive={conv.id === activeId}
                  isEditing={editingId === conv.id}
                  editTitle={editTitle}
                  exportMenuOpen={exportMenuId === conv.id}
                  onSelect={() => onSelectConversation(conv.id)}
                  onStartRename={(e) => startRename(conv, e)}
                  onSaveRename={(e) => saveRename(conv.id, e)}
                  onCancelRename={() => setEditingId(null)}
                  onChangeEditTitle={(val) => setEditTitle(val)}
                  onTogglePin={(e) => {
                    e.stopPropagation();
                    onTogglePin(conv.id, !conv.isPinned);
                  }}
                  onToggleExportMenu={(e) => {
                    e.stopPropagation();
                    setExportMenuId(exportMenuId === conv.id ? null : conv.id);
                  }}
                  onExport={(format) => {
                    onExportConversation(conv.id, format);
                    setExportMenuId(null);
                  }}
                  onDelete={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conv.id);
                  }}
                  formatTime={formatRelativeTime}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer Tools: Backup, Import, Clear */}
      <div className="p-2.5 border-t border-studio-border bg-studio-surface/90 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-studio-textMuted px-1">
          <span className="flex items-center gap-1 font-mono text-[11px]">
            <Clock className="w-3 h-3 text-accent" />
            <span>Local File DB</span>
          </span>
          <div className="flex items-center gap-1">
            {/* Export All */}
            <button
              onClick={onExportAll}
              className="p-1 rounded hover:bg-studio-card hover:text-studio-text transition-colors"
              title="Backup All Conversations (JSON)"
            >
              <FolderDown className="w-3.5 h-3.5" />
            </button>

            {/* Import Backup */}
            <label
              className="p-1 rounded hover:bg-studio-card hover:text-studio-text transition-colors cursor-pointer"
              title="Import JSON Backup"
            >
              <Upload className="w-3.5 h-3.5" />
              <input
                type="file"
                accept=".json"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>

            {/* Clear All */}
            {conversations.length > 0 && (
              <button
                onClick={() => {
                  if (confirmClearAll) {
                    onClearAllConversations();
                    setConfirmClearAll(false);
                  } else {
                    setConfirmClearAll(true);
                    setTimeout(() => setConfirmClearAll(false), 3000);
                  }
                }}
                className={`p-1 rounded transition-colors ${
                  confirmClearAll
                    ? 'bg-crimson-muted text-crimson-accent'
                    : 'hover:bg-crimson-muted hover:text-crimson-accent'
                }`}
                title={confirmClearAll ? 'Click again to confirm clear all' : 'Clear All Chats'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {confirmClearAll && (
          <div className="text-[10px] text-crimson-accent px-1 text-center font-semibold animate-pulse">
            Click trash icon again to wipe all local chat history!
          </div>
        )}
      </div>
    </aside>
  );
};

// ============================================================================
// Single Conversation Item Component
// ============================================================================

interface ConversationItemProps {
  conv: ConversationSummary;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  exportMenuOpen: boolean;
  onSelect: () => void;
  onStartRename: (e: React.MouseEvent) => void;
  onSaveRename: (e?: React.FormEvent) => void;
  onCancelRename: () => void;
  onChangeEditTitle: (val: string) => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onToggleExportMenu: (e: React.MouseEvent) => void;
  onExport: (format: 'md' | 'json') => void;
  onDelete: (e: React.MouseEvent) => void;
  formatTime: (ts: number) => string;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conv,
  isActive,
  isEditing,
  editTitle,
  exportMenuOpen,
  onSelect,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onChangeEditTitle,
  onTogglePin,
  onToggleExportMenu,
  onExport,
  onDelete,
  formatTime,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`group relative rounded-xl p-2.5 cursor-pointer transition-all border ${
        isActive
          ? 'bg-studio-card border-accent/40 shadow-sm'
          : 'bg-transparent hover:bg-studio-card/60 border-transparent hover:border-studio-border'
      }`}
    >
      {isEditing ? (
        <form onSubmit={onSaveRename} className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => onChangeEditTitle(e.target.value)}
            autoFocus
            className="flex-1 bg-studio-bg border border-accent rounded px-2 py-1 text-xs text-studio-text outline-none"
          />
          <button type="submit" className="p-1 text-accent hover:opacity-80">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onCancelRename} className="p-1 text-studio-textMuted hover:text-studio-text">
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between gap-1.5">
            <span
              className={`text-xs font-medium truncate flex-1 ${
                isActive ? 'text-accent font-semibold' : 'text-studio-text'
              }`}
              title={conv.title}
            >
              {conv.title}
            </span>

            {/* Quick Actions (visible on hover or active) */}
            <div
              className={`flex items-center gap-0.5 transition-opacity ${
                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              {/* Pin */}
              <button
                onClick={onTogglePin}
                className={`p-1 rounded hover:bg-studio-bg text-studio-textMuted hover:text-accent transition-colors ${
                  conv.isPinned ? 'text-accent' : ''
                }`}
                title={conv.isPinned ? 'Unpin' : 'Pin to top'}
              >
                {conv.isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
              </button>

              {/* Rename */}
              <button
                onClick={onStartRename}
                className="p-1 rounded hover:bg-studio-bg text-studio-textMuted hover:text-studio-text transition-colors"
                title="Rename chat"
              >
                <Edit2 className="w-3 h-3" />
              </button>

              {/* Export Menu */}
              <div className="relative">
                <button
                  onClick={onToggleExportMenu}
                  className="p-1 rounded hover:bg-studio-bg text-studio-textMuted hover:text-studio-text transition-colors"
                  title="Export options"
                >
                  <Download className="w-3 h-3" />
                </button>

                {exportMenuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full mt-1 w-32 bg-studio-card border border-studio-border rounded-lg shadow-xl z-50 p-1 flex flex-col gap-0.5 text-xs"
                  >
                    <button
                      onClick={() => onExport('md')}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-studio-surface text-studio-text text-left transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-accent" />
                      <span>Markdown (.md)</span>
                    </button>
                    <button
                      onClick={() => onExport('json')}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-studio-surface text-studio-text text-left transition-colors"
                    >
                      <FileCode className="w-3.5 h-3.5 text-amber-400" />
                      <span>JSON (.json)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Delete */}
              <button
                onClick={onDelete}
                className="p-1 rounded hover:bg-crimson-muted text-studio-textMuted hover:text-crimson-accent transition-colors"
                title="Delete chat"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Subtext info: preview or timestamp */}
          <div className="flex items-center justify-between text-[11px] text-studio-textMuted mt-1">
            <span className="truncate max-w-[150px] opacity-80">
              {conv.preview || (conv.modelId ? `Model: ${conv.modelId}` : `${conv.messageCount} messages`)}
            </span>
            <span className="font-mono text-[10px] flex-shrink-0 opacity-70">
              {formatTime(conv.updatedAt)}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

