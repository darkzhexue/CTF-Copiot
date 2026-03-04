# CTF Pilot（Ollama 本地版）

本项目是一个可本地运行的 CTF 助手，前后端同端口提供服务：`http://localhost:3000`。

支持能力：
- 本机 Ollama 对话（流式返回）
- 本地模型列表读取与切换
- 手动中断当前生成
- Windows 一键安装 / 启动 / 停止 / 打包（4 个 bat）

---

## 目录

- [1. 先看这个：四个 bat 怎么用](#1-先看这个四个-bat-怎么用)
- [2. 项目怎么跑起来（开发模式）](#2-项目怎么跑起来开发模式)
- [3. 怎么重新打包（生成 exe）](#3-怎么重新打包生成-exe)
- [4. 给最终用户的运行方式（不改代码）](#4-给最终用户的运行方式不改代码)
- [5. 环境要求](#5-环境要求)
- [6. 常用 npm 脚本](#6-常用-npm-脚本)
- [7. 目录结构](#7-目录结构)
- [8. 常见问题排查](#8-常见问题排查)

---

## 1. 先看这个：四个 bat 怎么用

项目根目录包含 4 个 Windows 批处理脚本：

### 1) `first-install.bat`（首次安装 + 启动）

用途：给新环境第一次用时准备依赖并启动开发服务。

执行后会做：
1. 检测 `node` / `npm` 是否存在
2. 如果没有 `node_modules`，自动执行 `npm install`
3. 调用 `start-server.bat` 启动开发服务

适用场景：你刚拉下项目，准备第一次跑源码。

---

### 2) `start-server.bat`（启动开发服务）

用途：快速启动开发模式，并自动打开浏览器。

执行后会做：
1. 新开 PowerShell 窗口
2. 运行 `npm run dev`
3. 自动打开 `http://localhost:3000`

适用场景：依赖已安装，日常开发启动。

---

### 3) `stop-server.bat`（停止开发服务）

用途：停止占用 `3000` 端口的服务进程。

执行后会做：
1. 查找本机监听 3000 端口的进程
2. 强制停止对应 PID

适用场景：服务未正常退出、端口被占用时。

---

### 4) `pack-exe.bat`（一键重新打包）

用途：一键构建发布包（`exe + dist`），带完整回显。

执行后会做：
1. 检测 `node` / `npm`
2. 自动安装依赖（缺失时）
3. 执行 `npm run pack:exe`
4. 校验 `release/CTF Pilot.exe` 与 `release/dist/`

适用场景：你要给别人发可执行版本，或重新发布新版本。

---

## 2. 项目怎么跑起来（开发模式）

### 方案 A（推荐，最省事）

1. 双击 `first-install.bat`
2. 等待安装和启动完成
3. 浏览器打开后访问：`http://localhost:3000`

### 方案 B（手动命令行）

```bash
npm install
npm run dev
```

然后访问：`http://localhost:3000`

### 关闭服务

- 双击 `stop-server.bat`

---

## 3. 怎么重新打包（生成 exe）

### 方式 A（推荐）

直接双击：`pack-exe.bat`

或在终端执行：

```bash
pack-exe.bat
```

### 方式 B（npm 命令）

```bash
npm run pack:exe
```

### 成功后产物

- `release/CTF Pilot.exe`
- `release/dist/`

> 注意：`CTF Pilot.exe` 和 `dist` 必须保持同级目录。

---

## 4. 给最终用户的运行方式（不改代码）

适合普通使用者（不需要 Node.js）：

1. 确保已安装并运行 Ollama
2. 确保至少有一个本地模型（例如 `qwen3:8b`）
3. 进入 `release/` 目录，双击 `CTF Pilot.exe`
4. 打开 `http://localhost:3000`

---

## 5. 环境要求

### 必需（开发和已打包版都需要）

1) **Ollama 已安装并运行**

```bash
ollama --version
ollama list
```

2) **至少一个本地模型**

```bash
ollama pull qwen3:8b
```

### 仅源码开发/打包需要

1) **Node.js 20+**

```bash
node -v
npm -v
```

---

## 6. 常用 npm 脚本

```bash
npm run dev               # 开发模式：Express + Vite 中间件
npm run build             # 打包前端到 dist
npm run preview           # 预览前端打包产物
npm run lint              # TypeScript 类型检查
npm run build:server:exe  # 打包 server.ts 到 build/server.cjs
npm run copy:dist:exe     # 复制 dist 到 release/dist
npm run pack:exe          # 一键生成 exe 发布包
```

---

## 7. 目录结构

```text
.
├─ server.ts
├─ src/
├─ dist/                  # 前端构建产物
├─ build/server.cjs       # 服务端打包产物
├─ release/
│  ├─ CTF Pilot.exe
│  └─ dist/
├─ first-install.bat      # 首次安装并启动开发服务
├─ start-server.bat       # 启动开发服务
├─ stop-server.bat        # 停止 3000 端口服务
└─ pack-exe.bat           # 一键打包发布
```

---

## 8. 常见问题排查

### 1) 页面提示连接 Ollama 失败

检查：
- Ollama 是否启动
- `OLLAMA_BASE_URL` 是否正确（默认 `http://localhost:11434`）

快速验证：

```bash
ollama list
```

---

### 2) 模型列表为空

处理：

```bash
ollama pull qwen3:8b
ollama list
```

---

### 3) 双击 bat 没反应 / 一闪而过

建议：
- 用“以管理员身份运行”重试
- 在 PowerShell 里手动执行脚本查看输出
- 检查是否被安全软件拦截

---

### 4) `exe` 能启动但页面空白

检查：
- `release/CTF Pilot.exe` 和 `release/dist/` 是否同级
- `release/dist/index.html` 是否存在


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