import React, { useState, useEffect, useRef } from 'react';
import { Send, Terminal, Settings, Shield, Cpu, Code, Lock, RefreshCw, AlertCircle } from 'lucide-react';
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

  // Conversation management
  type Conversation = {
    id: string;
    name: string;
    messages: Message[];
  };

  const defaultConv: Conversation = {
    id: 'default',
    name: '默认会话',
    messages: [{ role: 'system', content: 'CTF 助手已初始化成功', timestamp: Date.now() }]
  };

  const [conversations, setConversations] = useState<Conversation[]>([defaultConv]);
  const [activeConvId, setActiveConvId] = useState<string>(defaultConv.id);
  const [messages, setMessages] = useState<Message[]>(defaultConv.messages);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaModel, setOllamaModel] = useState('qwen3:8b');
  const messagesEndRef = useRef<HTMLDivElement>(null);
 
  // 思考模式开关（是否请求模型输出带有思考链）
  const [enableThoughts, setEnableThoughts] = useState(false);
  const [enableStreaming, setEnableStreaming] = useState(true);
  // Tool State
  const [toolInput, setToolInput] = useState('');
  const [toolOutput, setToolOutput] = useState('');
  const [activeTool, setActiveTool] = useState<ToolType>('base64');

  // Notes State
  const [notes, setNotes] = useState<string>('# CTF 作战笔记\n\n- 目标 IP: \n- 发现端口: \n- Flag: \n');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // load/save conversations
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ctf_conversations');
      if (saved) {
        const parsed: Conversation[] = JSON.parse(saved);
        if (parsed.length) {
          setConversations(parsed);
          setActiveConvId(parsed[0].id);
          setMessages(parsed[0].messages);
        }
      }
    } catch {}
  }, []);

  // 加载思考模式设置
  useEffect(() => {
    try {
      const s = localStorage.getItem('ctf_enable_thoughts');
      if (s) setEnableThoughts(s === 'true');
      const stream = localStorage.getItem('ctf_enable_streaming');
      if (stream) setEnableStreaming(stream === 'true');
    } catch {}
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // whenever conversations change, persist
    localStorage.setItem('ctf_conversations', JSON.stringify(conversations));
  }, [conversations]);

  // 持久化思考模式设置
  useEffect(() => {
    try {
      localStorage.setItem('ctf_enable_thoughts', enableThoughts.toString());
    } catch {}
  }, [enableThoughts]);

  useEffect(() => {
    try {
      localStorage.setItem('ctf_enable_streaming', enableStreaming.toString());
    } catch {}
  }, [enableStreaming]);

  useEffect(() => {
    // when active conversation changes, update displayed messages
    const conv = conversations.find(c => c.id === activeConvId);
    if (conv) {
      setMessages(conv.messages);
    }
  }, [activeConvId, conversations]);

  const createConversation = () => {
    const name = window.prompt('请输入对话名称', '新会话');
    const id = Date.now().toString();
    const conv: Conversation = {
      id,
      name: name || '未命名',
      messages: [{ role: 'system', content: 'CTF 助手', timestamp: Date.now() }]
    };
    setConversations(prev => [conv, ...prev]);
    setActiveConvId(id);
  };

  const selectConversation = (id: string) => {
    setActiveConvId(id);
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
          body: JSON.stringify(payload)
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
          body: JSON.stringify(payload)
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
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Error: ${error?.message || String(error)}. Ensure Ollama is running on http://localhost:11434`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
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

  return (
    <div className="min-h-screen bg-gray-900 text-white font-mono selection:bg-gray-700 selection:text-white flex flex-col md:flex-row overflow-hidden">
      <MatrixBackground />
      
      {/* Sidebar */}
      <div className="w-full md:w-64 border-b md:border-r border-green-900/30 bg-[#050505]/90 backdrop-blur-sm z-10 flex flex-col">
        <div className="p-4 border-b border-green-900/30 flex items-center gap-2">
          <Shield className="w-6 h-6" />
          <h1 className="font-bold text-lg tracking-tighter">CTF_助手</h1>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          <button 
            onClick={() => setActiveTab('chat')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm",
              activeTab === 'chat' ? "bg-gray-800/20 text-white border border-gray-800/50" : "hover:bg-gray-800/10 text-gray-300"
            )}
          >
            <Terminal className="w-4 h-4" />
            <span>作战聊天</span>
          </button>
          <button 
            onClick={() => setActiveTab('tools')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm",
              activeTab === 'tools' ? "bg-gray-800/20 text-white border border-gray-800/50" : "hover:bg-gray-800/10 text-gray-300"
            )}
          >
            <Cpu className="w-4 h-4" />
            <span>网络工具</span>
          </button>
          <button 
            onClick={() => setActiveTab('notes')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm",
              activeTab === 'notes' ? "bg-gray-800/20 text-white border border-gray-800/50" : "hover:bg-gray-800/10 text-gray-300"
            )}
          >
            <Code className="w-4 h-4" />
            <span>任务日志</span>
          </button>
        </nav>

        <div className="p-4 border-t border-green-900/30 space-y-4">
          <div className="space-y-2">
            <label className="text-xs uppercase opacity-50 font-bold">模型 ID</label>
            <input 
              type="text" 
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              className="w-full bg-black border border-gray-800/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-gray-500"
              placeholder="qwen3:8b"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs uppercase opacity-50 font-bold">思考模式</label>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-gray-300">启用</p>
              <input
                type="checkbox"
                checked={enableThoughts}
                onChange={(e) => setEnableThoughts(e.target.checked)}
                className="h-4 w-4"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase opacity-50 font-bold">Streaming</label>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-gray-300">Enable token stream</p>
              <input
                type="checkbox"
                checked={enableStreaming}
                onChange={(e) => setEnableStreaming(e.target.checked)}
                className="h-4 w-4"
              />
            </div>
          </div>
          <div className="text-[10px] text-gray-600 leading-tight">
            状态: 本地连接 <br/>
            安全: 是
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10 h-[calc(100vh-64px)] md:h-screen">
        {activeTab === 'chat' && (
          <>
            {/* Chat Area */}
            <div className="p-4 border-b border-green-900/30 flex items-center justify-between space-x-2">
              <div className="flex items-center gap-2">
                <label className="text-xs opacity-50">会话：</label>
                <select
                  value={activeConvId}
                  onChange={e => selectConversation(e.target.value)}
                  className="bg-black/50 border border-gray-800/50 rounded px-2 py-1 text-xs text-white focus:outline-none"
                >
                  {conversations.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={createConversation}
                className="text-xs text-white hover:text-gray-300"
              >
                新建对话
              </button>
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
                    {msg.content}
                    {msg.thoughts && (
                      <div className="mt-2 text-xs italic text-gray-300/70">
                        思考过程：
                        <pre className="whitespace-pre-wrap">{msg.thoughts}</pre>
                      </div>
                    )}
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
                    className="whitespace-nowrap px-3 py-1 border border-gray-800/30 rounded-full text-xs text-gray-300 hover:bg-gray-800/20 hover:text-white transition-colors"
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
                  className="flex-1 bg-black/50 border border-gray-800/50 rounded-md px-4 py-2 text-white focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/50 placeholder:text-gray-900"
                />
                <button 
                  onClick={() => handleSend(input)}
                  disabled={isLoading}
                  className="bg-gray-800/20 hover:bg-gray-800/40 border border-gray-500/30 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
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
