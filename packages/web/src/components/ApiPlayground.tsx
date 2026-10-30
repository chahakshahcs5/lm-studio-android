import React, { useState } from 'react';
import { Terminal, Copy, Check, ExternalLink, Code2, Play } from 'lucide-react';
import { EngineStatus } from '@lm-studio-android/shared';
import { copyToClipboard } from '../utils/clipboard';

interface ApiPlaygroundProps {
  engineStatus: EngineStatus | null;
  serverIp?: string;
}

export const ApiPlayground: React.FC<ApiPlaygroundProps> = ({ engineStatus, serverIp }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  const modelName = engineStatus?.currentModel?.name || 'local-phone-model';
  const port = window.location.port && window.location.port !== '5173' ? window.location.port : '8080';
  const ip = serverIp || (window.location.hostname !== 'localhost' ? window.location.hostname : '127.0.0.1');
  const apiBase = `${window.location.protocol}//${ip}:${port}/v1`;

  const handleCopy = async (text: string, key: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleTestPing = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/v1/models');
      if (res.ok) {
        const data = await res.json();
        setTestResult(`HTTP 200 OK: ${JSON.stringify(data, null, 2)}`);
      } else {
        setTestResult(`Error HTTP ${res.status}`);
      }
    } catch (e: any) {
      setTestResult(`Connection Failed: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const continueConfig = JSON.stringify(
    {
      models: [
        {
          title: 'LM Studio Android (Phone GPU)',
          provider: 'openai',
          model: modelName,
          apiBase: apiBase,
          apiKey: 'not-needed',
        },
      ],
    },
    null,
    2
  );

  const pythonSnippet = `from openai import OpenAI

client = OpenAI(
    base_url="${apiBase}",
    api_key="not-needed"
)

response = client.chat.completions.create(
    model="${modelName}",
    messages=[
        {"role": "system", "content": "You are an assistant running on a smartphone."},
        {"role": "user", "content": "Write a high-performance quicksort in Python."}
    ],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
`;

  const tsSnippet = `import { OpenAI } from "openai";

const openai = new OpenAI({
  baseURL: "${apiBase}",
  apiKey: "not-needed",
});

async function main() {
  const stream = await openai.chat.completions.create({
    model: "${modelName}",
    messages: [{ role: "user", content: "Explain vector quantization in 3 bullet points." }],
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }
}

main();
`;

  const curlSnippet = `curl http://${ip}:${port}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [{"role": "user", "content": "Hello edge AI!"}],
    "stream": true
  }'`;

  return (
    <div className="flex-1 flex flex-col h-full bg-studio-bg overflow-y-auto select-none p-6 md:p-8 space-y-8 max-w-5xl mx-auto w-full transition-colors">
      {/* Header */}
      <div className="pb-4 border-b border-studio-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-mono tracking-tight text-studio-text flex items-center gap-2">
            <Terminal className="w-5 h-5 text-accent" />
            Universal OpenAI API Compatibility
          </h2>
          <p className="text-xs text-studio-textMuted mt-1">
            Drop-in endpoint for VS Code (Continue, Roo Code, Cline), Python OpenAI SDK, and LangChain.
          </p>
        </div>

        <button
          onClick={handleTestPing}
          disabled={isTesting}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 self-start sm:self-auto shadow-accent-glow"
        >
          <Play className="w-3.5 h-3.5 fill-white stroke-white" />
          <span>{isTesting ? 'Pinging /v1/models...' : 'Test API Ping'}</span>
        </button>
      </div>

      {/* Ping Result Box */}
      {testResult && (
        <div className="p-3.5 rounded-xl bg-studio-card border border-accent/30 font-mono text-xs text-studio-text shadow-studio-subtle">
          <span className="text-accent font-bold block mb-1">Ping Output:</span>
          <pre className="text-[11px] overflow-x-auto text-studio-text">{testResult}</pre>
        </div>
      )}

      {/* Base URL Card */}
      <div className="p-4 rounded-xl bg-studio-surface border border-studio-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-studio-subtle">
        <div>
          <span className="text-[11px] font-mono text-studio-textMuted uppercase tracking-wider block">
            OpenAI API Base URL
          </span>
          <span className="font-mono text-sm font-bold text-accent mt-0.5 block">
            {apiBase}
          </span>
        </div>
        <button
          onClick={() => handleCopy(apiBase, 'apibase')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-studio-card border border-studio-border text-xs text-studio-text hover:text-accent transition-colors self-start sm:self-auto"
        >
          {copiedKey === 'apibase' ? (
            <Check className="w-3.5 h-3.5 text-accent" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span>Copy URL</span>
        </button>
      </div>

      {/* Code Snippets Section */}
      <div className="space-y-6">
        {/* VS Code Continue Config */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-accent" />
              <h3 className="font-mono text-xs font-bold text-studio-text">
                VS Code / Continue / Cline (config.json)
              </h3>
            </div>
            <button
              onClick={() => handleCopy(continueConfig, 'continue')}
              className="flex items-center gap-1 text-xs text-studio-textMuted hover:text-accent transition-colors"
            >
              {copiedKey === 'continue' ? (
                <Check className="w-3.5 h-3.5 text-accent" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Copy</span>
            </button>
          </div>
          <pre className="p-3.5 rounded-xl bg-studio-card border border-studio-border font-mono text-xs text-studio-text overflow-x-auto shadow-studio-subtle">
            {continueConfig}
          </pre>
        </div>

        {/* Python Snippet */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-accent" />
              <h3 className="font-mono text-xs font-bold text-studio-text">
                Python (OpenAI SDK)
              </h3>
            </div>
            <button
              onClick={() => handleCopy(pythonSnippet, 'python')}
              className="flex items-center gap-1 text-xs text-studio-textMuted hover:text-accent transition-colors"
            >
              {copiedKey === 'python' ? (
                <Check className="w-3.5 h-3.5 text-accent" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Copy</span>
            </button>
          </div>
          <pre className="p-3.5 rounded-xl bg-studio-card border border-studio-border font-mono text-xs text-studio-text overflow-x-auto shadow-studio-subtle">
            {pythonSnippet}
          </pre>
        </div>

        {/* TypeScript Snippet */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-accent" />
              <h3 className="font-mono text-xs font-bold text-studio-text">
                TypeScript / Node.js
              </h3>
            </div>
            <button
              onClick={() => handleCopy(tsSnippet, 'ts')}
              className="flex items-center gap-1 text-xs text-studio-textMuted hover:text-accent transition-colors"
            >
              {copiedKey === 'ts' ? (
                <Check className="w-3.5 h-3.5 text-accent" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Copy</span>
            </button>
          </div>
          <pre className="p-3.5 rounded-xl bg-studio-card border border-studio-border font-mono text-xs text-studio-text overflow-x-auto shadow-studio-subtle">
            {tsSnippet}
          </pre>
        </div>

        {/* cURL Snippet */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-studio-textMuted" />
              <h3 className="font-mono text-xs font-bold text-studio-text">cURL Terminal Command</h3>
            </div>
            <button
              onClick={() => handleCopy(curlSnippet, 'curl')}
              className="flex items-center gap-1 text-xs text-studio-textMuted hover:text-accent transition-colors"
            >
              {copiedKey === 'curl' ? (
                <Check className="w-3.5 h-3.5 text-accent" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Copy</span>
            </button>
          </div>
          <pre className="p-3.5 rounded-xl bg-studio-card border border-studio-border font-mono text-xs text-studio-text overflow-x-auto shadow-studio-subtle">
            {curlSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
};
