import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Check, Sparkles, BookOpen } from 'lucide-react';
import { CustomPersona } from '@lm-studio-android/shared';

interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  personas: CustomPersona[];
  selectedPersonaId: string;
  onSelectPersona: (persona: CustomPersona) => void;
  onSavePersona: (persona: { id?: string; name: string; description: string; content: string }) => Promise<void>;
  onDeletePersona: (id: string) => Promise<void>;
}

export const PersonaModal: React.FC<PersonaModalProps> = ({
  isOpen,
  onClose,
  personas,
  selectedPersonaId,
  onSelectPersona,
  onSavePersona,
  onDeletePersona,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const startCreate = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setContent('');
    setIsEditing(true);
  };

  const startEdit = (p: CustomPersona) => {
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description);
    setContent(p.content);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;

    setIsSaving(true);
    try {
      await onSavePersona({
        id: editingId || undefined,
        name: name.trim(),
        description: description.trim(),
        content: content.trim(),
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-studio-surface border border-studio-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-studio-border flex items-center justify-between bg-studio-surface/80">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent" />
            <h2 className="text-sm sm:text-base font-bold text-studio-text">
              System Personas & Roles
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-studio-textMuted hover:text-studio-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isEditing ? (
            /* Create / Edit Form */
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-studio-border">
                <span className="text-xs font-bold font-mono uppercase text-accent">
                  {editingId ? 'Edit Persona' : 'Create Custom Persona'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-studio-textMuted hover:text-studio-text"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-studio-text mb-1">
                  Persona Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Senior Security Auditor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-studio-card border border-studio-border text-xs text-studio-text outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-studio-text mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g., Finds subtle memory leaks and concurrency bugs"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-studio-card border border-studio-border text-xs text-studio-text outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-studio-text mb-1">
                  System Prompt Instructions *
                </label>
                <textarea
                  rows={5}
                  placeholder="You are an expert system auditor. Analyze all incoming code strictly..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-studio-card border border-studio-border text-xs text-studio-text outline-none focus:border-accent resize-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-studio-textMuted hover:bg-studio-card border border-studio-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !name.trim() || !content.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:opacity-90 disabled:opacity-40 transition-all shadow-accent-glow"
                >
                  {isSaving ? 'Saving...' : editingId ? 'Update Persona' : 'Save Persona'}
                </button>
              </div>
            </form>
          ) : (
            /* Persona Cards List */
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-studio-textMuted">
                  Personas condition the LLM's identity, reasoning depth, and formatting style.
                </p>
                <button
                  onClick={startCreate}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent text-white hover:opacity-90 text-xs font-medium shadow-accent-glow transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Persona</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {personas.map((p) => {
                  const isSelected = p.id === selectedPersonaId;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        onSelectPersona(p);
                        onClose();
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-studio-card border-accent shadow-sm'
                          : 'bg-studio-card/60 hover:bg-studio-card border-studio-border'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold ${
                              isSelected ? 'text-accent' : 'text-studio-text'
                            }`}
                          >
                            {p.name}
                          </span>
                          {p.isBuiltin ? (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-studio-surface text-studio-textMuted border border-studio-border">
                              Built-in
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-accent/20 text-accent border border-accent/30">
                              Custom
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {!p.isBuiltin && (
                            <>
                              <button
                                onClick={() => startEdit(p)}
                                className="p-1 rounded text-studio-textMuted hover:text-studio-text transition-colors"
                                title="Edit persona"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeletePersona(p.id)}
                                className="p-1 rounded text-studio-textMuted hover:text-crimson-accent transition-colors"
                                title="Delete persona"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {isSelected && (
                            <span className="text-accent flex items-center gap-1 text-xs font-semibold pl-1">
                              <Check className="w-3.5 h-3.5" /> Active
                            </span>
                          )}
                        </div>
                      </div>

                      {p.description && (
                        <p className="text-[11px] text-studio-textMuted">
                          {p.description}
                        </p>
                      )}

                      <p className="text-[11px] font-mono text-studio-textMuted bg-studio-surface/70 p-2 rounded-lg line-clamp-2">
                        {p.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

