# CTF Assistant（Ollama 本地版）

这是一套可本地运行的 CTF 助手：
- 前端：React
- 后端：Express（同进程启动）
- 模型：通过本机 Ollama 调用

目标：**新人拿到代码后，按本文步骤可直接跑通并能正常对话**。

---

## 1. 你需要准备什么

### 1) Node.js（必需）
- 建议 `Node.js 20+`
- 检查：

```bash
node -v
npm -v
```

### 2) Ollama（必需）
- 需要本机安装并运行 Ollama
- 默认地址：`http://localhost:11434`
- 检查：

```bash
ollama --version
ollama list
```

### 3) 至少一个模型（必需）
如果还没有模型，先拉一个：

```bash
ollama pull qwen3:8b
```

---

## 2. 第一次启动（一步一步）

在项目根目录执行：

### 第 1 步：安装依赖

```bash
npm install
```

### 第 2 步：启动服务

```bash
npm run dev
```

### 第 3 步：打开浏览器

访问：

```text
http://localhost:3000
```

启动成功后，你会看到聊天界面和默认欢迎消息。

---

## 3. 首次使用怎么确认“真的跑通”

按下面检查：

1. 左侧模型区域能看到模型列表（来自 Ollama 已安装模型）
2. 发送一条测试消息（比如“你好”）
3. 看到模型开始回复（流式输出）
4. 侧边状态灯显示“模型: 运行中”，结束后回到“待机”

如果以上都正常，说明项目跑通。

---

## 4. 模型选择说明（新版）

项目支持两种模型配置方式：

### 方式 A：列表切换（推荐）
- 自动读取本机 Ollama 已安装模型
- 下拉框直接切换
- 支持“刷新”重新读取模型列表

### 方式 B：手动输入（兜底）
- 当列表读取失败或你想填自定义模型名时使用
- 直接输入模型 ID（例如：`qwen3:8b`）

> 模型 ID 与模式都会保存在浏览器本地，刷新页面后会自动恢复。

---

## 5. 聊天相关功能

- 流式输出：回复会逐字出现
- 思考过程显示：如果模型返回 reasoning/thoughts，会显示在回答上方
- 手动终止：发送按钮旁有“停止”按钮，可中断当前模型响应
- 模型运行状态灯：侧边栏显示“运行中 / 待机”

---

## 6. 可选环境变量

默认连接：`http://localhost:11434`

如果你的 Ollama 地址不同，可设置：`OLLAMA_BASE_URL`

PowerShell 示例：

```powershell
$env:OLLAMA_BASE_URL="http://127.0.0.1:11434"
npm run dev
```

---

## 7. 常见问题（按现象排查）

### 问题 1：页面打开了，但提示无法连接 Ollama
检查：
- Ollama 是否在运行
- `11434` 端口是否可访问
- `OLLAMA_BASE_URL` 是否配置正确

快速验证：

```bash
ollama list
```

### 问题 2：模型列表为空
可能原因：
- 还没拉取任何模型
- Ollama 未启动

先拉模型再刷新列表：

```bash
ollama pull qwen3:8b
ollama list
```

### 问题 3：能发消息，但模型不回
检查：
- 左侧选择的模型是否真实存在
- 浏览器开发者工具 Network 中 `/api/ollama/chat` 是否报错
- 终端 `npm run dev` 日志是否有错误

### 问题 4：需要强制停止当前回答
点击输入框右侧的“停止”按钮（方形图标）即可。

---

## 8. 项目脚本

```bash
npm run dev      # 启动开发服务（Express + Vite 中间件）
npm run build    # 打包前端
npm run preview  # 预览打包结果
npm run lint     # TypeScript 类型检查
```

---

## 9. 给新人最短路径（30 秒版）

```bash
# 1) 准备模型（首次）
ollama pull qwen3:8b

# 2) 安装依赖
npm install

# 3) 启动
npm run dev
```

浏览器打开 `http://localhost:3000`，发一句“你好”，看到流式回复即成功。
