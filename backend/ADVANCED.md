# TeleWindy Worker 进阶说明

普通用户先看 [手机部署短教程](README.md)。本文保留运行原理、手动部署、内置 Key 和故障排查；手动部署流程使用 `wrangler.toml.example`，部署按钮使用正式的 `wrangler.toml`。

这个目录是 TeleWindy 的 Cloudflare Worker 后端，用来让聊天回复在手机切屏、锁屏、刷新页面后继续生成。

一句话理解：

```text
网页把本次聊天任务交给 Worker
Worker 在后台请求模型 API
网页回来后按 jobId 取回结果
取回后删除 Worker 里的临时结果
```

Worker 主要解决的是“浏览器页面被系统挂起后，请求被杀掉”的问题。它不是一个长期数据库，也不是多人共用的公共代理。推荐每个用户自己部署自己的私人 Worker。

## 主动消息

新版 Worker 在现有 `CHAT_JOB_OBJECT` 中，为“每个浏览器安装实例 × 每个角色”创建一个主动角色对象：

```text
PWA 同步角色设定、最近文字聊天、浏览器时区和主动消息规则
Durable Object Alarm 到点唤醒角色
模型一次返回 decision / content / next_check_in_minutes
Worker 记录实际发送时间并计算下次唤醒；发送结果进入 outbox，PWA 下次打开后按实际发送时间插入聊天时间线
```

浏览器离线补发可额外返回 `sent_at_local`（本地 `YYYY-MM-DD HH:mm`），由浏览器校验补发窗口；手动触发和 Worker 发送时间均由程序记录。

主动消息支持三种运行方式：浏览器补发、私人 Worker 加密凭据、Worker Secret。私人 Worker 模式会把当前角色 API Key 经 HTTPS 发给用户自己的 Worker，使用 `APP_TOKEN` 派生的 AES-GCM key 加密后保存；接口不提供明文读取能力。更重视隔离的用户仍可选择 Worker Secret。

主动消息页里的 Worker URL 和访问口令与“后台回复接收”共用。页面会调用 `POST /proactive/capabilities` 检查新版接口、现有 `CHAT_JOB_OBJECT` binding 和所选凭据模式；旧版 Worker 返回 404 时会安全回退纯前端，不影响原有 `/jobs`。

主动消息页底部的“上下文日志”显示最近一次实际发往模型的请求。浏览器请求保存在本机 IndexedDB；Worker 请求按角色保存在现有 Durable Object，打开日志时通过 `GET /proactive/:id/request-log` 读取并选出最新一条。日志包含角色、时间、来源和请求体，不保存 API Key 或鉴权头；Worker 需要更新到包含此接口的版本后才能显示后台请求。

角色对象只保留最近 15 条文字聊天组成的精简决策上下文、运行计数、待领取消息和最近 10 条诊断事件，不保存图片 base64。浏览器将各角色事件合并为最近 40 条，页面展示最近 12 条。Worker 控制台日志也只记录决策、耗时和正文长度，不打印模型 Key、完整 Prompt 或消息正文。

主动消息直接复用原有 `CHAT_JOB_OBJECT` binding，不需要新增 Durable Object migration。已经部署过独立 `PROACTIVE_CHARACTER_OBJECT` 的用户可以保留旧 binding 一段时间，新 Worker 会在拉取和确认消息时兼容旧 outbox。

## 两种后台调用模式

网页里的“后台回复接收 / 后台调用模式”有两个选项。

### 1. 跟随前端 API Key（推荐）

这是最适合 TeleWindy 当前前端逻辑的模式。

你的 API URL、API Key、模型名仍然填在网页 API 设置里。发送消息时，前端会把“当前这一次请求需要用到的 URL、Key、模型名、温度、max tokens、自定义请求体参数”等一起交给你自己的 Worker。

Worker 会在普通后台任务的请求载荷中临时使用这个 Key：

- Queue 处理前，完整载荷会短暂写入 KV，包含本次模型 Key；正常处理完立即删除，异常时最长约一小时过期。
- 不写入任务状态。
- 不返回给前端。
- 不打印到日志。

适合：

- 每个用户自己部署私人 Worker。
- 经常切换多个模型或多个 API 预设。
- 使用中转站、反代、Qwen、Kimi、GLM、DeepSeek、OpenAI 兼容接口。
- 不想在 Cloudflare 里为每个模型都手动配置 secret。

这种模式下，只需要在 Cloudflare Worker 里设置 `APP_TOKEN`。模型 API Key 继续由用户自己填在网页里。

注意：`APP_TOKEN` 仍然要当密码保管。别人拿到它，虽然不能直接拿到你的模型 API Key，但可以骚扰你的 Worker、占用 KV 和 Worker 调用额度。

### 2. 使用 Worker 内置 Key（进阶）

这种模式下，前端不会发送模型 API Key。Worker 会根据前端传来的 API URL，在 Cloudflare secret 里找对应的 Key。

适合：

- 你只想让 Worker 固定连接几家服务商。
- 你不希望每次请求里携带模型 API Key。
- 你愿意在 Cloudflare 里手动维护不同服务商的 secret。

这种模式要额外设置这些 secret，例如：

```powershell
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put SILICONFLOW_API_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GLM_API_KEY
npx wrangler secret put CUSTOM1_API_KEY
```

这种模式下，如果 `APP_TOKEN` 泄露，别人可能借你的 Worker 使用你存在 Cloudflare secret 里的模型 Key，所以更要保护好 Worker URL 和后台密钥。

## Worker 会存什么

Worker 不会长期保存普通聊天记录。普通任务的状态保存在 Durable Object，包含：

- job 状态：`running` / `done` / `failed`
- 最终回复 `result`
- 可选的 `usage`
- 可选的图片描述 `image_description`
- 创建和完成时间

KV 在 Queue 处理期间保存完整请求载荷；前端 Key 模式下，其中可能包含模型和视觉 API Key、消息与当轮图片 base64。处理结束会尽量立即删除，异常时按不超过一小时的 TTL 过期。主动消息的加密凭据和精简上下文另存在角色 Durable Object。

任务会按前端设置的 TTL 过期，范围是 `0.25 - 24` 小时，默认 `6` 小时。前端成功取回后也会主动调用 `DELETE /jobs/:jobId` 删除临时结果。

## 后台识图

如果网页启用了后台回复接收，并且本次发送了图片，Worker 会根据网页选择的图片处理方式执行任务。

使用“单独识图 API”时，Worker 会把“识图 + 主模型回复”放进同一个后台任务里完成：

```text
前端提交图片和聊天上下文
Worker 先调用视觉模型生成 image_description
Worker 把图片描述注入聊天上下文
Worker 再调用主力聊天模型
前端取回 result 和 image_description
前端把 image_description 补回本地历史记录
```

视觉模型也跟随后台调用模式：

- 选择“跟随前端 API Key”时，视觉 API 使用网页视觉设置里的 `VISION_KEY`。如果 `VISION_KEY` 留空，则使用主 API Key。
- 选择“使用 Worker 内置 Key”时，视觉 API 由 Worker 根据视觉 API URL 匹配 Cloudflare secret。

识图失败时，Worker 不会直接让整条消息失败。它会给主模型注入一段提示：

```text
用户发送了一张图片，但由于未配置视觉模型或网络错误，无法提供图片内容的文本描述。
```

这样主模型至少知道“用户发过图片，只是看不到内容”。

使用“图文使用同一 API”时，前端会把原图挂到本轮 user 消息，Worker 直接请求一次主模型，不会调用视觉 API，也不会生成 `image_description`。历史图片不会随普通后续消息重复提交；只有图片发送当轮和该图片消息的重新生成会携带原图。

如果主模型以 `400`、`415` 或 `422` 明确拒绝图片结构，Worker 会移除图片重试一次，并把“当前模型或 API 无法读取图片”的提示注入本轮 user 消息。鉴权、限流、服务故障和超时不会触发这项回退。

限制：

- 单次 `/jobs` 请求体限制为 `20MB`。
- 图片会以 base64 形式提交，体积会比原图更大。
- 视觉模型最多等待 `200` 秒；超时后使用兜底提示继续请求主模型。
- 主模型最多等待 `200` 秒；超时后任务会标记为失败。

## 心迹后台回复

普通聊天页和心迹页共用同一个 `/jobs` 接口。

心迹页会额外带一个很小的 `context`，用来告诉前端回来后写到哪里：

```text
momentId：这条回复属于哪条心迹
charId：应该用哪个角色身份写回
commentId：重新生成评论时，要覆盖哪条旧评论
type：追加评论 / 追问回复 / 重新生成评论
```

这个 `context` 不包含 API Key，只用于前端回填定位。

## 并发说明

- Worker 可以同时接收多个 `/jobs` 请求。
- 每个请求都有独立的 `jobId`。
- 图片聊天会在同一个 job 里按顺序执行：先识图，再请求主模型。
- 普通聊天、图片聊天、心迹评论如果分别创建了 job，可以并行等待结果。
- 真正的限制通常来自模型服务商限流、Cloudflare 免费额度、手机浏览器是否来得及提交所有 job。

## 接口

```text
POST /jobs
GET /meta
GET /jobs/:jobId
DELETE /jobs/:jobId
PUT /proactive/:objectId/sync
GET /proactive/:objectId/status
GET /proactive/:objectId/messages
POST /proactive/:objectId/run
POST /proactive/:objectId/ack
POST /proactive/capabilities
OPTIONS /*
```

其中 `objectId` 由前端的安装实例 ID 和角色 ID 组合得到；不是用户名，也不要放 API Key。`messages` 只返回尚未确认领取的 outbox，前端成功写入本地聊天记录后再调用 `ack`，因此重复拉取也能靠 `messageId` 去重。

## 部署步骤（推荐：跟随前端 API Key）

### 1. 准备环境

需要：

- Cloudflare 账号
- Node.js
- 本目录里的 `worker.js` 和 `wrangler.toml.example`

在命令行检查：

```powershell
node -v
npm -v
```

能看到版本号就可以。

### 2. 进入 backend 目录

```powershell
cd "你的路径\backend"
```

### 3. 登录 Cloudflare

```powershell
npx wrangler login
```

浏览器会弹出 Cloudflare 授权页面，同意即可。

### 4. 复制配置文件

```powershell
copy wrangler.toml.example wrangler.toml
```

打开配置：

```powershell
notepad wrangler.toml
```

推荐先保持类似这样：

```toml
name = "telewindy-chat-jobs"
main = "worker.js"
compatibility_date = "2026-05-21"

[[kv_namespaces]]
binding = "CHAT_JOBS"
id = "这里填真实 KV id，后面马上讲"

[vars]
ALLOWED_ORIGIN = "https://795799.xyz,https://www.795799.xyz"
ALLOWED_MODELS = ""
```

说明：

- `ALLOWED_ORIGIN` 填你的网页域名。多个域名用英文逗号分隔。
- `ALLOWED_MODELS = ""` 表示不限制模型名，适合“跟随前端 API Key”模式。
- 推荐新用户先不要管 `UPSTREAM_CHAT_URL`、`DEEPSEEK_CHAT_URL`、`CUSTOM1_CHAT_URL` 这些内置 Key 配置。

### 5. 创建 KV

```powershell
npx wrangler kv namespace create CHAT_JOBS
```

成功后会输出类似：

```toml
[[kv_namespaces]]
binding = "CHAT_JOBS"
id = "abc1234567890xxxxxxxxxxxx"
```

把这个 `id` 抄进 `wrangler.toml`。就是这里。

```
[[kv_namespaces]]
binding = "CHAT_JOBS"
id = "这里填真实 KV id，后面马上讲"
```


### 6. 设置 APP_TOKEN

`APP_TOKEN` 是网页访问 Worker 的后台密钥。自己生成一串很长的随机字符。

```powershell
npx wrangler secret put APP_TOKEN
```

它会让你输入值。这个值之后要填到网页：

```text
探索 -> 后台回复接收 -> 后台密钥
```

如果 Wrangler 问是否创建项目，输入 `y`。

跟随前端 API Key 模式下，不需要设置模型 API Key secret。

### 7. 部署 Worker

```powershell
npx wrangler deploy
```

成功后会得到类似：

```text
https://telewindy-chat-jobs.xxx.workers.dev
```

这个地址记录下来，有梯子的话，直接填进后台URL，把刚才设置的密钥也填上，就能用，没梯子请看下一步。



### 7. 绑定域名以便国内访问

购买域名、托管到 Cloudflare 和绑定 Worker 的完整步骤统一放在[中国大陆访问：绑定自定义域名](#中国大陆访问绑定自定义域名)。

###8.  回网页里填写

打开 TeleWindy 网页：

```text
探索
→ 后台消息接收 / 后台生成恢复
```

填：

```text
后台URL:
https://你的域名（记得要加https://）

后台密钥:
你刚刚 wrangler secret put APP_TOKEN 时自己设置的密码
```

点保存。

###9. 测试

后台调用模式选择：

```text
跟随前端 API Key
```

点页面里的“测试连接”。它会用当前模型发一个极简 ping job，不会发送聊天记录。

成功后，点击保存。

## 可选：使用 Worker 内置 Key（进阶）

如果你要使用“Worker 内置 Key”，再配置这一段。

`wrangler.toml` 里可以保留或填写这些 URL：

```toml
DEEPSEEK_CHAT_URL = "https://api.deepseek.com/v1/chat/completions"
SILICONFLOW_CHAT_URL = "https://api.siliconflow.cn/v1/chat/completions"
OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
GLM_CHAT_URL = "https://api.z.ai/api/paas/v4/chat/completions"

CUSTOM1_CHAT_URL = "https://你的中转站/v1/chat/completions"
CUSTOM1_MATCH_HOSTS = ""
```

然后设置对应 secret：

```powershell
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put SILICONFLOW_API_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GLM_API_KEY
npx wrangler secret put CUSTOM1_API_KEY
```

匹配规则：

- DeepSeek / SiliconFlow / OpenAI / GLM 会按常见官方 URL 匹配。
- `CUSTOM1_CHAT_URL` 适合中转站或自定义 OpenAI 兼容接口。
- 如果设置了 `CUSTOM1_MATCH_HOSTS`，可以按 host 匹配多个 URL。
- 如果都匹配不到，会尝试旧版 `UPSTREAM_CHAT_URL + UPSTREAM_API_KEY` fallback。

网页里选择：

```text
使用 Worker 内置 Key
```

## 中国大陆访问：绑定自定义域名

`workers.dev` 在中国大陆网络通常无法直接使用。请把 Worker 绑定到自己的域名，并以 TeleWindy 的连接测试确认是否可达。

### 1. 购买一个域名

以 Spaceship 为例，先到 [Spaceship 中文网站](https://www.spaceship.com/zh/)注册账号，再到[域名搜索页面](https://www.spaceship.com/zh/domains/)搜索并购买域名。原教程推荐 6～10 位数字的 `.xyz` 域名；价格会变化，请以购买页面为准。已有域名的用户直接看下一步。

### 2. 托管域名到 Cloudflare（简称 CF）

1. 在 Cloudflare 添加域名：**Dashboard → Websites → Add a site**，输入你的域名（例如 `795799.xyz`），点 **Continue**。选择免费计划，确认 Cloudflare 扫描出的 DNS 记录。Cloudflare 随后会给你两个 NS 地址，格式类似：

   ```text
   uma.ns.cloudflare.com
   wade.ns.cloudflare.com
   ```

   请复制页面上**实际分配给你的两个地址**，不要照抄上面的示例。

2. 到 Spaceship 修改 NS：打开[域名列表](https://www.spaceship.com/zh/application/domain-list-application/)，点击你的域名 → **名称服务器和 DNS → 自定义名称服务器**，填入 Cloudflare 给你的两个 NS 地址并保存。
3. 等待生效。NS 传播可能需要几分钟到几小时；Cloudflare 显示域名状态为 **Active** 后再继续。

### 3. 进入你的 Worker

打开 Cloudflare **Workers & Pages**，找到刚部署的 Worker，例如 `telewindy-chat-jobs`，点击进入。

### 4. 添加自定义域名

进入 **Domains & Routes → Add → Custom Domain**，输入专用子域名，例如：

```text
chat-jobs.你的域名.com
```

点击 **Add Domain**。Cloudflare 会添加相应的 DNS 记录；这个域名必须已经托管在 Cloudflare，即 NS 指向 Cloudflare。

### 5. 把新地址填进 TeleWindy

等域名绑定生效后，在 TeleWindy → 探索 → 后台运行服务的“后台URL”填入 `https://chat-jobs.你的域名.com`，保存并点“测试连接”。域名可访问性仍取决于当前网络，请以测试结果为准。

## 网页里怎么填

打开 TeleWindy：

```text
探索 -> 后台回复接收
```

填写：

```text
后台URL:
https://你的-worker地址

后台密钥:
你设置 APP_TOKEN 时输入的那串

后台调用模式:
跟随前端 API Key（推荐）
```

点保存，再点测试连接。

测试成功后，发送消息时流程会变成：

```text
网页创建 job
Worker 请求模型
网页轮询结果
成功后写回 IndexedDB
取回后删除 Worker 临时结果
```

## 常见错误

```text
401 unauthorized
APP_TOKEN 填错了，或网页后台密钥和 Worker secret 不一致。

403 forbidden_origin
ALLOWED_ORIGIN 没有包含你的网页域名。

404 not_found
job 已经过期、已删除，或者后台 URL 填错了。

413 request_too_large
图片、聊天历史、世界书或角色设定太大。压缩图片或减少上下文后重试。

400 model_not_allowed
启用了 ALLOWED_MODELS 白名单，但当前模型不在白名单里。留空 ALLOWED_MODELS 可以关闭白名单。

client_api_key_missing
你选择了“跟随前端 API Key”，但当前网页 API 预设没有填写 Key。

server_api_key_missing / provider_not_configured
你选择了“使用 Worker 内置 Key”，但 Cloudflare secret 或 URL 匹配没有配置好。

upstream_401
模型 API Key 错了。

upstream_400
模型名、请求体参数或接口格式不被上游 API 接受。

upstream_500
上游模型服务自己返回了 500。可以换模型、降低 max tokens、清空自定义请求体参数后重试。

chat_upstream_timeout
主模型超过 200 秒没有返回。
```

## 参考文档

[Wrangler](https://developers.cloudflare.com/workers/wrangler/)  
[wrangler deploy](https://developers.cloudflare.com/workers/wrangler/commands/deploy/)  
[KV namespace create](https://developers.cloudflare.com/workers/wrangler/commands/kv/)  
[Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

## Queue 版后台长任务说明

当前 Worker 使用 Cloudflare Queues 执行真正的模型请求，不再依赖 `ctx.waitUntil()`。
这是为了让 GLM、思考挡位较高、识图后再回复这类 50-90 秒任务，也能在手机切屏或锁屏后继续完成。

部署时除了 KV，还需要创建 Queue：

```powershell
npx wrangler queues create telewindy-chat-jobs
```

并在 `wrangler.toml` 里保留这两段绑定：

```toml
[[queues.producers]]
binding = "CHAT_JOB_QUEUE"
queue = "telewindy-chat-jobs"

[[queues.consumers]]
queue = "telewindy-chat-jobs"
max_batch_size = 1
max_batch_timeout = 5
max_retries = 0
```

Queue 消息里只放 `jobId`。完整请求体会临时写入 KV 的 `job_payload:<jobId>`：

- 成功或失败后都会尽量立刻删除 `job_payload:<jobId>`。
- 不依赖 Queue 自动重试，避免重复扣费，也避免失败后 payload 长时间保留。
- 如果 Worker 被平台中断或 KV 删除临时失败，payload 最多保留 1 小时。
- `client_key` 模式下，模型 API Key 会临时放进 payload KV；如果不希望 Key 进入 KV，请使用“Worker 内置 Key”模式。

单次 `/jobs` 请求体限制为 20MiB，给 KV 的 25MiB 单值上限留出 JSON 包装余量。超大图片或超长上下文需要压缩图片、减少历史上下文后再发送。

## Durable Object 实时状态说明

Queue 负责长时间执行模型请求；Durable Object 负责保存 `running` / `done` / `failed`、`result`、`usage` 和诊断 `events`。

这样前端 `GET /jobs/:jobId` 读取的是同一个 Durable Object，不再依赖 KV 的最终一致性传播，模型完成后下一次轮询就能尽快看到 `done`。

KV 现在只保存临时请求体：

```text
job_payload:<jobId>
```

`wrangler.toml` 里需要额外保留 Durable Object 绑定和 migration：

```toml
[[durable_objects.bindings]]
name = "CHAT_JOB_OBJECT"
class_name = "ChatJobObject"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["ChatJobObject"]
```

如果是给第二个 Worker 单独部署，Queue 名字要和第二个 Worker 区分开；Durable Object 的 binding 名字 `CHAT_JOB_OBJECT` 不要改，因为代码里按这个名字读取。
