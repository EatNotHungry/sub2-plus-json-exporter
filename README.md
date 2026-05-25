# ChatGPT Plus Status Reporter

ChatGPT Plus Status Reporter 是一个独立的 Chrome MV3 扩展，用来检测当前浏览器里已经登录的 ChatGPT / OpenAI 账号状态，并导出一份本地 JSON 报告。

它适合用来整理账号检测结果、记录账号是否登录、识别当前页面能读取到的 Plus / Team / Pro 等套餐状态，以及批量汇总多个账号的检测结果。

## 重要说明

这个公开版本只做“状态检测”和“本地报告导出”：

- 不导出 `access_token`
- 不导出 cookie
- 不导出 session token
- 不读取或保存邮箱验证码
- 不自动登录账号
- 不自动上传数据到任何服务器
- 不生成可直接作为登录凭据使用的 JSON

导出的 JSON 里会写入：

- 邮箱
- 登录状态
- 是否检测到付费套餐
- 套餐类型
- ChatGPT account id
- ChatGPT user id
- 当前网页 session 过期时间
- 检测时间
- 自定义分组名

## 项目作用

这个扩展主要解决几个场景：

1. **当前账号检测**

   打开已经登录的 `chatgpt.com` 页面后，一键检测当前账号状态，并下载 JSON 报告。

2. **Plus 状态记录**

   从当前网页 session 中读取可见账号信息，判断是否出现 `plus`、`team`、`pro`、`enterprise`、`business` 等套餐标识。

3. **批量账号结果汇总**

   你可以导入一批邮箱列表，逐个手动登录并检测，最后导出一个批量 JSON 文件。

4. **本地化数据留档**

   所有 JSON 都在浏览器本地生成，适合作为账号状态巡检记录。

## 安装方法

1. 下载或克隆本项目。

   ```bash
   git clone https://github.com/EatNotHungry/sub2-plus-json-exporter.git
   ```

2. 打开 Chrome 扩展管理页：

   ```text
   chrome://extensions/
   ```

3. 打开右上角“开发者模式”。

4. 点击“加载已解压的扩展”。

5. 选择本项目根目录：

   ```text
   sub2-plus-json-exporter
   ```

6. 扩展加载成功后，浏览器工具栏会出现扩展图标。

## 单账号使用方法

1. 在 Chrome 中打开：

   ```text
   https://chatgpt.com/
   ```

2. 手动登录你的 ChatGPT 账号。

3. 保持当前标签页停留在 ChatGPT / OpenAI 页面。

4. 点击浏览器工具栏里的扩展图标。

5. 不填写“批量账号”。

6. 点击“检测并下载”。

7. 扩展会检测当前页面登录状态，并下载类似下面的文件：

   ```text
   plus-status-user@example.com.json
   ```

## 批量使用方法

1. 点击扩展图标。

2. 在“批量账号”输入框里粘贴邮箱列表，每行一个：

   ```text
   user1@example.com
   user2@example.com
   user3@example.com
   ```

3. 点击“载入队列”。

4. 点击“打开登录”，扩展会打开当前队列账号的 ChatGPT 登录页。

5. 手动完成登录。

6. 登录成功后，回到 ChatGPT 页面，点击“检测并下载”。

7. 点击“加入批量结果”。

8. 继续处理下一个账号。

9. 全部完成后，点击“下载批量 JSON”。

批量文件名示例：

```text
plus-status-batch-3.json
```

## 导出格式

单账号导出示例：

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
      "chatgpt_account_id": "account-id",
      "chatgpt_user_id": "user-id",
      "session_expires_at": "2026-05-25T01:00:00.000Z",
      "group_names": ["codex"],
      "checked_at": "2026-05-25T00:00:00.000Z"
    }
  ]
}
```

## 字段说明

| 字段 | 说明 |
| --- | --- |
| `exported_at` | JSON 文件生成时间 |
| `report_type` | 报告类型，单账号为 `chatgpt_plus_status` |
| `contains_credentials` | 固定为 `false`，表示不包含登录凭据 |
| `email` | 当前账号邮箱 |
| `logged_in` | 是否检测到登录状态 |
| `plus_detected` | 是否检测到付费套餐标识 |
| `plan_type` | 当前页面 session 中读取到的套餐类型 |
| `chatgpt_account_id` | 当前账号 ID |
| `chatgpt_user_id` | 当前用户 ID |
| `session_expires_at` | 当前网页 session 显示的过期时间 |
| `group_names` | 用户在扩展里填写的分组名 |
| `checked_at` | 当前账号检测时间 |

## 数据来源

扩展只在当前 ChatGPT / OpenAI 标签页执行：

```js
fetch('/api/auth/session', { credentials: 'include' })
```

脚本会在页面上下文中解析必要状态，但不会把 `accessToken` 写入导出 JSON。所有 JSON 都在浏览器本地生成，不会自动上传到任何服务器。

## 权限说明

`manifest.json` 中使用的权限：

| 权限 | 用途 |
| --- | --- |
| `activeTab` | 读取当前活动标签页 |
| `scripting` | 在当前 ChatGPT / OpenAI 页面执行检测脚本 |
| `tabs` | 打开登录页和读取当前标签页 URL |
| `downloads` | 下载本地 JSON 报告 |
| `storage` | 保存批量队列和基础设置 |

host permissions 只覆盖：

```text
https://chatgpt.com/*
https://*.chatgpt.com/*
https://chat.openai.com/*
https://*.openai.com/*
```

## 常见问题

### 为什么检测不到 Plus？

可能原因：

- 当前页面没有登录。
- 当前标签页不是 ChatGPT / OpenAI 页面。
- ChatGPT 当前返回的 session 里没有套餐字段。
- OpenAI 页面结构或 session 字段发生变化。

### `session_expires_at` 是账号会员过期时间吗？

不是。它表示当前网页登录 session 的过期时间，不等于 Plus 会员订阅到期时间。

### 这个 JSON 可以导入 SUB2API 当登录凭据用吗？

不可以。这个公开版本不会导出可复用登录凭据，只能作为状态报告。

### 数据会上传吗？

不会。扩展没有后端服务，也不会主动请求第三方服务器。导出的 JSON 在本地生成并下载。

## 开发检查

可以用 Node.js 做基础语法检查：

```bash
node -c popup/exporter.js
node -c popup/popup.js
```

也可以检查 `manifest.json`：

```bash
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')); console.log('manifest ok')"
```
