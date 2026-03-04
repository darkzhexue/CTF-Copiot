# CTF Pilot（Ollama 本地版）

一个可本地运行的 CTF 助手，支持：
- 本机 Ollama 模型对话（流式返回）
- 模型列表读取与切换
- 手动中断当前生成
- 前后端同端口（`http://localhost:3000`）

---

## 目录

- [1. 运行方式总览](#1-运行方式总览)
- [2. 环境与依赖要求](#2-环境与依赖要求)
- [3. 已打包版本使用教程（给最终用户）](#3-已打包版本使用教程给最终用户)
- [4. 源码开发教程（给开发者）](#4-源码开发教程给开发者)
- [5. 打包发布教程（生成 exe）](#5-打包发布教程生成-exe)
- [6. 项目脚本说明](#6-项目脚本说明)
- [7. 目录结构说明](#7-目录结构说明)
- [8. 常见问题排查](#8-常见问题排查)

---

## 1. 运行方式总览

本项目有两种使用方式：

1. **已打包版（推荐给普通使用者）**
   - 直接使用 `release/CTF Pilot.exe`
   - 不需要 Node.js
   - 仍然需要本机 Ollama + 模型

2. **源码开发版（推荐给开发者）**
   - 使用 `npm run dev` 运行 Express + Vite
   - 支持前端/后端联调与代码修改

---

## 2. 环境与依赖要求

### 必需

1) **Ollama（必须安装并运行）**
- 默认地址：`http://localhost:11434`
- 检查命令：

```bash
ollama --version
ollama list
```

2) **至少一个模型（必须）**
- 示例：

```bash
ollama pull qwen3:8b
```

### 仅源码开发需要

1) **Node.js 20+**
- 检查命令：

```bash
node -v
npm -v
```

2) **npm 依赖（项目内）**
- 首次开发前安装：

```bash
npm install
```

> 说明：项目依赖已在 `package.json` 中声明，包含 React、Vite、Express、TypeScript、axios、tailwind 等。

---

## 3. 已打包版本使用教程（给最终用户）

适合“不改代码，只要能用”的场景。

### 第 1 步：准备 Ollama 和模型

```bash
ollama list
```

如果为空，先拉模型：

```bash
ollama pull qwen3:8b
```

### 第 2 步：进入发布目录并启动

- 确保目录中存在：
   - `release/CTF Pilot.exe`
  - `release/dist/`（前端静态文件）

- 双击运行 `CTF Pilot.exe`，或在终端执行：

```bash
cd release
./CTF Pilot.exe
```

启动后访问：

```text
http://localhost:3000
```

### 第 3 步：验证是否可用

1. 模型下拉框可看到本地模型
2. 发送“你好”后出现流式回复
3. 可通过“停止”按钮中断当前回答

---

## 4. 源码开发教程（给开发者）

### 第 1 步：安装依赖

在项目根目录执行：

```bash
npm install
```

### 第 2 步：启动开发服务

```bash
npm run dev
```

服务地址：

```text
http://localhost:3000
```

开发模式下：
- 后端：`server.ts`（Express）
- 前端：Vite 中间件挂载到同一服务

### Windows 快速启动（可选）

- 双击 `start-server.bat` 启动并自动打开浏览器
- 双击 `stop-server.bat` 按端口 `3000` 停止服务

### 可选环境变量

默认 Ollama 地址为 `http://localhost:11434`。

若 Ollama 不在默认地址，设置：`OLLAMA_BASE_URL`

PowerShell 示例：

```powershell
$env:OLLAMA_BASE_URL="http://127.0.0.1:11434"
npm run dev
```

---

## 5. 打包发布教程（生成 exe）

### 一键打包

```bash
npm run pack:exe
```

该命令会依次执行：
1. `npm run build`：打包前端到 `dist/`
2. `npm run build:server:exe`：将 `server.ts` 打包为 `build/server.cjs`
3. `pkg ...`：生成 `release/CTF Pilot.exe`
4. `npm run copy:dist:exe`：复制 `dist/` 到 `release/dist/`

### 发布产物

- `release/CTF Pilot.exe`
- `release/dist/`

> 两者需保持同级目录，exe 才能正确提供前端页面。

---

## 6. 项目脚本说明

```bash
npm run dev            # 开发模式：启动 Express + Vite 中间件
npm run build          # 打包前端到 dist
npm run preview        # 预览前端打包产物（Vite）
npm run lint           # TypeScript 类型检查（tsc --noEmit）
npm run build:server:exe  # 打包 server.ts 为 build/server.cjs
npm run copy:dist:exe     # 复制 dist 到 release/dist
npm run pack:exe          # 一键生成 exe 发布包
```

---

## 7. 目录结构说明

```text
.
├─ server.ts                 # Express 服务入口（API + 静态资源）
├─ src/                      # React 前端源码
├─ dist/                     # 前端打包产物（build 后生成）
├─ build/server.cjs          # 服务端打包文件（build:server:exe 后生成）
├─ release/                  # 发布目录
│  ├─ CTF Pilot.exe
│  └─ dist/
├─ start-server.bat          # Windows 开发启动脚本
└─ stop-server.bat           # Windows 停止脚本（按端口 3000）
```

---

## 8. 常见问题排查

### 1) 页面能打开，但提示连接 Ollama 失败

检查：
- Ollama 是否运行
- `OLLAMA_BASE_URL` 是否正确
- `http://localhost:11434` 是否可访问

快速验证：

```bash
ollama list
```

### 2) 模型列表为空

常见原因：
- 本机未安装任何模型
- Ollama 未启动

处理：

```bash
ollama pull qwen3:8b
ollama list
```

### 3) 可以发送消息，但模型不回复

检查：
- 选中的模型名是否真实存在
- 开发模式终端日志是否有报错
- 浏览器 Network 中 `/api/ollama/chat` 是否返回 5xx

### 4) exe 能启动但页面空白

检查 `release/dist/` 是否与 `release/CTF Pilot.exe` 同级存在。

---

## 快速开始（30 秒）

### 普通用户（已打包版）

```bash
ollama pull qwen3:8b
cd release
./CTF Pilot.exe
```

浏览器访问 `http://localhost:3000`。

### 开发者（源码版）

```bash
ollama pull qwen3:8b
npm install
npm run dev
```

浏览器访问 `http://localhost:3000`。