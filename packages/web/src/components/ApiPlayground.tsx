import React, { useState } from 'react';
import { Terminal, Copy, Check, ExternalLink, Cable, Wifi, Code2, Play } from 'lucide-react';
import { EngineStatus } from '@lm-studio-android/shared';

interface ApiPlaygroundProps {
  engineStatus: EngineStatus | null;
}

export const ApiPlayground: React.FC<ApiPlaygroundProps> = ({ engineStatus }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  const modelName = engineStatus?.currentModel?.name || 'local-phone-model';
  const apiBase = `${window.location.protocol}//${window.location.hostname}:8080/v1`;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
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
        {"role": "user", "content": "Write a high-performance bubble sort in Python."}
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

  const curlSnippet = `curl http://localhost:8080/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [{"role": "user", "content": "Hello edge AI!"}],
    "stream": true
  }'`;

  return (
    <div className="flex-1 flex flex-col h-full bg-studio-bg overflow-y-auto select-none p-6 md:p-8 space-y-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="pb-4 border-b border-studio-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-mono tracking-tight text-slate-100 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-accent" />
            Universal OpenAI API Compatibility
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Drop-in endpoint for VS Code (Continue, Roo Code, Cline), Python OpenAI SDK, and LangChain.
          </p>
        </div>

        <button
          onClick={handleTestPing}
          disabled={isTesting}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-accent text-slate-950 hover:bg-emerald-400 transition-all active:scale-95 disabled:opacity-50 self-start sm:self-auto shadow-glow-emerald"
        >
          <Play className="w-3.5 h-3.5 fill-slate-950" />
          <span>{isTesting ? 'Pinging /v1/models...' : 'Test API Ping'}</span>
        </button>
      </div>

      {/* Ping Result Box */}
      {testResult && (
        <div className="p-3.5 rounded-xl bg-studio-card border border-emerald-accent/30 font-mono text-xs text-slate-300">
          <span className="text-emerald-accent font-bold block mb-1">Ping Output:</span>
          <pre className="text-[11px] overflow-x-auto text-slate-200">{testResult}</pre>
        </div>
      )}

      {/* Base URL Card */}
      <div className="p-4 rounded-xl bg-studio-surface border border-studio-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
            OpenAI API Base URL
          </span>
          <span className="font-mono text-sm font-bold text-emerald-accent mt-0.5 block">
            {apiBase}
          </span>
        </div>
        <button
          onClick={() => handleCopy(apiBase, 'apibase')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-studio-card border border-studio-border text-xs text-slate-300 hover:text-emerald-accent transition-colors self-start sm:self-auto"
        >
          {copiedKey === 'apibase' ? (
            <Check className="w-3.5 h-3.5 text-emerald-accent" />
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
              <Code2 className="w-4 h-4 text-emerald-accent" />
              <h3 className="font-mono text-xs font-bold text-slate-200">
                VS Code / Continue / Cline (config.json)
              </h3>
            </div>
            <button
              onClick={() => handleCopy(continueConfig, 'continue')}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-accent transition-colors"
            >
              {copiedKey === 'continue' ? (
                <Check className="w-3.5 h-3.5 text-emerald-accent" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Copy</span>
            </button>
          </div>
          <pre className="p-3.5 rounded-xl bg-studio-card border border-studio-border font-mono text-xs text-slate-300 overflow-x-auto">
            {continueConfig}
          </pre>
        </div>

        {/* Python Snippet */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-accent" />
              <h3 className="font-mono text-xs font-bold text-slate-200">
                Python (OpenAI SDK)
              </h3>
            </div>
            <button
              onClick={() => handleCopy(pythonSnippet, 'python')}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-accent transition-colors"
            >
              {copiedKey === 'python' ? (
                <Check className="w-3.5 h-3.5 text-emerald-accent" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Copy</span>
            </button>
          </div>
          <pre className="p-3.5 rounded-xl bg-studio-card border border-studio-border font-mono text-xs text-slate-300 overflow-x-auto">
            {pythonSnippet}
          </pre>
        </div>

        {/* TypeScript Snippet */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-cyan-accent" />
              <h3 className="font-mono text-xs font-bold text-slate-200">
                TypeScript / Node.js
              </h3>
            </div>
            <button
              onClick={() => handleCopy(tsSnippet, 'ts')}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-accent transition-colors"
            >
              {copiedKey === 'ts' ? (
                <Check className="w-3.5 h-3.5 text-emerald-accent" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Copy</span>
            </button>
          </div>
          <pre className="p-3.5 rounded-xl bg-studio-card border border-studio-border font-mono text-xs text-slate-300 overflow-x-auto">
            {tsSnippet}
          </pre>
        </div>

        {/* cURL Snippet */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-400" />
              <h3 className="font-mono text-xs font-bold text-slate-200">cURL Terminal Command</h3>
            </div>
            <button
              onClick={() => handleCopy(curlSnippet, 'curl')}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-accent transition-colors"
            >
              {copiedKey === 'curl' ? (
                <Check className="w-3.5 h-3.5 text-emerald-accent" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Copy</span>
            </button>
          </div>
          <pre className="p-3.5 rounded-xl bg-studio-card border border-studio-border font-mono text-xs text-slate-300 overflow-x-auto">
            {curlSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
};
