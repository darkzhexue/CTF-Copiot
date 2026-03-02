<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy the app

This repository contains everything you need to run the app locally.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. (Optional) If your app needs an external API key, set it in an `.env` file.
3. Run the app:
   `npm run dev`

> **Tip:** 在向模型发送请求时，如果希望看到内部思考过程，可以在问题中或系统消息里添加：
> 
> ```text
> 请在回答中使用[[THOUGHTS]]...[[/THOUGHTS]]标签包裹你的思考过程。
> ```
> 
> 前端会自动分离并显示这些思路。
