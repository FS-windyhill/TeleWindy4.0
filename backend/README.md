# TeleWindy 私人 Worker

私人 Worker 可以在你切屏或关闭 TeleWindy 后继续生成回复，并按主动消息规则在后台唤醒角色。没有部署 Worker 时，TeleWindy 仍可使用浏览器补发模式。

## 用手机浏览器部署

1. 准备 GitHub 和 Cloudflare 账号，点击下方按钮。Cloudflare 会把本目录复制到你的 GitHub 账号，并为你的 Worker 创建所需的 KV、Queue 和 Durable Object。

   [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/FS-windyhill/TeleWindy4.0/tree/main/backend)

2. **创建私有仓库。** 部署页面会为你在 GitHub 创建一份项目；在仓库可见性选项中选择 **Private（私有）**，不要选 Public（公开）。部署完成后打开自己的 GitHub 仓库，确认名称旁有锁头标志、仓库显示 Private。用户不需要手动 Fork。
3. 在部署页面把 `APP_TOKEN` 的示例值换成你自己生成的随机长口令。记下这串口令；**不要把模型 API Key 填在这里，也不要把真实口令提交到 GitHub**。
4. **中国大陆用户先绑定自己的域名。** 准备一个域名，把域名托管到 Cloudflare，然后在刚部署的 Worker 中打开 **Domains & Routes → Add → Custom Domain**，填写专用子域名，例如 `chat-jobs.你的域名.com`。[购买、托管和绑定的详细步骤](ADVANCED.md#中国大陆访问绑定自定义域名)
5. 打开 TeleWindy → 探索 → 后台运行服务，填入 `https://chat-jobs.你的域名.com` 和刚才的口令，保存并点“测试连接”。切屏回复的调用模式默认是“跟随前端 API Key”，模型 Key 仍在 TeleWindy 的 API 预设中填写。
6. 需要主动消息时，再去主动消息页面选择“私人 Worker 后台”，按页面提示授权保存加密凭据。

Cloudflare 首次部署给出的 `workers.dev` 地址在中国大陆网络通常无法直接使用；自定义域名绑定后，也请以 TeleWindy 的“测试连接”结果确认当前网络可访问。首次部署页面在手机上的具体布局可能随 Cloudflare 更新。

## 以后怎么更新

你的 GitHub 仓库会每 6 小时检查一次公开的 `main/backend/worker.js`；有更新时只同步 Worker 程序，Cloudflare 随后从你的仓库重新部署。**你的 Wrangler 配置和 Secret 不会被同步覆盖。** GitHub 定时任务可能延迟；公开仓库长时间没有活动时也可能停用定时任务。

TeleWindy 的“后台运行服务”会显示当前 Worker 版本。若提示旧版，请打开部署时创建的 GitHub 仓库 → Actions → **Sync TeleWindy Worker** → **Run workflow**，手动触发同步。若新版本要求新增 Cloudflare 资源绑定，需按当次升级说明操作，自动同步程序文件不能代替资源迁移。

## 关于 Key 和费用

- 默认模式把每次任务所需的模型 Key 交给你自己的 Worker；普通任务的完整载荷会短暂存入你的 Cloudflare KV，通常处理完即删，异常时最多保留约一小时。
- 主动消息需要在以后唤醒时再次调用模型，因此“私人 Worker 后台”会把模型 Key 加密保存在你的 Durable Object。更换 `APP_TOKEN` 后，请更新 TeleWindy 中的后台口令，并在主动消息页重新检测和应用运行方式，让角色凭据重新同步。
- “Worker 内置 Key”仍可用：在 Cloudflare Worker → Settings → Variables and Secrets 添加对应模型 Secret，再到 TeleWindy 切换模式。操作可以在浏览器完成。[服务商匹配与 Secret 名称](ADVANCED.md#可选使用-worker-内置-key进阶)
- Worker、KV、Queue 和 Durable Object 均有各自的免费额度，超限行为取决于你的 Cloudflare 计划。[Cloudflare 当前计费说明](https://developers.cloudflare.com/workers/platform/pricing/)

需要命令行部署、域名绑定、接口说明和故障排查时看 [进阶文档](ADVANCED.md)。
