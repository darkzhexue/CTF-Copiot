import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Send, Terminal, Settings, Shield, Cpu, Code, Lock, RefreshCw, AlertCircle, Plus, Square, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { tools } from '@/lib/ctf-tools';

// --- Types ---
type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  thoughts?: string; // optional chain-of-thought or reasoning
  timestamp: number;
};

type ToolType = 'base64' | 'hex' | 'rot13' | 'url';

const INITIAL_SYSTEM_MESSAGE = `你好，我是 CTF 解题助手。我可以协助代码审计、逆向分析、编码/加密识别、Linux 提权排查和流量分析；直接贴题目现象、代码或数据即可开始。`;

// --- Components ---

const MatrixBackground = () => {
  return (
    <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
      {/* Abstract grid lines */}
      <div className="absolute inset-0" 
           style={{
             backgroundImage: `linear-gradient(rgba(0, 255, 0, 0.1) 1px, transparent 1px),
             linear-gradient(90deg, rgba(0, 255, 0, 0.1) 1px, transparent 1px)`,
             backgroundSize: '40px 40px'
           }}>
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'tools' | 'notes'>('chat');
  const [modelInputMode, setModelInputMode] = useState<'select' | 'manual'>(() => {
    try {
      const saved = localStorage.getItem('ctf_model_input_mode');
      return saved === 'manual' || saved === 'select' ? saved : 'select';
    } catch {
      return 'select';
    }
  });

  // Conversation management
  type Conversation = {
    id: string;
    name: string;
    messages: Message[];
  };

  const defaultConv: Conversation = {
    id: 'default',
    name: '默认会话',
    messages: [{ role: 'assistant', content: INITIAL_SYSTEM_MESSAGE, timestamp: Date.now() }]
  };

  const [conversations, setConversations] = useState<Conversation[]>([defaultConv]);
  const [activeConvId, setActiveConvId] = useState<string>(defaultConv.id);
  const [messages, setMessages] = useState<Message[]>(defaultConv.messages);
  const [hasHydratedConversations, setHasHydratedConversations] = useState(false);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAborting, setIsAborting] = useState(false);
  const [ollamaModel, setOllamaModel] = useState(() => {
    try {
      return localStorage.getItem('ctf_ollama_model') || 'qwen3:8b';
    } catch {
      return 'qwen3:8b';
    }
  });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeRequestControllerRef = useRef<AbortController | null>(null);
 
  // 思考模式开关（是否请求模型输出带有思考链）
  const [enableThoughts] = useState(true);
  const [enableStreaming] = useState(true);
  // Tool State
  const [toolInput, setToolInput] = useState('');
  const [toolOutput, setToolOutput] = useState('');
  const [activeTool, setActiveTool] = useState<ToolType>('base64');

  // Notes State
  const [notes, setNotes] = useState<string>('# CTF 作战笔记\n\n- 目标 IP: \n- 发现端口: \n- Flag: \n');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadOllamaModels = async () => {
    setModelsLoading(true);
    setModelsError('');
    try {
      const res = await fetch('/api/ollama/models');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to fetch model list');
      }
      const models = Array.isArray(data?.models)
        ? data.models.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
      setAvailableModels(models);

      if (!models.length) {
        setModelsError('未检测到已安装模型，请使用手动输入。');
        setModelInputMode('manual');
        return;
      }

      if (!models.includes(ollamaModel)) {
        setOllamaModel(models[0]);
      }
      if (modelInputMode !== 'manual') {
        setModelInputMode('select');
      }
    } catch (error: any) {
      setAvailableModels([]);
      setModelsError(error?.message || '读取模型列表失败');
      setModelInputMode('manual');
    } finally {
      setModelsLoading(false);
    }
  };

  // load/save conversations
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ctf_conversations');
      if (saved) {
        const parsed: Conversation[] = JSON.parse(saved);
        if (parsed.length) {
          const savedActiveConvId = localStorage.getItem('ctf_active_conv_id');
          const nextActiveConvId = savedActiveConvId && parsed.some(c => c.id === savedActiveConvId)
            ? savedActiveConvId
            : parsed[0].id;
          setConversations(parsed);
          setActiveConvId(nextActiveConvId);
          const activeConv = parsed.find(c => c.id === nextActiveConvId) || parsed[0];
          setMessages(activeConv.messages);
        }
      }
    } catch {}
    setHasHydratedConversations(true);
  }, []);

  useEffect(() => {
    loadOllamaModels();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // whenever conversations change, persist
    if (!hasHydratedConversations) return;
    localStorage.setItem('ctf_conversations', JSON.stringify(conversations));
  }, [conversations, hasHydratedConversations]);

  useEffect(() => {
    if (!hasHydratedConversations) return;
    localStorage.setItem('ctf_active_conv_id', activeConvId);
  }, [activeConvId, hasHydratedConversations]);

  useEffect(() => {
    try {
      localStorage.setItem('ctf_ollama_model', ollamaModel);
    } catch {}
  }, [ollamaModel]);

  useEffect(() => {
    try {
      localStorage.setItem('ctf_model_input_mode', modelInputMode);
    } catch {}
  }, [modelInputMode]);

  useEffect(() => {
    // when active conversation changes, update displayed messages
    const conv = conversations.find(c => c.id === activeConvId);
    if (conv) {
      setMessages(conv.messages);
    }
  }, [activeConvId, conversations]);

  const createConversation = () => {
    const id = Date.now().toString();
    const userInput = window.prompt('请输入新会话名称', `会话 ${conversations.length + 1}`);
    if (userInput === null) return; // User cancelled
    const name = userInput.trim() || `未命名会话 ${conversations.length + 1}`;
    const conv: Conversation = {
      id,
      name,
      messages: [{ role: 'assistant', content: INITIAL_SYSTEM_MESSAGE, timestamp: Date.now() }]
    };
    setConversations(prev => [conv, ...prev]);
    setActiveConvId(id);
  };

  const selectConversation = (id: string) => {
    setActiveConvId(id);
  };

  const clearConversationHistory = () => {
    const confirmed = window.confirm('确定要清空所有会话记录吗？此操作不可撤销。');
    if (!confirmed) return;
    setConversations([defaultConv]);
    setActiveConvId(defaultConv.id);
    setMessages(defaultConv.messages);
    localStorage.removeItem('ctf_conversations');
    localStorage.removeItem('ctf_active_conv_id');
  };

  const deleteCurrentConversation = () => {
    const currentConv = conversations.find(c => c.id === activeConvId);
    if (!currentConv) return;

    const confirmed = window.confirm(`确定要删除当前对话“${currentConv.name}”吗？`);
    if (!confirmed) return;

    if (conversations.length <= 1) {
      setConversations([defaultConv]);
      setActiveConvId(defaultConv.id);
      setMessages(defaultConv.messages);
      return;
    }

    const currentIndex = conversations.findIndex(c => c.id === activeConvId);
    const remainingConversations = conversations.filter(c => c.id !== activeConvId);
    const nextIndex = Math.min(currentIndex, remainingConversations.length - 1);
    const nextConv = remainingConversations[nextIndex];

    setConversations(remainingConversations);
    setActiveConvId(nextConv.id);
    setMessages(nextConv.messages);
  };

  const handleAbort = async () => {
    if (!isLoading && !activeRequestControllerRef.current) return;
    setIsAborting(true);
    try {
      await fetch('/api/ollama/abort', { method: 'POST' });
    } catch {}

    try {
      activeRequestControllerRef.current?.abort();
    } catch {}

    activeRequestControllerRef.current = null;
    setIsLoading(false);
    setIsAborting(false);
  };

  // helper that pulls out [[THOUGHTS]] tags if present
  const extractThoughts = (text: string) => {
    const marker = /\[\[THOUGHTS\]\]([\s\S]*?)\[\[\/THOUGHTS\]\]/i;
    const m = text.match(marker);
    if (m) {
      return {
        cleaned: text.replace(m[0], '').trim(),
        thoughts: m[1].trim()
      };
    }
    return { cleaned: text, thoughts: undefined };
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => {
      const updated = [...prev, userMsg];
      setConversations(convs => convs.map(c => c.id === activeConvId ? { ...c, messages: updated } : c));
      return updated;
    });
    setInput('');
    setIsLoading(true);
    const requestController = new AbortController();
    activeRequestControllerRef.current = requestController;
    try {
      const endpoint = '/api/ollama/chat';
      const outgoing = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const payload = {
        model: ollamaModel,
        messages: outgoing,
        stream: enableStreaming,
        options: { think: enableThoughts }
      };
      if (enableStreaming && typeof ReadableStream !== 'undefined') {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: requestController.signal
        });
        if (!res.ok || !res.body) {
          const errText = await res.text();
          throw new Error(errText || 'Stream request failed');
        }
        let pendingContent = '';
        let pendingThoughts = '';
        let charQueue = '';
        let streamEnded = false;
        let typingTimer: ReturnType<typeof setInterval> | null = null;
        const updateAssistantMessage = () => {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== 'assistant') return prev;
            const updatedLast: Message = {
              ...last,
              content: pendingContent,
              ...(pendingThoughts ? { thoughts: pendingThoughts } : {})
            };
            const updated = [...prev.slice(0, -1), updatedLast];
            setConversations(convs => convs.map(c => c.id === activeConvId ? { ...c, messages: updated } : c));
            return updated;
          });
        };
        const ensureTypingTimer = () => {
          if (typingTimer) return;
          typingTimer = setInterval(() => {
            if (!charQueue.length) {
              if (streamEnded) {
                clearInterval(typingTimer!);
                typingTimer = null;
                updateAssistantMessage();
              }
              return;
            }
            pendingContent += charQueue[0];
            charQueue = charQueue.slice(1);
            updateAssistantMessage();
          }, 12);
        };
        setMessages(prev => {
          const assistantMsg: Message = { role: 'assistant', content: '', timestamp: Date.now() };
          const updated = [...prev, assistantMsg];
          setConversations(convs => convs.map(c => c.id === activeConvId ? { ...c, messages: updated } : c));
          return updated;
        });
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const processStreamLine = (line: string) => {
          if (!line) return;
          try {
            const obj = JSON.parse(line);
            const rawFragment = obj?.message?.content ?? obj?.content ?? '';
            const fragment = String(rawFragment).replace(/\[\[THOUGHTS\]\]|\[\[\/THOUGHTS\]\]/gi, '');
            if (fragment) {
              charQueue += fragment;
              ensureTypingTimer();
            }
            if (enableThoughts) {
              const thoughtChunk =
                obj?.message?.thinking ??
                obj?.message?.thoughts ??
                obj?.message?.reasoning ??
                obj?.thinking ??
                obj?.thoughts ??
                obj?.reasoning ??
                '';
              if (thoughtChunk) {
                const nextThoughts = String(thoughtChunk);
                if (nextThoughts.startsWith(pendingThoughts)) {
                  pendingThoughts = nextThoughts;
                } else {
                  pendingThoughts += nextThoughts;
                }
                updateAssistantMessage();
              }
            }
            if (obj?.done) {
              streamEnded = true;
              ensureTypingTimer();
            }
          } catch {
            // ignore malformed lines
          }
        };
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';
          for (const line of lines) {
            processStreamLine(line.trim());
          }
        }
        if (buffer.trim()) {
          processStreamLine(buffer.trim());
        }
        streamEnded = true;
        ensureTypingTimer();
        await new Promise<void>((resolve) => {
          const waitUntilComplete = () => {
            if (!typingTimer && !charQueue.length) {
              resolve();
              return;
            }
            setTimeout(waitUntilComplete, 16);
          };
          waitUntilComplete();
        });
      } else {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: requestController.signal
        });
        const data = await res.json();
        console.debug('ollama response', data);
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch response');
        }
        let content = '';
        let thoughts: string | undefined;
        if (data.message) {
          content = data.message.content;
          thoughts = data.message.thoughts || data.message.reasoning;
        } else if (data.choices && data.choices[0]?.message) {
          content = data.choices[0].message.content;
          thoughts = data.choices[0].message.thoughts || data.choices[0].message.reasoning;
        } else if (typeof data === 'string') {
          content = data;
        }
        if (!thoughts) {
          const result = extractThoughts(content);
          content = result.cleaned;
          thoughts = result.thoughts;
        }
        content = content.replace(/\[\[THOUGHTS\]\]|\[\[\/THOUGHTS\]\]/gi, '');
        if (!enableThoughts) {
          thoughts = undefined;
        }
        const assistantMsg: Message = {
          role: 'assistant',
          content,
          timestamp: Date.now(),
          ...(thoughts ? { thoughts } : {})
        };
        setMessages(prev => {
          const updated = [...prev, assistantMsg];
          setConversations(convs => convs.map(c => c.id === activeConvId ? { ...c, messages: updated } : c));
          return updated;
        });
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return;
      }
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Error: ${error?.message || String(error)}. Ensure Ollama is running on http://localhost:11434`,
        timestamp: Date.now()
      }]);
    } finally {
      if (activeRequestControllerRef.current === requestController) {
        activeRequestControllerRef.current = null;
      }
      setIsLoading(false);
      setIsAborting(false);
    }
  };

  const runTool = (action: 'encode' | 'decode' | 'process') => {
    let result = '';
    switch (activeTool) {
      case 'base64':
        result = action === 'encode' ? tools.base64.encode(toolInput) : tools.base64.decode(toolInput);
        break;
      case 'hex':
        result = action === 'encode' ? tools.hex.encode(toolInput) : tools.hex.decode(toolInput);
        break;
      case 'rot13':
        result = tools.rot13(toolInput);
        break;
      case 'url':
        result = action === 'encode' ? tools.url.encode(toolInput) : tools.url.decode(toolInput);
        break;
    }
    setToolOutput(result);
  };

  const promptTemplates = [
    { label: "代码审计", prompt: "分析这段代码的漏洞（缓冲区溢出、SQL注入、XSS）：\n" },
    { label: "反编译帮助", prompt: "我有一个反编译的 C 函数。请解释它的作用：\n" },
    { label: "密码学提示", prompt: "我有一个看起来像 base64 但解码后是乱码的字符串。我还应该检查哪些常见的 CTF 编码？" },
    { label: "Linux 提权", prompt: "列出 CTF 中常见的 Linux 提权技术。" },
    { label: "抓包分析", prompt: "这是一段截获的数据包内容，试图分析一下攻击者意图。" }
  ];

  const groupConversationByTime = (timestamp: number) => {
    const now = new Date();
    const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(timestamp);
    const targetDate = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const dayDiff = Math.floor((currentDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

    if (dayDiff === 0) return '今天';
    if (dayDiff === 1) return '昨天';
    if (dayDiff <= 30) return '30 天内';
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
  };

  const groupedConversations = useMemo(() => {
    const sections = new Map<string, Conversation[]>();
    for (const conv of conversations) {
      const lastTimestamp = conv.messages[conv.messages.length - 1]?.timestamp ?? Date.now();
      const section = groupConversationByTime(lastTimestamp);
      const existing = sections.get(section) || [];
      existing.push(conv);
      sections.set(section, existing);
    }
    return Array.from(sections.entries());
  }, [conversations]);

  const activeConversation = conversations.find(c => c.id === activeConvId);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-mono selection:bg-gray-700 selection:text-white flex flex-col md:flex-row overflow-hidden">
      <MatrixBackground />
      
      {/* Sidebar */}
      <div className="w-full md:w-72 border-b md:border-r border-green-900/30 bg-[#050505]/90 backdrop-blur-sm z-10 flex flex-col">
        <div className="p-4 border-b border-green-900/30 flex items-center gap-2">
          <Shield className="w-6 h-6" />
          <h1 className="font-bold text-lg tracking-tighter">CTF Pilot</h1>
        </div>

        <div className="p-3 border-b border-green-900/30">
          <button 
            onClick={createConversation}
            className={cn(
              "w-full h-9 flex items-center justify-center gap-2 px-3 rounded-full border text-sm transition-colors focus:outline-none focus-visible:ring-0",
              "border-gray-600/60 bg-gray-200/20 text-white hover:bg-gray-200/30"
            )}
          >
            <Plus className="w-4 h-4" />
            <span>开启新对话</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {groupedConversations.map(([section, sectionConversations]) => (
            <div key={section} className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">{section}</p>
              <div className="space-y-1.5">
                {sectionConversations.map((conv) => {
                  // Skip welcome message for preview
                  const userMessage = conv.messages.find(m => m.role === 'user')?.content;
                  const nonWelcomeMessage = conv.messages.find(m => 
                    m.role === 'assistant' && 
                    !m.content.includes('CTF 解题助手')
                  )?.content;
                  const previewMessage = userMessage || nonWelcomeMessage || '暂无消息';
                  return (
                    <button
                      key={conv.id}
                      onClick={() => selectConversation(conv.id)}
                      className={cn(
                        "w-full text-left rounded-lg border px-3 py-2 transition-colors",
                        activeConvId === conv.id
                          ? "border-gray-600 bg-gray-800/35 text-white"
                          : "border-transparent text-gray-300 hover:border-gray-700/60 hover:bg-gray-800/20"
                      )}
                    >
                      <div className="truncate text-sm font-medium">{conv.name}</div>
                      <div className="mt-1 truncate text-xs text-gray-400">{previewMessage}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-2 border-t border-green-900/30 grid grid-cols-3 gap-1">
          <button
            onClick={() => setActiveTab('chat')}
            className={cn(
              "h-9 flex items-center justify-center gap-1.5 rounded-md border text-xs transition-colors",
              activeTab === 'chat' ? "bg-gray-800/25 text-white border-gray-700/60" : "border-transparent text-gray-400 hover:bg-gray-800/15"
            )}
          >
            <Terminal className="w-3.5 h-3.5" />聊天
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={cn(
              "h-9 flex items-center justify-center gap-1.5 rounded-md border text-xs transition-colors",
              activeTab === 'tools' ? "bg-gray-800/25 text-white border-gray-700/60" : "border-transparent text-gray-400 hover:bg-gray-800/15"
            )}
          >
            <Cpu className="w-3.5 h-3.5" />工具
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={cn(
              "h-9 flex items-center justify-center gap-1.5 rounded-md border text-xs transition-colors",
              activeTab === 'notes' ? "bg-gray-800/25 text-white border-gray-700/60" : "border-transparent text-gray-400 hover:bg-gray-800/15"
            )}
          >
            <Code className="w-3.5 h-3.5" />日志
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10 h-[calc(100vh-64px)] md:h-screen">
        <div className="h-14 border-b border-green-900/30 bg-[#050505]/90 backdrop-blur px-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-white truncate">{activeConversation?.name || '未选择会话'}</div>
            <div className="text-[11px] text-gray-500">{activeTab === 'chat' ? '解题问答' : activeTab === 'tools' ? '网络工具' : '任务日志'}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadOllamaModels}
              disabled={modelsLoading}
              className="h-8 px-2.5 rounded border border-gray-800/50 text-xs text-gray-300 hover:text-white hover:border-gray-600 disabled:opacity-50"
            >
              {modelsLoading ? '刷新中...' : '刷新模型'}
            </button>

            {modelInputMode === 'select' ? (
              <select
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                disabled={modelsLoading || availableModels.length === 0}
                className="h-8 max-w-44 bg-black border border-gray-800/50 rounded px-2 text-xs text-white focus:outline-none focus:border-gray-500 disabled:opacity-60"
              >
                {availableModels.map((modelName) => (
                  <option key={modelName} value={modelName}>{modelName}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="h-8 w-40 bg-black border border-gray-800/50 rounded px-2 text-xs text-white focus:outline-none focus:border-gray-500"
                placeholder="例如：qwen3:8b"
              />
            )}

            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setModelInputMode('select')}
                disabled={!availableModels.length}
                className={cn(
                  'h-8 px-2 rounded border text-[11px] transition-colors',
                  modelInputMode === 'select'
                    ? 'border-gray-600 bg-gray-800/30 text-white'
                    : 'border-gray-800/50 text-gray-300 hover:border-gray-600 hover:text-white',
                  !availableModels.length ? 'opacity-50 cursor-not-allowed' : ''
                )}
              >
                列表
              </button>
              <button
                type="button"
                onClick={() => setModelInputMode('manual')}
                className={cn(
                  'h-8 px-2 rounded border text-[11px] transition-colors',
                  modelInputMode === 'manual'
                    ? 'border-gray-600 bg-gray-800/30 text-white'
                    : 'border-gray-800/50 text-gray-300 hover:border-gray-600 hover:text-white'
                )}
              >
                手动
              </button>
            </div>

            <div className="text-[10px] text-gray-500 leading-tight">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'inline-block h-2 w-2 rounded-full',
                    isLoading ? 'bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]' : 'bg-gray-600'
                  )}
                />
                <span>{isLoading ? '运行中' : '待机'}</span>
              </div>
            </div>
          </div>
        </div>
        {activeTab === 'chat' && (
          <>
            {/* Chat Area */}
            <div className="p-4 border-b border-green-900/30 flex items-center justify-between space-x-2">
              <div className="flex items-center gap-2">
                <label className="text-xs opacity-50">当前会话：</label>
                <span className="text-sm text-white">{activeConversation?.name || '未选择'}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={deleteCurrentConversation}
                  disabled={isLoading || isAborting}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-700/40 bg-red-900/10 px-3 text-xs text-red-200 transition-colors hover:border-red-500/70 hover:bg-red-900/25 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>删除当前</span>
                </button>
                <button
                  onClick={clearConversationHistory}
                  disabled={isLoading || isAborting}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-700/40 bg-red-900/10 px-3 text-xs text-red-200 transition-colors hover:border-red-500/70 hover:bg-red-900/25 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>清空记录</span>
                </button>
                <button
                  onClick={createConversation}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-700/50 bg-black/40 px-3 text-xs text-gray-200 transition-colors hover:border-gray-500/70 hover:bg-gray-800/30 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>新建对话</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-green-900 scrollbar-track-transparent">
              {messages.map((msg, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={idx} 
                  className={cn(
                    "flex flex-col max-w-3xl",
                    msg.role === 'user'
                      ? "ml-auto items-end"
                      : msg.role === 'system'
                      ? "mx-auto items-center"
                      : "mr-auto items-start"
                  )}
                >
                  <div className={cn(
                    "px-4 py-2 rounded-lg border text-sm md:text-base whitespace-pre-wrap",
                    msg.role === 'user' 
                      ? "bg-gray-800/20 border-gray-500/30 text-white" 
                      : msg.role === 'system'
                      ? "bg-red-900/10 border-red-500/30 text-red-400 font-bold text-xs w-full text-center"
                      : "bg-black/50 border-gray-800/30 text-white"
                  )}>
                    {msg.thoughts && (
                      <div className="mb-2 text-xs text-gray-300/80 leading-relaxed">
                        思考过程：
                        <pre className="whitespace-pre-wrap">{msg.thoughts}</pre>
                      </div>
                    )}
                    {msg.content}
                  </div>
                  {msg.role !== 'system' && (
                    <span className="text-[10px] opacity-30 mt-1 uppercase">{msg.role} // {new Date(msg.timestamp).toLocaleTimeString()}</span>
                  )}
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-white animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-xs">推理模型正在运行...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-green-900/30 bg-[#050505]/90 backdrop-blur space-y-3">
              {/* Quick Prompts */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {promptTemplates.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(t.prompt)}
                    className="whitespace-nowrap h-8 px-3 border border-gray-700/40 rounded-md text-xs text-gray-300 hover:bg-gray-800/20 hover:text-white transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="max-w-3xl mx-auto flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
                  placeholder="输入指令或查询..."
                  className="flex-1 bg-black/50 border border-gray-800/50 rounded-md px-4 py-2 text-white focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/50 placeholder:text-gray-400"
                />
                <button 
                  onClick={() => handleSend(input)}
                  disabled={isLoading}
                  className="h-10 w-10 flex items-center justify-center bg-gray-800/20 hover:bg-gray-800/40 border border-gray-500/30 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
                <button
                  onClick={handleAbort}
                  disabled={!isLoading && !isAborting}
                  className="h-10 w-10 flex items-center justify-center bg-red-900/20 hover:bg-red-900/35 border border-red-500/30 text-red-200 rounded-md transition-colors disabled:opacity-40"
                  title="终止当前模型响应"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'tools' && (
          /* Tools Area */
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Cpu className="w-5 h-5" />
                密码学套件
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {(['base64', 'hex', 'rot13', 'url'] as ToolType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTool(t)}
                    className={cn(
                      "p-3 border rounded-md text-sm uppercase tracking-wider transition-all",
                      activeTool === t 
                        ? "bg-gray-800/30 border-gray-500 text-white shadow-[0_0_15px_rgba(200,200,200,0.2)]" 
                        : "border-gray-800/30 text-gray-300 hover:border-gray-600 hover:text-gray-500"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="bg-black/40 border border-green-900/30 rounded-lg p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs uppercase opacity-50">输入数据</label>
                  <textarea 
                    value={toolInput}
                    onChange={(e) => setToolInput(e.target.value)}
                    className="w-full h-32 bg-black/50 border border-gray-800/50 rounded p-3 text-sm font-mono text-white focus:outline-none focus:border-gray-500"
                    placeholder="在此粘贴编码字符串或原始文本..."
                  />
                </div>

                <div className="flex gap-4">
                  {activeTool !== 'rot13' ? (
                    <>
                      <button 
                        onClick={() => runTool('encode')}
                        className="flex-1 bg-green-900/20 hover:bg-green-900/30 border border-green-500/30 py-2 rounded text-sm uppercase tracking-widest transition-all"
                      >
                        编码
                      </button>
                      <button 
                        onClick={() => runTool('decode')}
                        className="flex-1 bg-green-900/20 hover:bg-green-900/30 border border-green-500/30 py-2 rounded text-sm uppercase tracking-widest transition-all"
                      >
                        解码
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => runTool('process')}
                      className="flex-1 bg-green-900/20 hover:bg-green-900/30 border border-green-500/30 py-2 rounded text-sm uppercase tracking-widest transition-all"
                    >
                      应用 ROT13
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase opacity-50">输出结果</label>
                  <div className="relative">
                    <textarea 
                      readOnly
                      value={toolOutput}
                      className="w-full h-32 bg-black/80 border border-gray-800/50 rounded p-3 text-sm font-mono text-white focus:outline-none"
                      placeholder="结果将显示在这里..."
                    />
                    <div className="absolute top-2 right-2">
                      <Lock className="w-4 h-4 opacity-20" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto h-full flex flex-col">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Code className="w-5 h-5" />
                任务日志
              </h2>
              <div className="flex-1 bg-black/40 border border-green-900/30 rounded-lg p-1">
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-full bg-transparent p-4 text-white font-mono focus:outline-none resize-none"
                  placeholder="在此输入任务笔记..."
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
