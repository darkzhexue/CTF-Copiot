# CTF Assistant (Ollama 本地版)

这个项目是一个基于 React + Express 的本地 CTF 助手前端，默认通过后端代理调用本机 Ollama（`/api/ollama/chat`）。

## 运行前需要准备

1. Node.js
- 建议 Node.js 20+
- 检查版本：

```bash
node -v
npm -v
```

2. Ollama
- 需要本机安装并运行 Ollama
- 默认地址：`http://localhost:11434`
- 检查是否可用：

```bash
ollama --version
ollama list
```

3. 至少一个可用模型
- 示例（和项目默认值一致）：

```bash
ollama pull qwen3:8b
```

## 启动步骤

1. 安装依赖

```bash
npm install
```

2. 启动项目（前后端同进程）

```bash
npm run dev
```

3. 浏览器打开
- `http://localhost:3000`

## 环境变量（可选）

默认会连 `http://localhost:11434`。如果你的 Ollama 不是这个地址，可设置 `OLLAMA_BASE_URL`。

PowerShell 示例：

```powershell
$env:OLLAMA_BASE_URL="http://127.0.0.1:11434"
npm run dev
```

## 主要功能开关

在左侧栏可设置：
- `模型 ID`：如 `qwen3:8b`
- `Reasoning`：显示模型推理内容（如果模型返回）
- `Streaming`：流式输出（逐步显示回答）

## 常见问题

1. 提示无法连接 Ollama
- 确认 Ollama 进程在运行
- 确认端口 `11434` 可访问
- 确认 `OLLAMA_BASE_URL` 配置正确

2. 模型不存在
- 先拉取模型：

```bash
ollama pull qwen3:8b
```

3. 前端能打开但回复为空/异常
- 打开浏览器开发者工具看网络请求 `/api/ollama/chat`
- 终端查看 `npm run dev` 输出错误信息

## 可用脚本

```bash
npm run dev      # 启动开发服务（server.ts + Vite 中间件）
npm run build    # 打包前端
npm run preview  # 预览打包结果
npm run lint     # TypeScript 类型检查
```
