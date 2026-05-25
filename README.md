# ChatGPT Plus Status Reporter

一个独立的 Chrome MV3 扩展，用来检测当前已登录 ChatGPT / OpenAI 页面的 Plus 状态，并在本地导出 JSON 报告。

这个公开版本不会导出 `access_token`、cookie、session token 或验证码，也不会自动读取邮箱验证码。

## 使用方法

1. 打开 Chrome 扩展管理页：`chrome://extensions/`
2. 开启开发者模式。
3. 选择“加载已解压的扩展”，目录选本项目根目录。
4. 打开并登录 `https://chatgpt.com/`。
5. 点击扩展图标，点击“检测并下载”。
6. 扩展会读取当前页面可见的登录状态，生成本地 JSON 报告。

## 批量流程

1. 在“批量账号”里粘贴账号，每行一个邮箱。
2. 点击“载入队列”。
3. 点击“打开登录”，手动完成当前账号登录。
4. 登录成功后点击“检测并下载”。
5. 点击“加入批量结果”，再处理下一个账号。
6. 全部完成后点击“下载批量 JSON”。

## 导出格式

导出的文件结构示例：

```json
{
  "exported_at": "2026-05-25T00:00:00.000Z",
  "report_type": "chatgpt_plus_status",
  "contains_credentials": false,
  "accounts": [
    {
      "email": "user@example.com",
      "name": "user@example.com",
      "platform": "openai",
      "logged_in": true,
      "plus_detected": true,
      "plan_type": "plus",
      "chatgpt_account_id": "...",
      "chatgpt_user_id": "...",
      "session_expires_at": "2026-05-25T01:00:00.000Z",
      "group_names": ["codex"],
      "checked_at": "2026-05-25T00:00:00.000Z"
    }
  ]
}
```

## 数据来源

扩展只在当前 ChatGPT / OpenAI 标签页执行：

```js
fetch('/api/auth/session', { credentials: 'include' })
```

脚本会在页面上下文中解析必要状态，但不会把 `accessToken` 写入导出 JSON。所有 JSON 都在浏览器本地生成，不会自动上传到任何服务器。
