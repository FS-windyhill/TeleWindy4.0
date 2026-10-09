const DEFAULT_JOB_TTL_HOURS = 6;
// ★ 前端只用此版本识别已部署的 Worker；发布新版 worker.js 时同步递增。
const WORKER_VERSION = "2026.10.09.1";
const WORKER_PROTOCOL_VERSION = 1;
const MIN_JOB_TTL_HOURS = 0.25;
const MAX_JOB_TTL_HOURS = 24;
// ★ 上游模型请求超时：
// 视觉模型和主聊天模型各自最多等待 200 秒，避免某个服务商连接挂住后 job 永远卡在 running。
const UPSTREAM_TIMEOUT_MS = 200 * 1000;
// ★ 后台识图会把本次图片 base64 一起交给 Worker：
// 1. base64 会比原图大约膨胀 1/3；
// 2. Queue 版会把本次 payload 临时写进 KV，KV 单值上限是 25MiB；
// 3. 所以这里把“单次 job 请求体”限制在 20MiB，给 JSON 包装和事件字段留余量。
const MAX_BODY_BYTES = 20 * 1024 * 1024;
// ★ payload 里可能临时包含 client_key 模式传来的模型 Key。
// 正常执行结束会立刻删除；如果 consumer 被平台中断，最多也只保留 1 小时。
const MAX_PAYLOAD_TTL_SECONDS = 60 * 60;
const CUSTOM_PROVIDER_SLOTS = ["CUSTOM1", "CUSTOM2", "CUSTOM3"];
// ★ 主动判断只需要最近一小段对话；限制为 15 条，避免心跳请求长期携带过多聊天正文。
const PROACTIVE_CONTEXT_MESSAGE_LIMIT = 15;

export class ChatJobObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // ★ 主动消息复用已经部署过的 CHAT_JOB_OBJECT namespace：
    // 普通 job 仍走原路径和过期清理；以 /proactive/ 开头的对象则交给主动角色状态机。
    // 这样老用户只更新 Worker 代码即可，不需要新增 binding 或 Durable Object migration。
    if (url.pathname.includes("/proactive/")) {
      return await new ProactiveCharacterObject(this.state, this.env).fetch(request);
    }

    if (request.method === "POST" && url.pathname === "/init") {
      const body = await request.json();
      const job = body.job && typeof body.job === "object" ? body.job : {};
      await this.state.storage.put("job", job);
      await this.setExpiryAlarm(job.ttlSeconds);
      return Response.json(job);
    }

    if (request.method === "GET" && url.pathname === "/job") {
      const job = await this.state.storage.get("job");
      return job ? Response.json(job) : Response.json({ error: "not_found" }, { status: 404 });
    }

    if (request.method === "POST" && url.pathname === "/patch") {
      const body = await request.json();
      const current = await this.state.storage.get("job") || {};
      const events = Array.isArray(current.events) ? current.events.slice(-39) : [];
      const nextJob = body.nextJob && typeof body.nextJob === "object" ? body.nextJob : {};
      const event = body.event && typeof body.event === "object" ? body.event : null;
      const job = {
        ...current,
        ...nextJob,
        events: event ? [...events, event] : events
      };
      await this.state.storage.put("job", job);
      await this.setExpiryAlarm(job.ttlSeconds);
      return Response.json(job);
    }

    if (request.method === "POST" && url.pathname === "/delete") {
      await this.state.storage.delete("job");
      await this.state.storage.deleteAlarm();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "not_found" }, { status: 404 });
  }

  async alarm() {
    // ★ 同一个 namespace 中只有主动角色会写 capsule；普通 job 的 Alarm 仍只负责过期删除。
    const proactiveCapsule = await this.state.storage.get("capsule");
    if (proactiveCapsule) {
      return await new ProactiveCharacterObject(this.state, this.env).alarm();
    }
    await this.state.storage.delete("job");
  }

  async setExpiryAlarm(ttlSeconds) {
    const seconds = Number(ttlSeconds || 0);
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    await this.state.storage.setAlarm(Date.now() + seconds * 1000);
  }
}

// ★★★★★ 主动消息角色对象 START ★★★★★
// 每个“浏览器安装实例 × 角色”使用一个 Durable Object：
// 1. 前端只同步主动判断需要的精简上下文，不上传图片和完整数据库；
// 2. Alarm 到点后给角色一次“可以思考要不要联系”的机会，而不是强制发消息；
// 3. 消息先写进 outbox，PWA 下次打开时仍能可靠取回；每个角色只暂存最近 10 条离线诊断事件。
// 4. 后台普通回复与主动发言先补进待领取上下文，前端恢复后按消息 ID 清理，避免离线期间失忆。
export class ProactiveCharacterObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const action = url.pathname.split("/").filter(Boolean).pop() || "status";

    if (request.method === "PUT" && action === "sync") {
      const rawCapsule = await request.json();
      const capsule = sanitizeProactiveCapsule(rawCapsule);
      const previous = await this.state.storage.get("capsule") || {};
      const runtime = await this.readRuntime();
      // ★ 较早发出的快照即使晚到，也不能覆盖角色回复后的新快照。
      if (capsule.contextRevision < Number(previous.contextRevision || 0)) {
        return Response.json(await this.buildStatus());
      }
      const nextCapsule = {
        ...previous, ...capsule,
        lastUserAt: Math.max(Number(previous.lastUserAt || 0), capsule.lastUserAt),
        lastChatAt: Math.max(Number(previous.lastChatAt || 0), capsule.lastChatAt),
        updatedAt: Date.now()
      };

      // ★ 普通后台回复的 client_key 只存一小时；主动 Alarm 未来仍要使用，因此必须单独加密保存。
      // 密文使用 APP_TOKEN 派生的 AES-GCM key，接口永远不提供明文读取能力。
      if (!nextCapsule.enabled) {
        await this.state.storage.delete("credential");
      } else if (nextCapsule.credentialMode === "stored_client_key") {
        const apiKey = String(rawCapsule.apiKey || "");
        if (!apiKey) {
          return Response.json({ error: "client_api_key_missing" }, { status: 400 });
        }
        const encryptedCredential = await encryptProactiveCredential(apiKey, this.env);
        await this.state.storage.put("credential", {
          ...encryptedCredential,
          apiUrl: nextCapsule.apiUrl,
          fingerprint: await fingerprintSecret(apiKey),
          updatedAt: Date.now()
        });
      } else {
        await this.state.storage.delete("credential");
      }

      // ★ 用户在上次主动消息后重新说话，视为已经回应；退避计数在服务端自动清零。
      if (nextCapsule.lastUserAt > Number(runtime.lastProactiveGeneratedAt || 0)) {
        runtime.unansweredCount = 0;
      }

      await this.state.storage.put("capsule", nextCapsule);
      await this.state.storage.put("runtime", runtime);
      // ★ 前端已经收录的 Worker 消息从暂存层移除；未领取的消息继续供主动判断读取。
      const deliveredIds = new Set([
        ...nextCapsule.messages.map((message) => message.messageId),
        ...nextCapsule.acknowledgedMessageIds
      ]);
      const pendingMessages = await this.state.storage.get("pendingMessages") || [];
      await this.state.storage.put("pendingMessages", pendingMessages.filter((message) => !deliveredIds.has(message.messageId)));
      // ★ 同步可能在每次打开页面时重复发生，不写诊断事件，避免挤掉决策和失败日志。

      if (nextCapsule.enabled) {
        const currentAlarm = await this.state.storage.getAlarm();
        if (currentAlarm == null) {
          const firstWakeAt = normalizeFutureWakeAt(
            nextCapsule.nextWakeAt,
            Date.now() + 30 * 60 * 1000,
            nextCapsule.policy
          );
          await this.setNextAlarm(firstWakeAt, "initial_sync");
        }
      } else {
        await this.state.storage.deleteAlarm();
        await this.state.storage.delete("credential");
        await this.state.storage.delete("pendingMessages");
        runtime.nextWakeAt = null;
        await this.state.storage.put("runtime", runtime);
      }

      return Response.json(await this.buildStatus());
    }

    if (request.method === "GET" && action === "status") {
      return Response.json(await this.buildStatus());
    }

    if (request.method === "POST" && action === "activity") {
      const body = await request.json();
      const capsule = await this.state.storage.get("capsule");
      if (!capsule?.enabled) return Response.json({ ok: false, error: "proactive_disabled" }, { status: 409 });
      const lastUserAt = clampInteger(body?.lastUserAt, 0, Number.MAX_SAFE_INTEGER, 0);
      const lastChatAt = clampInteger(body?.lastChatAt, 0, Number.MAX_SAFE_INTEGER, 0);
      capsule.lastUserAt = Math.max(Number(capsule.lastUserAt || 0), lastUserAt);
      capsule.lastChatAt = Math.max(Number(capsule.lastChatAt || 0), lastChatAt);
      const runtime = await this.readRuntime();
      if (lastUserAt > runtime.lastProactiveGeneratedAt) runtime.unansweredCount = 0;
      await this.state.storage.put("capsule", capsule);
      await this.state.storage.put("runtime", runtime);
      return Response.json({ ok: true });
    }

    if (request.method === "POST" && action === "append-chat-reply") {
      // ★ 仅供普通聊天 Queue 通过 DO binding 调用；外部路由不暴露这个动作。
      const body = await request.json();
      const capsule = await this.state.storage.get("capsule");
      if (!capsule?.enabled) return Response.json({ ok: false, error: "proactive_disabled" }, { status: 409 });
      await this.appendPendingMessage(body);
      capsule.lastChatAt = Math.max(Number(capsule.lastChatAt || 0), clampInteger(body?.eventAt, 0, Number.MAX_SAFE_INTEGER, 0));
      await this.state.storage.put("capsule", capsule);
      return Response.json({ ok: true });
    }

    if (request.method === "GET" && action === "request-log") {
      // ★ 完整请求体只在用户打开上下文日志时读取，不混入频繁同步的状态快照。
      return Response.json({ log: await this.state.storage.get("proactiveRequestLog") || null });
    }

    if (request.method === "GET" && action === "messages") {
      const outbox = await this.state.storage.get("outbox") || [];
      return Response.json({ messages: outbox.filter((item) => item.acknowledged !== true) });
    }

    if (request.method === "POST" && action === "ack") {
      const body = await request.json();
      const ids = new Set(Array.isArray(body.messageIds) ? body.messageIds.map(String) : []);
      const outbox = await this.state.storage.get("outbox") || [];
      const nextOutbox = outbox.map((item) => ids.has(String(item.messageId))
        ? { ...item, acknowledged: true, acknowledgedAt: Date.now() }
        : item
      ).slice(-50);
      await this.state.storage.put("outbox", nextOutbox);
      return Response.json({ ok: true });
    }

    // ★★★★★ 主动消息重生成 job START ★★★★★
    if (request.method === "POST" && action === "reroll") {
      const payload = await request.json();
      const reroll = payload.proactive_reroll || {};
      const messageId = String(reroll.messageId || "").slice(0, 120);
      const revision = String(reroll.revision || "").slice(0, 120);
      const objectName = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-2) || "");
      if (!messageId || !revision || reroll.objectName !== objectName) {
        return Response.json({ error: "proactive_reroll_target_invalid" }, { status: 400 });
      }
      // ★ 本次配置只决定模型与凭据，不同步 capsule，不修改 Alarm、冷却或每日计数。
      const rawCapsule = reroll.capsule || {};
      const capsule = sanitizeProactiveCapsule(rawCapsule);
      let apiKey = "";
      if (capsule.credentialMode === "stored_client_key") {
        apiKey = String(rawCapsule.apiKey || "");
        if (!apiKey) {
          const credential = await this.state.storage.get("credential");
          if (credential?.apiUrl !== capsule.apiUrl) {
            return Response.json({ error: "stored_credential_unavailable" }, { status: 400 });
          }
          try { apiKey = await decryptProactiveCredential(credential, this.env); }
          catch (error) { return Response.json({ error: "stored_credential_unavailable" }, { status: 400 }); }
        }
      }
      const versions = await this.state.storage.get("rerollVersions") || {};
      versions[messageId] = revision;
      await this.state.storage.put("rerollVersions", Object.fromEntries(Object.entries(versions).slice(-100)));
      return await createJob(new Request(request.url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, api_url: capsule.apiUrl, api_key: apiKey,
          auth_mode: capsule.credentialMode === "stored_client_key" ? "client_key" : "server_secret",
          proactive_object_name: "" })
      }), this.env, { objectName, messageId, revision });
    }

    if (request.method === "POST" && action === "replace-message") {
      // ★ 只由 Queue 经 DO binding 调用；外部路由不暴露回填动作。
      const body = await request.json();
      const text = stripProactiveRerollText(body.content);
      if (!text) return Response.json({ error: "proactive_reroll_empty" }, { status: 422 });
      // ★ 同一事务内校验版本并替换三个存储层，防止同步/重复回填只更新一半。
      const applied = await this.state.storage.transaction(async transaction => {
        const versions = await transaction.get("rerollVersions") || {};
        if (versions[body.messageId] !== body.revision) return false;
        const capsule = await transaction.get("capsule");
        if (capsule) {
          capsule.messages = (capsule.messages || []).map(message => message.messageId === body.messageId
            ? { ...message, content: text } : message);
          // ★ 生成前已发出的旧快照不能在回填之后把旧正文重新覆盖回来。
          capsule.contextRevision = Math.max(Number(capsule.contextRevision || 0), Date.now());
          await transaction.put("capsule", capsule);
        }
        const pending = await transaction.get("pendingMessages") || [];
        await transaction.put("pendingMessages", pending.map(message => message.messageId === body.messageId
          ? { ...message, content: text } : message));
        const outbox = await transaction.get("outbox") || [];
        await transaction.put("outbox", outbox.map(message => message.messageId === body.messageId
          ? { ...message, content: text, acknowledged: true, acknowledgedAt: Date.now() } : message));
        return true;
      });
      return Response.json({ ok: true, applied });
    }
    // ★★★★★ 主动消息重生成 job END ★★★★★

    if (request.method === "POST" && action === "run") {
      const rawCapsule = await request.json().catch(() => null);
      // ★ 手动判断使用本次请求的角色胶囊，不改自动参与名单，也不为未参与角色创建 Alarm。
      const capsule = rawCapsule ? sanitizeProactiveCapsule(rawCapsule) : null;
      const result = await this.runHeartbeat({ source: "manual", capsule, apiKey: String(rawCapsule?.apiKey || "") });
      return Response.json(result);
    }

    return Response.json({ error: "not_found" }, { status: 404 });
  }

  async alarm(alarmInfo) {
    await this.runHeartbeat({
      source: alarmInfo?.isRetry ? "alarm_retry" : "alarm",
      retryCount: Number(alarmInfo?.retryCount || 0)
    });
  }

  async runHeartbeat(meta = {}) {
    const manual = meta.source === "manual";
    const capsule = meta.capsule ? { ...meta.capsule, enabled: true } : await this.state.storage.get("capsule");
    const runtime = await this.readRuntime();
    const heartbeatRunId = crypto.randomUUID();
    const startedAt = Date.now();

    if (!capsule?.enabled) {
      await this.appendEvent("proactive_disabled", { heartbeatRunId });
      return { ok: true, skipped: "disabled", heartbeatRunId };
    }

    await this.appendEvent(manual ? "proactive_manual_started" : "proactive_alarm_fired", {
      heartbeatRunId,
      source: meta.source || "alarm",
      retryCount: Number(meta.retryCount || 0)
    });

    const prefilter = manual ? { ok: true } : getProactivePrefilter(capsule, runtime, startedAt);
    if (!prefilter.ok) {
      const nextWakeAt = normalizeFutureWakeAt(
        prefilter.retryAt,
        startedAt + getHeartbeatMs(capsule.policy),
        capsule.policy
      );
      await this.appendEvent("proactive_prefilter_skipped", {
        heartbeatRunId,
        reason: prefilter.reason,
        nextWakeAt
      });
      // ★ 预筛选也可能跨过自然日并清零当日计数；即使本轮不请求模型，也要把这个变化落盘。
      await this.state.storage.put("runtime", runtime);
      await this.setNextAlarm(nextWakeAt, `prefilter_${prefilter.reason}`);
      return { ok: true, skipped: prefilter.reason, heartbeatRunId, nextWakeAt };
    }

    const credentialMode = capsule.credentialMode === "stored_client_key" ? "stored_client_key" : "server_secret";
    let apiKey = "";
    if (credentialMode === "stored_client_key") {
      try {
        // ★ 手动请求里的 Key 只用于本次调用；自动 Alarm 才读取事先加密保存的凭据。
        apiKey = manual
          ? String(meta.apiKey || "")
          : await decryptProactiveCredential(await this.state.storage.get("credential"), this.env);
      } catch (error) {
        await this.appendEvent("proactive_run_failed", {
          heartbeatRunId,
          error: "stored_credential_unavailable"
        });
        const nextWakeAt = startedAt + getHeartbeatMs(capsule.policy);
        if (!manual) await this.setNextAlarm(nextWakeAt, "credential_missing");
        return { ok: false, error: "stored_credential_unavailable", heartbeatRunId, nextWakeAt };
      }
    }
    const upstream = resolveUpstream(
      capsule.apiUrl,
      apiKey,
      credentialMode === "stored_client_key" ? "client_key" : "server_secret",
      this.env
    );
    if (!upstream.ok) {
      const nextWakeAt = startedAt + getHeartbeatMs(capsule.policy);
      await this.appendEvent("proactive_run_failed", {
        heartbeatRunId,
        error: upstream.error,
        nextWakeAt
      });
      if (!manual) await this.setNextAlarm(nextWakeAt, "provider_missing");
      return { ok: false, error: upstream.error, heartbeatRunId, nextWakeAt };
    }

    try {
      await this.appendEvent("proactive_model_request_started", {
        heartbeatRunId,
        provider: upstream.provider.id,
        model: capsule.model
      });
      // ★ 与普通后台回复共用文本模型传输层；主动消息只负责构造自己的判断协议。
      const pendingMessages = await this.state.storage.get("pendingMessages") || [];
      const decisionCapsule = { ...capsule, messages: mergeProactiveMessages(capsule.messages, pendingMessages) };
      const requestBody = {
        model: sanitizeModel(capsule.model || this.env.DEFAULT_MODEL),
        temperature: clampNumber(capsule.temperature, 0, 2, 1),
        max_tokens: capsule.maxTokens,
        ...(capsule.requestBodyExtra || {}),
        messages: buildProactiveDecisionMessages(decisionCapsule, runtime, startedAt, manual),
        stream: false
      };
      // ★ 这里保存的是实际交给文本模型传输层的请求体；凭据只用于请求头，日志永不保存明文 Key。
      const logBody = JSON.parse(JSON.stringify(requestBody, (key, value) =>
        /^(?:api[_-]?key|authorization|access[_-]?token|secret|password)$/i.test(key) ? '[已隐藏]' : value
      ));
      try {
        await this.state.storage.put("proactiveRequestLog", {
          createdAt: Date.now(),
          characterId: capsule.characterId,
          characterName: capsule.characterName,
          source: "Worker",
          trigger: meta.source || "alarm",
          content: JSON.stringify({
            api_url: sanitizeUrlForLog(upstream.provider.url),
            auth_mode: credentialMode === "stored_client_key" ? "client_key" : "server_secret",
            ...logBody
          }, null, 2)
        });
      } catch (logError) {
        // ★ 日志写入失败不能阻断已获准的主动判断；模型请求仍按原流程执行。
        console.warn("proactive_request_log_save_failed", { error: sanitizeLogText(logError?.message || String(logError)) });
      }
      const response = await fetchChatCompletion(upstream.provider, requestBody, "proactive_upstream");

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`proactive_upstream_${response.status}:${sanitizeLogText(text)}`);
      }
      const rawContent = extractAssistantContent(JSON.parse(text));
      const decision = normalizeProactiveDecision(rawContent);

      runtime.lastHeartbeatAt = startedAt;
      runtime.lastDecision = decision.decision;
      runtime.lastHeartbeatRunId = heartbeatRunId;

      let message = null;
      if (decision.decision === "send") {
        const outbox = await this.state.storage.get("outbox") || [];
        message = {
          messageId: `proactive_${heartbeatRunId}`,
          heartbeatRunId,
          role: "assistant",
          content: decision.content,
          sentAt: decision.sentAt,
          generatedAt: Date.now(),
          source: "proactive_worker",
          acknowledged: false
        };
        outbox.push(message);
        await this.state.storage.put("outbox", outbox.slice(-50));
        // ★ Worker 自己发出的主动消息立即进入下一次判断上下文，不等用户打开页面领取。
        if ((await this.state.storage.get("capsule"))?.enabled) {
          await this.appendPendingMessage({ messageId: message.messageId, content: message.content, eventAt: message.generatedAt });
        }
        runtime.lastProactiveGeneratedAt = message.generatedAt;
        runtime.unansweredCount = Number(runtime.unansweredCount || 0) + 1;
        runtime.dailyDateKey = getOffsetDateKey(startedAt, capsule.timezoneOffsetMinutes);
        runtime.dailyCount = Number(runtime.dailyCount || 0) + 1;
        await this.appendEvent("proactive_decision_send", {
          heartbeatRunId,
          sentAt: decision.sentAt,
          contentLength: decision.content.length
        });
      } else {
        await this.appendEvent("proactive_decision_silent", { heartbeatRunId });
      }

      // ★ 模型只给相对间隔；以模型请求完成后的时间为起点，再由程序限制最晚唤醒。
      const scheduleFrom = Date.now();
      const nextWakeAt = normalizeFutureWakeAt(
        decision.nextCheckMinutes ? scheduleFrom + decision.nextCheckMinutes * 60000 : null,
        scheduleFrom + getHeartbeatMs(capsule.policy),
        capsule.policy
      );
      if (!manual) runtime.nextWakeAt = nextWakeAt;
      await this.state.storage.put("runtime", runtime);
      if (!manual) await this.setNextAlarm(nextWakeAt, "model_decision");
      await this.appendEvent("proactive_model_request_finished", {
        heartbeatRunId,
        decision: decision.decision,
        durationMs: Date.now() - startedAt,
        nextWakeAt
      });
      console.log("proactive_heartbeat_done", {
        heartbeatRunId,
        decision: decision.decision,
        contentLength: decision.content.length,
        nextWakeAt,
        durationMs: Date.now() - startedAt
      });
      return { ok: true, heartbeatRunId, decision: decision.decision, message, nextWakeAt };
    } catch (error) {
      const nextWakeAt = startedAt + getHeartbeatMs(capsule.policy);
      await this.appendEvent("proactive_run_failed", {
        heartbeatRunId,
        error: sanitizeLogText(error?.message || String(error)),
        nextWakeAt
      });
      if (!manual) await this.setNextAlarm(nextWakeAt, "run_failed");
      console.error("proactive_heartbeat_failed", {
        heartbeatRunId,
        error: sanitizeLogText(error?.message || String(error)),
        durationMs: Date.now() - startedAt
      });
      return { ok: false, heartbeatRunId, error: "proactive_run_failed", nextWakeAt };
    }
  }

  async readRuntime() {
    const runtime = await this.state.storage.get("runtime") || {};
    return {
      nextWakeAt: Number(runtime.nextWakeAt || 0) || null,
      lastHeartbeatAt: Number(runtime.lastHeartbeatAt || 0),
      lastDecision: runtime.lastDecision || "",
      lastHeartbeatRunId: runtime.lastHeartbeatRunId || "",
      lastProactiveGeneratedAt: Number(runtime.lastProactiveGeneratedAt || 0),
      unansweredCount: Math.max(0, Number(runtime.unansweredCount || 0)),
      dailyDateKey: runtime.dailyDateKey || "",
      dailyCount: Math.max(0, Number(runtime.dailyCount || 0))
    };
  }

  async appendPendingMessage(raw) {
    const messageId = String(raw?.messageId || "").slice(0, 120);
    const content = stripProactiveThought(String(raw?.content || "")).trim().slice(0, 4000);
    if (!messageId || !content) return;
    const pendingMessages = await this.state.storage.get("pendingMessages") || [];
    if (pendingMessages.some((message) => message.messageId === messageId)) return;
    pendingMessages.push({ messageId, role: "assistant", content, eventAt: clampInteger(raw?.eventAt, 0, Number.MAX_SAFE_INTEGER, Date.now()) });
    await this.state.storage.put("pendingMessages", pendingMessages.slice(-PROACTIVE_CONTEXT_MESSAGE_LIMIT));
  }

  async setNextAlarm(nextWakeAt, reason) {
    // ★ 不替用户偷偷增加分钟级下限；只保证时间不落在已经过去的毫秒里。
    const safeTime = Math.max(Date.now(), Number(nextWakeAt || 0));
    const runtime = await this.readRuntime();
    runtime.nextWakeAt = safeTime;
    await this.state.storage.put("runtime", runtime);
    await this.state.storage.setAlarm(safeTime);
    await this.appendEvent("proactive_next_alarm_set", { nextWakeAt: safeTime, reason });
  }

  async appendEvent(code, detail = {}) {
    const events = await this.state.storage.get("events") || [];
    events.push({ code, ts: Date.now(), ...detail });
    await this.state.storage.put("events", events.slice(-10));
  }

  async buildStatus() {
    const runtime = await this.readRuntime();
    const events = await this.state.storage.get("events") || [];
    const outbox = await this.state.storage.get("outbox") || [];
    const capsule = await this.state.storage.get("capsule") || null;
    return {
      enabled: capsule?.enabled === true,
      credentialMode: capsule?.credentialMode || "server_secret",
      runtime,
      pendingMessageCount: outbox.filter((item) => item.acknowledged !== true).length,
      events: events.slice(-10)
    };
  }
}
// ★★★★★ 主动消息角色对象 END ★★★★★

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      console.log("cors_preflight", {
        origin: request.headers.get("origin") || ""
      });
      return withCors(new Response(null, { status: 204 }), request, env);
    }

    // ★ 部署页面若保留了示例口令，必须拒绝服务；不能把占位值当成真实鉴权密钥。
    if (!isAppTokenConfigured(env)) {
      return json({ error: "app_token_not_configured" }, 503, request, env);
    }

    if (!isAllowedOrigin(request, env)) {
      console.warn("forbidden_origin", {
        origin: request.headers.get("origin") || "",
        path: url.pathname
      });
      return json({ error: "forbidden_origin" }, 403, request, env);
    }

    if (!isAuthorized(request, env)) {
      console.warn("unauthorized_request", {
        method: request.method,
        path: url.pathname
      });
      return json({ error: "unauthorized" }, 401, request, env);
    }

    try {
      // ★ 连接检测先读版本，不调用模型，也不会消耗上游 API 额度。
      if (request.method === "GET" && url.pathname === "/meta") {
        return json({
          ok: true,
          version: WORKER_VERSION,
          protocolVersion: WORKER_PROTOCOL_VERSION,
          features: {
            jobs: !!(env.CHAT_JOBS && env.CHAT_JOB_QUEUE && env.CHAT_JOB_OBJECT),
            proactive: !!env.CHAT_JOB_OBJECT,
            encryptedClientKey: true
          }
        }, 200, request, env);
      }

      if (request.method === "POST" && url.pathname === "/jobs") {
        return await createJob(request, env);
      }

      const jobMatch = url.pathname.match(/^\/jobs\/([a-f0-9-]{36})$/i);
      if (jobMatch && request.method === "GET") {
        return await getJob(jobMatch[1], request, env);
      }

      if (jobMatch && request.method === "DELETE") {
        return await deleteJob(jobMatch[1], request, env);
      }

      // ★ 主动消息页面用真实能力探测替代本地猜测：同时检查新版路由、现有 DO binding 和所选凭据模式。
      if (request.method === "POST" && url.pathname === "/proactive/capabilities") {
        if (!env.CHAT_JOB_OBJECT && !env.PROACTIVE_CHARACTER_OBJECT) {
          return json({ ok: false, error: "proactive_binding_missing" }, 503, request, env);
        }
        const body = await request.json();
        const credentialMode = body.credential_mode === "stored_client_key" ? "stored_client_key" : "server_secret";
        const apiUrls = Array.isArray(body.api_urls) ? [...new Set(body.api_urls.map(normalizeUrl).filter(Boolean))].slice(0, 20) : [];
        if (!apiUrls.length) {
          return json({ ok: false, error: "upstream_provider_url_missing" }, 400, request, env);
        }
        const results = apiUrls.map((apiUrl) => {
          // ★ 私人 Worker 模式的 Key 会在角色同步时加密保存；能力探测只验证 URL 安全性。
          const upstream = credentialMode === "stored_client_key"
            ? resolveUpstream(apiUrl, "capability_probe", "client_key", env)
            : resolveUpstream(apiUrl, "", "server_secret", env);
          return upstream.ok
            ? { ok: true, apiUrl, provider: upstream.provider.id }
            : { ok: false, apiUrl, error: upstream.error, provider: upstream.providerId || "" };
        });
        const failed = results.find((item) => !item.ok);
        if (failed) {
          return json({ ok: false, error: failed.error, providers: results }, 400, request, env);
        }
        return json({
          ok: true,
          proactiveApi: true,
          proactiveVersion: 4,
          sharedJobObject: !!env.CHAT_JOB_OBJECT,
          encryptedClientKey: true,
          providers: results
        }, 200, request, env);
      }

      // ★ 新版优先复用 CHAT_JOB_OBJECT；旧 binding 只在读取/确认消息时参与，帮助已部署用户排空旧 outbox。
      const proactiveMatch = url.pathname.match(/^\/proactive\/([^/]+)\/(sync|activity|status|request-log|messages|run|reroll|ack)$/i);
      if (proactiveMatch && (env.CHAT_JOB_OBJECT || env.PROACTIVE_CHARACTER_OBJECT)) {
        const objectName = decodeURIComponent(proactiveMatch[1]);
        const action = proactiveMatch[2].toLowerCase();
        const requestCopy = ["ack", "sync"].includes(action) && env.PROACTIVE_CHARACTER_OBJECT ? request.clone() : null;
        const primaryNamespace = env.CHAT_JOB_OBJECT || env.PROACTIVE_CHARACTER_OBJECT;
        const primaryObjectName = env.CHAT_JOB_OBJECT ? `proactive:${objectName}` : objectName;
        const primaryId = primaryNamespace.idFromName(primaryObjectName);
        const primaryResponse = await primaryNamespace.get(primaryId).fetch(request);

        if (primaryResponse.ok && env.CHAT_JOB_OBJECT && env.PROACTIVE_CHARACTER_OBJECT && action === "sync" && requestCopy) {
          // ★ 前端会先拉取并确认旧 outbox，再执行 sync；此时顺手停掉旧对象 Alarm，避免升级后新旧对象双跑。
          const legacyCapsule = await requestCopy.json();
          const legacyId = env.PROACTIVE_CHARACTER_OBJECT.idFromName(objectName);
          await env.PROACTIVE_CHARACTER_OBJECT.get(legacyId).fetch("https://proactive.local/sync", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...legacyCapsule, enabled: false })
          });
        }

        if (env.CHAT_JOB_OBJECT && env.PROACTIVE_CHARACTER_OBJECT && (action === "messages" || action === "ack")) {
          const legacyId = env.PROACTIVE_CHARACTER_OBJECT.idFromName(objectName);
          const legacyResponse = await env.PROACTIVE_CHARACTER_OBJECT.get(legacyId).fetch(requestCopy || request);
          if (action === "messages") {
            const primaryData = primaryResponse.ok ? await primaryResponse.json() : { messages: [] };
            const legacyData = legacyResponse.ok ? await legacyResponse.json() : { messages: [] };
            const messages = [...(primaryData.messages || []), ...(legacyData.messages || [])];
            const unique = [...new Map(messages.map((item) => [String(item.messageId || ""), item])).values()];
            return json({ messages: unique }, 200, request, env);
          }
        }
        return withCors(primaryResponse, request, env);
      }

      return json({ error: "not_found" }, 404, request, env);
    } catch (error) {
      console.error("worker_internal_error", {
        method: request.method,
        path: url.pathname,
        error: error?.message || String(error)
      });
      return json({ error: "internal_error" }, 500, request, env);
    }
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      await consumeQueuedJob(message, env);
      message.ack?.();
    }
  }
};

async function createJob(request, env, proactiveReplacement = null) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    console.warn("job_request_too_large", {
      contentLength,
      maxBodyBytes: MAX_BODY_BYTES
    });
    return json({
      error: "request_too_large",
      content_length: contentLength,
      max_body_bytes: MAX_BODY_BYTES
    }, 413, request, env);
  }

  const payload = await request.json();
  const authMode = sanitizeAuthMode(payload.auth_mode);
  const upstream = resolveUpstream(payload.api_url, payload.api_key, authMode, env);
  if (!upstream.ok) {
    console.warn("job_upstream_not_configured", {
      apiUrl: sanitizeLogText(payload.api_url),
      authMode,
      providerId: upstream.providerId || "",
      reason: upstream.error
    });
    return json({
      error: upstream.error,
      provider: upstream.providerId || null
    }, 400, request, env);
  }

  const model = sanitizeModel(payload.model || env.DEFAULT_MODEL);
  const allowedModels = getAllowedModels(env);
  if (allowedModels && !allowedModels.has(model)) {
    console.warn("job_model_not_allowed", { model });
    return json({ error: "model_not_allowed" }, 400, request, env);
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    console.warn("job_messages_required", {
      messagesType: typeof payload.messages
    });
    return json({ error: "messages_required" }, 400, request, env);
  }

  const messages = sanitizeMessages(payload.messages);
  const requestBodyExtra = sanitizeRequestBodyExtra(payload.request_body_extra);
  const vision = sanitizeVisionPayload(payload.vision, authMode);
  const imageDiagnostics = getImageDiagnostics(messages, vision);
  const agent = sanitizeAgentPayload(payload.agent, authMode);
  const agentModelForAllowList = agent?.todoManager ? sanitizeModel(agent.todoManager.model || env.DEFAULT_MODEL) : "";
  if (allowedModels && agentModelForAllowList && !allowedModels.has(agentModelForAllowList)) {
    console.warn("job_agent_model_not_allowed", { model: agentModelForAllowList });
    return json({ error: "agent_model_not_allowed" }, 400, request, env);
  }
  if (requestBodyExtra === null) {
    console.warn("job_request_body_extra_invalid", {
      extraType: typeof payload.request_body_extra
    });
    return json({ error: "request_body_extra_invalid" }, 400, request, env);
  }

  const ttlSeconds = sanitizeTtlSeconds(payload.ttl_hours);
  const jobId = crypto.randomUUID();
  console.log("job_create", {
    jobId: shortJobId(jobId),
    provider: upstream.provider.id,
    authMode,
    model,
    messageCount: messages.length,
    ...imageDiagnostics,
    requestBodyExtraKeys: Object.keys(requestBodyExtra),
    hasAgent: !!agent?.todoManager,
    ttlSeconds,
    contentLength
  });

  const createEvent = buildJobEvent("job_create", {
    provider: upstream.provider.id,
    authMode,
    model,
    messageCount: messages.length,
    ...imageDiagnostics,
    requestBodyExtraKeys: Object.keys(requestBodyExtra),
    hasAgent: !!agent?.todoManager,
    ttlSeconds,
    contentLength
  });

  await initJobState(jobId, env, {
    status: "running",
    agent_status: agent?.todoManager ? "pending" : "disabled",
    agent_actions: [],
    agent_prompt: "",
    agent_error: "",
    createdAt: Date.now(),
    ttlSeconds,
    events: [createEvent]
  });

  const jobPayload = {
    upstream: upstream.provider,
    // ★ 只有角色 DO 创建的 reroll job 才能携带替换定位，普通外部 job 无权指定回填目标。
    proactiveReplacement,
    // ★ 后台普通回复完成后可直接补入同一安装实例的主动角色对象，页面关闭也能衔接上下文。
    proactiveObjectName: String(payload.proactive_object_name || "").slice(0, 240),
    messages,
    model,
    temperature: clampNumber(payload.temperature, 0, 2, 1),
    max_tokens: clampInteger(payload.max_tokens, 1, 8192, 2048),
    request_body_extra: requestBodyExtra,
    vision,
    agent,
    dynamicContextInsertMode: sanitizeDynamicContextInsertMode(payload.dynamic_context_insert_mode),
    // ★ sanitizeMessages 只保留末尾 80 条，目标索引必须随裁剪平移。
    requestUserMessageIndex: Number.isInteger(payload.request_user_message_index) && payload.request_user_message_index >= 0
      ? payload.request_user_message_index - Math.max(0, payload.messages.length - messages.length) : -1,
    ttlSeconds
  };

  const payloadTtlSeconds = getPayloadTtlSeconds(ttlSeconds);
  await env.CHAT_JOBS.put(payloadKey(jobId), JSON.stringify(jobPayload), {
    expirationTtl: payloadTtlSeconds
  });
  await appendJobEvent(jobId, env, "job_payload_store", {
    payloadTtlSeconds
  }, ttlSeconds);

  try {
    if (!env.CHAT_JOB_QUEUE || typeof env.CHAT_JOB_QUEUE.send !== "function") {
      throw new Error("chat_job_queue_missing");
    }
    await env.CHAT_JOB_QUEUE.send({ jobId });
    await appendJobEvent(jobId, env, "job_enqueue", {}, ttlSeconds);
  } catch (error) {
    const errorMessage = error?.message || String(error);
    console.error("job_queue_send_error", {
      jobId: shortJobId(jobId),
      error: errorMessage
    });
    const job = await buildJobWithEvent(jobId, env, {
      status: "failed",
      error: "job_queue_send_error",
      finishedAt: Date.now()
    }, "job_queue_send_error", {
      error: sanitizeLogText(errorMessage)
    });
    await deleteJobPayload(jobId, env, ttlSeconds);
    return json({ error: "job_queue_send_error", jobId }, 500, request, env);
  }

  const job = await readJobState(jobId, env);
  return json({ jobId, status: "running", ttlSeconds, events: job?.events || [createEvent] }, 202, request, env);
}

async function getJob(jobId, request, env) {
  const job = await readJobState(jobId, env);
  if (!job) {
    console.log("job_get_not_found", { jobId: shortJobId(jobId) });
    return json({ error: "not_found" }, 404, request, env);
  }

  console.log("job_get", {
    jobId: shortJobId(jobId),
    status: job.status
  });
  return json(job, 200, request, env);
}

async function deleteJob(jobId, request, env) {
  await deleteJobState(jobId, env);
  await env.CHAT_JOBS.delete(payloadKey(jobId));
  console.log("job_delete", { jobId: shortJobId(jobId) });
  return json({ ok: true }, 200, request, env);
}

// ★★★★★ Queue 后台长任务 START ★★★★★
// Queue 消息只保存 jobId，完整请求体临时放在 job_payload:<jobId>。
// 这样可以绕开 waitUntil() 的 30 秒后台续跑限制，同时避开 Queue 128KB 消息体上限。
// 无论模型成功还是失败，finally 都会尽量删除 payload，减少 client_key 模式下模型 Key 的停留时间。
async function consumeQueuedJob(message, env) {
  const jobId = message?.body?.jobId;
  if (!jobId) {
    console.warn("job_consume_error", {
      error: "job_id_missing"
    });
    return;
  }

  console.log("job_consume_start", { jobId: shortJobId(jobId) });
  let ttlSeconds = DEFAULT_JOB_TTL_HOURS * 3600;

  try {
    const currentJob = await readJobState(jobId, env);
    ttlSeconds = Number(currentJob?.ttlSeconds || ttlSeconds);
    await appendJobEvent(jobId, env, "job_consume_start", {}, ttlSeconds);

    const payload = await env.CHAT_JOBS.get(payloadKey(jobId), "json");
    if (!payload) {
      console.warn("job_payload_missing", { jobId: shortJobId(jobId) });
      const job = await buildJobWithEvent(jobId, env, {
        status: "failed",
        error: "job_payload_missing",
        finishedAt: Date.now()
      }, "job_payload_missing", {});
      return;
    }

    await runJob(jobId, payload, env);
    const afterRunJob = await readJobState(jobId, env);
    await appendJobEvent(jobId, env, "job_consume_done", {
      status: afterRunJob?.status || ""
    }, ttlSeconds);
  } catch (error) {
    const errorMessage = error?.message || String(error);
    console.error("job_consume_error", {
      jobId: shortJobId(jobId),
      error: errorMessage
    });
    const job = await buildJobWithEvent(jobId, env, {
      status: "failed",
      error: "job_consume_error",
      finishedAt: Date.now()
    }, "job_consume_error", {
      error: sanitizeLogText(errorMessage)
    });
  } finally {
    await deleteJobPayload(jobId, env, ttlSeconds);
  }
}
// ★★★★★ Queue 后台长任务 END ★★★★★

async function runJob(jobId, body, env) {
  try {
    const imageDiagnostics = getImageDiagnostics(body.messages, body.vision);
    await appendJobEvent(jobId, env, "job_run_start", {
      provider: body.upstream.id,
      authMode: body.upstream.authMode,
      model: body.model,
      messageCount: body.messages.length,
      ...imageDiagnostics,
      requestBodyExtraKeys: Object.keys(body.request_body_extra || {}),
      ttlSeconds: body.ttlSeconds
    }, body.ttlSeconds);

    console.log("job_run_start", {
      jobId: shortJobId(jobId),
      provider: body.upstream.id,
      authMode: body.upstream.authMode,
      model: body.model,
      messageCount: body.messages.length,
      ...imageDiagnostics,
      requestBodyExtraKeys: Object.keys(body.request_body_extra || {}),
      ttlSeconds: body.ttlSeconds
    });

    let imageDescription = null;
    let agentActions = [];
    let agentPrompt = "";
    let agentStatus = body.agent?.todoManager ? "pending" : "disabled";
    let multimodalFallback = false;
    let messagesForChat = body.messages;
    if (body.vision) {
      imageDescription = await analyzeVisionImage(body.vision, env, jobId, body.ttlSeconds);
      messagesForChat = injectImageDescription(body.messages, imageDescription, body.requestUserMessageIndex);
    }

    if (body.agent?.todoManager) {
      // ★ 后台 Agent 分段状态：
      // TODO 管理跑完后先把 action 写进 job，让前端不用等主模型回复就能同步执行。
      await buildJobWithEvent(jobId, env, {
        agent_status: "running",
        agent_actions: [],
        agent_startedAt: Date.now()
      }, "agent_todo_stage_start", {
        model: body.agent.todoManager.model || ""
      });

      const agentResult = await runTodoManagerAgent(body.agent.todoManager, env, jobId, body.ttlSeconds);
      agentPrompt = agentResult.prompt || "";
      if (agentResult.prompt) {
        messagesForChat = injectVolatilePrompt(
          messagesForChat,
          agentResult.prompt,
          body.dynamicContextInsertMode,
          body.requestUserMessageIndex
        );
      }
      agentActions = agentResult.actions || [];
      agentStatus = agentResult.failed ? "failed" : "done";

      await buildJobWithEvent(jobId, env, {
        agent_status: agentStatus,
        agent_actions: agentActions,
        agent_prompt: agentPrompt,
        agent_error: agentResult.failed ? sanitizeLogText(agentResult.error || "") : "",
        agent_finishedAt: Date.now()
      }, agentResult.failed ? "agent_todo_stage_failed" : "agent_todo_stage_done", {
        intent: agentResult.intent || "",
        actionCount: agentActions.length,
        hasPrompt: !!agentResult.prompt,
        error: agentResult.failed ? sanitizeLogText(agentResult.error || "") : ""
      });
    }

    // ★ messages 和 stream 属于程序控制字段：附加参数可以覆盖温度等高级配置，但不能抹掉本轮图片。
    const buildUpstreamBody = (messages) => ({
      model: body.model,
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      ...(body.request_body_extra || {}),
      messages,
      stream: false
    });
    let upstreamBody = buildUpstreamBody(messagesForChat);
    let upstreamBodyText = JSON.stringify(upstreamBody);

    // ★ 上游诊断只记录路由和请求规模，不记录聊天正文、API Key 或 URL 查询参数。
    console.log("chat_upstream_request", {
      jobId: shortJobId(jobId),
      provider: body.upstream.id,
      url: sanitizeUrlForLog(body.upstream.url),
      model: body.model,
      method: "POST",
      headers: {
        authorization: body.upstream.apiKey ? "Bearer [已设置]" : "[未设置]",
        contentType: "application/json",
        accept: "application/json",
        acceptLanguage: "en-US,en",
        userAgent: "TeleWindy/1.0"
      },
      messageCount: messagesForChat.length,
      bodyChars: upstreamBodyText.length
    });

    let response = await fetchChatCompletion(body.upstream, upstreamBodyText, "chat_upstream");
    let responseDiagnostics = getUpstreamResponseDiagnostics(response);
    console.log("chat_upstream_response", {
      jobId: shortJobId(jobId),
      provider: body.upstream.id,
      ...responseDiagnostics
    });

    if (!response.ok) {
      let upstreamErrorText = sanitizeLogText(await response.text());

      // ★ 多模态请求被明确拒绝时，只去图重试一次；鉴权、限流和服务故障不会进入这个分支。
      if (hasMultimodalImage(messagesForChat) && isMultimodalUnsupportedError(response.status, upstreamErrorText)) {
        messagesForChat = buildMultimodalFallbackMessages(messagesForChat);
        upstreamBody = buildUpstreamBody(messagesForChat);
        upstreamBodyText = JSON.stringify(upstreamBody);
        response = await fetchChatCompletion(body.upstream, upstreamBodyText, "chat_upstream_fallback");
        responseDiagnostics = getUpstreamResponseDiagnostics(response);
        console.log("chat_upstream_fallback_response", {
          jobId: shortJobId(jobId),
          provider: body.upstream.id,
          ...responseDiagnostics
        });
        multimodalFallback = response.ok;
        if (!response.ok) upstreamErrorText = sanitizeLogText(await response.text());
      }

      if (!response.ok) {
        // ★★★★★ 上游错误原文回传 START ★★★★★
        // 前端需要看到一小段真实错误，才能判断是不是“多 system 不兼容”，并提示切换 user 兼容模式。
        const upstreamError = upstreamErrorText
          ? `upstream_${response.status}: ${upstreamErrorText}`
          : `upstream_${response.status}`;
        console.warn("job_upstream_failed", {
          jobId: shortJobId(jobId),
          provider: body.upstream.id,
          status: response.status,
          ...responseDiagnostics,
          error: upstreamErrorText
        });
        const job = await buildJobWithEvent(jobId, env, {
          status: "failed",
          error: upstreamError,
          finishedAt: Date.now()
        }, "job_upstream_failed", {
          provider: body.upstream.id,
          status: response.status,
          ...responseDiagnostics,
          error: upstreamErrorText
        });
        // ★★★★★ 上游错误原文回传 END ★★★★★
        return;
      }
    }

    const data = await response.json();
    const content = extractAssistantContent(data);
    console.log("job_run_done", {
      jobId: shortJobId(jobId),
      resultLength: content.trim().length,
      hasUsage: !!data.usage
    });

    if (body.proactiveReplacement) {
      // ★ 空正文按生成失败处理，旧消息保留；回填只替换指定 ID，不计作新的主动发送。
      if (!stripProactiveRerollText(content)) throw new Error("proactive_reroll_empty");
      const namespace = env.CHAT_JOB_OBJECT || env.PROACTIVE_CHARACTER_OBJECT;
      if (!namespace) throw new Error("proactive_binding_missing");
      const replacement = body.proactiveReplacement;
      const objectName = env.CHAT_JOB_OBJECT ? `proactive:${replacement.objectName}` : replacement.objectName;
      const result = await namespace.get(namespace.idFromName(objectName)).fetch("https://proactive.local/proactive/replace-message", {
        method: "POST", body: JSON.stringify({ ...replacement, content })
      });
      if (!result.ok) throw new Error(`proactive_replace_failed_${result.status}`);
    }

    if (body.proactiveObjectName) {
      try {
        const namespace = env.CHAT_JOB_OBJECT || env.PROACTIVE_CHARACTER_OBJECT;
        if (namespace) {
          const objectName = env.CHAT_JOB_OBJECT ? `proactive:${body.proactiveObjectName}` : body.proactiveObjectName;
          const objectId = namespace.idFromName(objectName);
          const appendResponse = await namespace.get(objectId).fetch("https://proactive.local/proactive/append-chat-reply", {
            method: "POST",
            body: JSON.stringify({ messageId: `job_${jobId}`, content, eventAt: Date.now() })
          });
          if (!appendResponse.ok && appendResponse.status !== 409) throw new Error(`append_status_${appendResponse.status}`);
        }
      } catch (appendError) {
        // ★ 主聊天回复必须正常完成；补写失败时，前端下次恢复后仍会同步完整快照。
        console.warn("proactive_chat_reply_append_failed", { jobId: shortJobId(jobId), error: sanitizeLogText(appendError?.message || String(appendError)) });
      }
    }

    const job = await buildJobWithEvent(jobId, env, {
      status: "done",
      result: content.trim(),
      image_description: imageDescription,
      multimodal_fallback: multimodalFallback,
      agent_status: agentStatus,
      agent_actions: agentActions,
      agent_prompt: agentPrompt,
      usage: data.usage || null,
      finishedAt: Date.now()
    }, "job_run_done", {
      resultLength: content.trim().length,
      hasUsage: !!data.usage
    });
  } catch (error) {
    const errorMessage = error?.message || String(error);
    console.error("job_run_error", {
      jobId: shortJobId(jobId),
      error: errorMessage
    });
    const job = await buildJobWithEvent(jobId, env, {
      status: "failed",
      error: errorMessage.includes("chat_upstream_timeout")
        ? "chat_upstream_timeout"
        : "network_or_worker_error",
      finishedAt: Date.now()
    }, "job_run_error", {
      error: sanitizeLogText(errorMessage)
    });
  }
}

// ★★★★★ 后台识图 START ★★★★★
// 这一组函数只负责“先看图，再把图片描述塞回聊天上下文”：
// 1. Queue 执行前，原图 base64 和视觉 Key 随完整任务载荷临时写入 KV；
// 2. 处理完成会尽量立即删除载荷，异常时由一小时 TTL 清理；
// 3. image_description 与最终回复保存在 job 的 Durable Object，供前端补回历史记录。
async function analyzeVisionImage(vision, env, jobId, ttlSeconds) {
  try {
    if (!vision.url) throw new Error("vision_url_missing");
    if (!vision.model) throw new Error("vision_model_missing");

    const upstream = resolveUpstream(vision.url, vision.key, vision.authMode, env);
    if (!upstream.ok) {
      throw new Error(upstream.error || "vision_upstream_not_configured");
    }

    const payload = {
      model: vision.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: vision.prompt || "描述这张图片" },
            { type: "image_url", image_url: { url: vision.image } }
          ]
        }
      ],
      max_tokens: 8190,
      stream: false
    };

    const response = await fetchWithTimeout(upstream.provider.url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${upstream.provider.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }, UPSTREAM_TIMEOUT_MS, "vision_upstream");

    if (!response.ok) {
      throw new Error(`vision_upstream_${response.status}`);
    }

    const data = await response.json();
    const description = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!description) throw new Error("vision_empty_description");
    return description;
  } catch (error) {
    console.warn("vision_analyze_failed", {
      error: error?.message || String(error),
      model: vision.model || "",
      authMode: vision.authMode || ""
    });
    if (jobId) {
      await appendJobEvent(jobId, env, "vision_analyze_failed", {
        error: sanitizeLogText(error?.message || String(error)),
        model: vision.model || "",
        authMode: vision.authMode || ""
      }, ttlSeconds);
    }
    return visionFallbackDescription();
  }
}

// ★ 与前端独立 roll 使用同一正文规则，不把模型思考或自带时间戳写入原消息。
function stripProactiveRerollText(content) {
  return String(content || "")
    .replace(/<(?:think|thinking|thought)[^>]*>[\s\S]*?(?:<\/(?:think|thinking|thought)>|$)/gi, "").trim()
    .replace(/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\]\s*/, "").trim();
}

function injectImageDescription(messages, description, userMessageIndex) {
  const nextMessages = messages.map((message) => ({ ...message }));
  // ★ 描述只能写入前端指定的本轮图片消息，不能倒查并污染上一轮 user。
  // 老请求未携带索引时，只兼容末尾本身就是 user 的情形。
  const index = Number.isInteger(userMessageIndex) && userMessageIndex >= 0
    ? userMessageIndex : nextMessages.length - 1;
  if (nextMessages[index]?.role !== "user") throw new Error("vision_user_message_missing");
  nextMessages[index].content = `${nextMessages[index].content || ""}\n\n[System Info: 对方发送了一张图片，图片内容描述: ${description}]`;
  return nextMessages;
}

function sanitizeVisionPayload(vision, defaultAuthMode) {
  if (!vision || typeof vision !== "object" || Array.isArray(vision)) return null;
  const image = String(vision.image || "").trim();
  if (!image) return null;

  const authMode = sanitizeAuthMode(vision.auth_mode || defaultAuthMode);
  return {
    image,
    url: normalizeUrl(vision.url),
    key: authMode === "server_secret" ? "" : String(vision.key || ""),
    authMode,
    model: sanitizeModel(vision.model || ""),
    prompt: String(vision.prompt || "描述这张图片").slice(0, 4000)
  };
}

function sanitizeDynamicContextInsertMode(value) {
  return ["auto", "system", "user"].includes(value) ? value : "auto";
}

function visionFallbackDescription() {
  return "（系统提示：用户发送了一张图片，但由于未配置视觉模型或网络错误，无法提供图片内容的文本描述。请根据用户的文字上下文进行回复，如果需要，可以礼貌地询问图片内容。）";
}
// ★★★★★ 后台识图 END ★★★★★

// ★★★★★ 后台 Agent：TODO 管理 START ★★★★★
async function runTodoManagerAgent(agent, env, jobId, ttlSeconds) {
  try {
    const model = sanitizeModel(agent.model || env.DEFAULT_MODEL);
    const upstream = resolveUpstream(agent.apiUrl, agent.apiKey, agent.authMode, env);
    if (!upstream.ok) throw new Error(upstream.error || "agent_upstream_not_configured");

    await appendJobEvent(jobId, env, "agent_todo_start", {
      model,
      todoCount: agent.todoSnapshot.length
    }, ttlSeconds);

    // ★★★★★ 后台 Agent：总路由先判定 START ★★★★★
    // Worker 路径也先只发送轻量路由 prompt；NONE 时直接跳过 TODO executor。
    const routerResponse = await fetchWithTimeout(upstream.provider.url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${upstream.provider.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: buildAgentRouterMessages(agent),
        ...(agent.requestBodyExtra || {}),
        temperature: 0,
        max_tokens: Math.min(agent.maxTokens || 1200, 180),
        stream: false
      })
    }, UPSTREAM_TIMEOUT_MS, "agent_router_upstream");

    if (!routerResponse.ok) throw new Error(`agent_router_upstream_${routerResponse.status}`);

    const routerData = await routerResponse.json();
    const rawRouteText = extractAssistantContent(routerData);
    const agentRoute = parseAgentRouterResult(rawRouteText);
    if (agentRoute.intent === "NONE" || agentRoute.intent === "ASK_CONFIRMATION") {
      await appendJobEvent(jobId, env, "agent_todo_done", {
        intent: agentRoute.intent,
        actionCount: 0
      }, ttlSeconds);
      return { prompt: "", actions: [], intent: agentRoute.intent };
    }
    if (agentRoute.agent !== "todo_manager") throw new Error(`agent_unknown_route:${agentRoute.agent || "empty"}`);
    // ★★★★★ 后台 Agent：总路由先判定 END ★★★★★

    // ★★★★★ 后台 Agent：TODO 专用执行 START ★★★★★
    // 命中 TODO 后才发送 TODO 详细规则和 TODO 快照，保持多 Agent 扩展时的成本可控。
    const response = await fetchWithTimeout(upstream.provider.url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${upstream.provider.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: buildTodoAgentMessages(agent),
        temperature: agent.temperature,
        max_tokens: agent.maxTokens,
        ...(agent.requestBodyExtra || {}),
        stream: false
      })
    }, UPSTREAM_TIMEOUT_MS, "agent_todo_upstream");

    if (!response.ok) throw new Error(`agent_todo_upstream_${response.status}`);

    const data = await response.json();
    const rawText = extractAssistantContent(data);
    const routerResult = parseTodoAgentResult(rawText);
    const execution = executeTodoAgentResult(routerResult, agent.todoSnapshot);
    execution.intent = routerResult.intent || "";
    // ★★★★★ 后台 Agent：TODO 专用执行 END ★★★★★

    await appendJobEvent(jobId, env, "agent_todo_done", {
      intent: routerResult.intent,
      actionCount: execution.actions.length
    }, ttlSeconds);

    return execution;
  } catch (error) {
    const errorMessage = error?.message || String(error);
    console.warn("agent_todo_failed", {
      error: errorMessage
    });
    await appendJobEvent(jobId, env, "agent_todo_failed", {
      error: sanitizeLogText(errorMessage)
    }, ttlSeconds);
    return { prompt: "", actions: [], failed: true, error: errorMessage };
  }
}

function buildAgentRouterMessages(agent) {
  const systemPrompt = [
    "你是 TeleWindy 的 Agent 总路由，只判断用户这句话是否需要调用某个 Agent。",
    "你只做选择，不执行任务，不解析任务字段，不输出 Markdown，不解释，只输出 JSON。",
    "",
    "intent 只能选择：NONE、USE_AGENT、ASK_CONFIRMATION。",
    "",
    "可用 Agent：",
    "- todo_manager：用户明确要求记录、提醒、安排 TODO；或明确表示某个 TODO 完成、延期、修改、取消、不需要、删除。",
    "",
    "规则：",
    "- 普通聊天、情绪表达、角色互动、闲聊陪伴，选 NONE。",
    "- 只有用户明确要求操作某个能力时，才选 USE_AGENT。",
    "- 用户只是提到一件事，但没有要求记录/提醒/安排，不要调用 TODO。",
    "- 如果看起来需要 Agent，但无法判断应该调用哪个 Agent，选 ASK_CONFIRMATION。",
    "- 不要编造用户没有说的任务、日期、目标或 Agent。",
    "",
    "JSON 格式：",
    "{\"intent\":\"USE_AGENT\",\"agent\":\"todo_manager\",\"confirmation\":{\"message\":\"\"}}",
    "",
    "字段说明：",
    "- NONE 时 agent 留空字符串。",
    "- USE_AGENT 时 agent 必须是可用 Agent 之一。",
    "- ASK_CONFIRMATION 时 confirmation.message 写给前端提示用的一句话。"
  ].join("\n");

  // ★★★★★ 后台 Agent：总路由 prompt START ★★★★★
  // 固定路由表放 system，本轮角色和用户原话放 user；这里不携带 TODO 快照。
  const userPrompt = [
    "【当前角色】",
    agent.contactName || "未命名角色",
    "",
    "【用户当前消息】",
    agent.userText || ""
  ].join("\n");
  // ★★★★★ 后台 Agent：总路由 prompt END ★★★★★

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];
}

function parseAgentRouterResult(rawText) {
  const data = extractJsonObject(rawText);
  const intent = String(data.intent || "").trim().toUpperCase();
  if (!["NONE", "USE_AGENT", "ASK_CONFIRMATION"].includes(intent)) {
    throw new Error(`agent_router_unknown_intent:${intent || "empty"}`);
  }

  const selectedAgent = String(data.agent || "").trim();
  if (intent === "USE_AGENT" && selectedAgent !== "todo_manager") {
    throw new Error(`agent_router_unknown_agent:${selectedAgent || "empty"}`);
  }

  return {
    intent,
    agent: intent === "USE_AGENT" ? selectedAgent : "",
    confirmation: data.confirmation && typeof data.confirmation === "object" ? data.confirmation : {}
  };
}

function buildTodoAgentMessages(agent) {
  const todayKey = getDateKey(new Date());
  const tomorrowKey = addDays(todayKey, 1);
  const systemPrompt = [
    "你是 TeleWindy 的 TODO 管理 Agent，只判断用户这句话是否需要操作 TODO。",
    "你只能从 intent 枚举中选择：NONE、MANAGE_TODO、ASK_CONFIRMATION。",
    "不要打分，不要输出 Markdown，不要解释，只输出 JSON。",
    "",
    "operation.action 只能选择：create、complete、cancel、restore、reschedule、rename、retime。",
    "",
    "规则：",
    "- 普通聊天、情绪表达、角色互动，选 NONE。",
    "- 只有用户明确要求记录、提醒、安排任务时，输出 MANAGE_TODO 且 action=create。",
    "- 用户明确表示某个 TODO 完成时，输出 MANAGE_TODO 且 action=complete。",
    "- 用户明确表示某个 TODO 延期、修改、取消、不需要、删除时，输出 MANAGE_TODO 和对应 action。",
    "- 用户说删除、取消、不需要某个 TODO 时，不要真正删除，统一输出 action=cancel。",
    "- 找不到唯一目标、信息不足或高风险覆盖操作，选 ASK_CONFIRMATION。",
    "- 不要编造用户没有说的日期、任务或目标。",
    "- 多个事项拆成多个 operations，不要合并。",
    "",
    "JSON 格式：",
    "{\"intent\":\"MANAGE_TODO\",\"operations\":[{\"action\":\"create\",\"text\":\"继续写论文\",\"dateKey\":\"2026-06-10\",\"startTime\":\"\",\"endTime\":\"\"},{\"action\":\"complete\",\"targetText\":\"买东方树叶\",\"dateKey\":\"2026-06-10\"},{\"action\":\"reschedule\",\"targetText\":\"喝茶\",\"dateKey\":\"2026-06-10\",\"newDateKey\":\"2026-06-29\"}],\"confirmation\":{\"message\":\"\"}}",
    "",
    "字段说明：",
    "- create 填 text/dateKey/startTime/endTime；没有明确时间就留空 startTime/endTime。",
    "- complete/cancel/restore/reschedule/rename/retime 必须填写 targetText 或 targetTodoId。",
    "- 能从现有 TODO 里确定 id 时，优先填写 targetTodoId。",
    "- reschedule 填 newDateKey；rename 填 newText；retime 填 startTime/endTime。",
    "- ASK_CONFIRMATION 时 confirmation.message 写给前端确认/提示用的一句话。",
    "- 不需要的对象字段留空字符串。"
  ].join("\n");

  // ★ 缓存友好：固定规则放 system，日期/TODO 快照/用户原话放 user，尽量提高前缀缓存命中。
  const userPrompt = [
    `今天日期：${todayKey}`,
    `明天日期：${tomorrowKey}`,
    "",
    "【当前角色】",
    agent.contactName || "未命名角色",
    "",
    "【现有 TODO】",
    JSON.stringify(agent.todoSnapshot, null, 2),
    "",
    "【用户当前消息】",
    agent.userText || ""
  ].join("\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];
}

function parseTodoAgentResult(rawText) {
  const data = extractJsonObject(rawText);
  const intent = String(data.intent || "").trim().toUpperCase();
  if (!["NONE", "MANAGE_TODO", "CREATE_TODO", "UPDATE_TODO", "ASK_CONFIRMATION"].includes(intent)) {
    throw new Error(`agent_unknown_intent:${intent || "empty"}`);
  }
  return {
    intent,
    todo: data.todo && typeof data.todo === "object" ? data.todo : {},
    todos: Array.isArray(data.todos) ? data.todos.filter(item => item && typeof item === "object") : [],
    update: data.update && typeof data.update === "object" ? data.update : {},
    operations: Array.isArray(data.operations)
      ? data.operations.map(item => normalizeTodoAgentOperation(item)).filter(Boolean)
      : buildTodoAgentOperationsFromLegacy(data),
    confirmation: data.confirmation && typeof data.confirmation === "object" ? data.confirmation : {}
  };
}

function executeTodoAgentResult(result, todoSnapshot) {
  if (!result || result.intent === "NONE" || result.intent === "ASK_CONFIRMATION") {
    return { prompt: "", actions: [] };
  }

  if (result.intent === "MANAGE_TODO" || (Array.isArray(result.operations) && result.operations.length)) {
    return executeTodoAgentOperations(result.operations || [], todoSnapshot);
  }

  if (result.intent === "CREATE_TODO") {
    const items = normalizeTodoAgentCreates(result, todoSnapshot);
    if (!items.length) return { prompt: "", actions: [] };
    const createdLines = items.map(item => {
      const timeText = item.startTime && item.endTime ? `，时间 ${item.startTime}-${item.endTime}` : "";
      return `- ${item.text}：${item.dateKey}${timeText}`;
    });
    return {
      prompt: [
        `你已经为用户添加了 ${items.length} 项 TODO。`,
        ...createdLines,
        "请自然回应，不要提到系统、工具或 JSON。"
      ].join("\n"),
      actions: [{
        id: crypto.randomUUID(),
        type: items.length === 1 ? "todo.create" : "todo.create_many",
        ...(items.length === 1 ? { item: items[0] } : { items }),
        notice: items.length === 1 ? `添加了 TODO：${items[0].text}` : `添加了 ${items.length} 个 TODO`
      }]
    };
  }

  const candidates = findTodoAgentCandidates(result, todoSnapshot);
  if (candidates.length !== 1) return { prompt: "", actions: [] };

  const item = candidates[0];
  const update = result.update || {};
  const status = String(update.status || update.action || "").trim().toLowerCase();
  const patch = {};
  let actionText = "更新了 TODO";

  if (["cancelled", "canceled", "cancel", "deleted", "delete", "removed", "remove"].includes(status)) {
    patch.cancelled = true;
    patch.done = false;
    actionText = "取消了 TODO";
  } else if (status === "done" || status === "completed") {
    patch.done = true;
    patch.cancelled = false;
    actionText = "完成了 TODO";
  } else if (status === "active" || status === "undone") {
    patch.done = false;
    patch.cancelled = false;
    actionText = "恢复了 TODO";
  }

  const newText = cleanAgentText(update.newText || "", 120);
  if (newText) patch.text = newText;
  if (isDateKey(update.newDateKey)) {
    patch.dateKey = update.newDateKey;
    if (actionText === "更新了 TODO") actionText = "调整了 TODO 日期";
  }
  if (isTimeValue(update.startTime) && isTimeValue(update.endTime) && update.startTime < update.endTime) {
    patch.startTime = update.startTime;
    patch.endTime = update.endTime;
    if (actionText === "更新了 TODO") actionText = "调整了 TODO 时间";
  }
  if (!Object.keys(patch).length) return { prompt: "", actions: [] };

  const after = { ...item, ...patch };
  return {
    prompt: [
      `你已经为用户${actionText}。`,
      `原内容：${formatTodoAgentLabel(item)}`,
      `现在：${formatTodoAgentLabel(after)}${after.done ? "，状态为已完成" : ""}${after.cancelled ? "，状态为已取消" : ""}。`,
      "请自然回应，不要提到系统、工具或 JSON。"
    ].join("\n"),
    actions: [{
      id: crypto.randomUUID(),
      type: "todo.update",
      todoId: item.id,
      patch,
      notice: `${actionText}：${after.text || item.text}`
    }]
  };
}

function executeTodoAgentOperations(operations, todoSnapshot) {
  const validOperations = Array.isArray(operations) ? operations.filter(Boolean) : [];
  if (!validOperations.length) return { prompt: "", actions: [] };

  const createResult = normalizeTodoAgentCreates({
    todos: validOperations.filter(item => item.action === "create")
  }, todoSnapshot);
  const actions = [];
  const promptLines = [];

  if (createResult.length) {
    actions.push({
      id: crypto.randomUUID(),
      type: createResult.length === 1 ? "todo.create" : "todo.create_many",
      ...(createResult.length === 1 ? { item: createResult[0] } : { items: createResult }),
      notice: createResult.length === 1 ? `添加了 TODO：${createResult[0].text}` : `添加了 ${createResult.length} 个 TODO`
    });
    createResult.forEach(item => {
      const timeText = item.startTime && item.endTime ? `，时间 ${item.startTime}-${item.endTime}` : "";
      promptLines.push(`- 添加：${item.text}：${item.dateKey}${timeText}`);
    });
  }

  validOperations.filter(item => item.action !== "create").forEach(operation => {
    const candidates = findTodoAgentCandidates(operation, todoSnapshot);
    if (candidates.length !== 1) return;
    const item = candidates[0];
    const patchInfo = buildTodoAgentPatchFromOperation(operation);
    if (!patchInfo || !Object.keys(patchInfo.patch).length) return;
    const after = { ...item, ...patchInfo.patch };
    actions.push({
      id: crypto.randomUUID(),
      type: "todo.update",
      todoId: item.id,
      patch: patchInfo.patch,
      notice: `${patchInfo.actionText}：${after.text || item.text}`
    });
    promptLines.push(`- ${getTodoAgentOperationVerb(operation)}：${formatTodoAgentLabel(after)}${after.done ? "，状态为已完成" : ""}${after.cancelled ? "，状态为已取消" : ""}`);
  });

  if (!actions.length) return { prompt: "", actions: [] };
  return {
    prompt: [
      `你已经为用户执行了 ${actions.length} 项 TODO 操作。`,
      ...promptLines,
      "请自然回应，不要提到系统、工具或 JSON。"
    ].join("\n"),
    actions
  };
}

function findTodoAgentCandidates(result, todoSnapshot) {
  const update = result?.update || result || {};
  const matchId = cleanAgentText(update.id || update.todoId || update.targetTodoId || "", 80);
  const matchText = cleanAgentText(update.matchText || update.targetText || update.text || update.oldText || "", 80).toLowerCase();
  const dateKey = isDateKey(update.dateKey) ? update.dateKey : "";
  const includeCancelled = normalizeTodoAgentAction(update.action) === "restore";
  let items = Array.isArray(todoSnapshot) ? todoSnapshot.filter(item => item && item.text && (includeCancelled || item.cancelled !== true)) : [];
  if (matchId) items = items.filter(item => item.id === matchId);
  if (dateKey) items = items.filter(item => item.dateKey === dateKey);
  if (matchText) items = items.filter(item => String(item.text || "").toLowerCase().includes(matchText));
  if (!matchId && !matchText && !dateKey) return [];
  return items;
}

function normalizeTodoAgentAction(value) {
  const action = String(value || "").trim().toLowerCase();
  if (["create", "add", "new"].includes(action)) return "create";
  if (["complete", "done", "completed", "finish", "finished"].includes(action)) return "complete";
  if (["cancel", "cancelled", "canceled", "delete", "deleted", "remove", "removed"].includes(action)) return "cancel";
  if (["restore", "active", "undone", "resume"].includes(action)) return "restore";
  if (["reschedule", "date", "change_date", "move"].includes(action)) return "reschedule";
  if (["rename", "text", "change_text"].includes(action)) return "rename";
  if (["retime", "time", "change_time"].includes(action)) return "retime";
  return "";
}

function normalizeTodoAgentOperation(raw = {}) {
  if (!raw || typeof raw !== "object") return null;
  const status = String(raw.status || "").trim().toLowerCase();
  const action = normalizeTodoAgentAction(raw.action || status || (raw.newDateKey ? "reschedule" : raw.newText ? "rename" : ""));
  if (!action) return null;
  const operation = {
    action,
    text: cleanAgentText(raw.text || raw.title || "", 120),
    dateKey: isDateKey(raw.dateKey) ? raw.dateKey : "",
    startTime: isTimeValue(raw.startTime) ? raw.startTime : "",
    endTime: isTimeValue(raw.endTime) ? raw.endTime : "",
    targetTodoId: cleanAgentText(raw.targetTodoId || raw.todoId || raw.id || "", 80),
    targetText: cleanAgentText(raw.targetText || raw.matchText || raw.oldText || "", 120),
    newText: cleanAgentText(raw.newText || "", 120),
    newDateKey: isDateKey(raw.newDateKey) ? raw.newDateKey : ""
  };
  if (operation.action !== "create" && !operation.targetText && operation.text) {
    operation.targetText = operation.text;
    operation.text = "";
  }
  return operation;
}

function buildTodoAgentOperationsFromLegacy(data = {}) {
  const intent = String(data.intent || "").trim().toUpperCase();
  if (intent === "CREATE_TODO") {
    const rawTodos = Array.isArray(data.todos) && data.todos.length ? data.todos : [data.todo || {}];
    return rawTodos.map(item => normalizeTodoAgentOperation({ ...item, action: "create" })).filter(Boolean);
  }
  if (intent === "UPDATE_TODO") {
    return [normalizeTodoAgentOperation(data.update || {})].filter(Boolean);
  }
  return [];
}

function buildTodoAgentPatchFromOperation(operation = {}) {
  const action = normalizeTodoAgentAction(operation.action);
  const patch = {};
  let actionText = "更新了 TODO";
  if (action === "complete") {
    patch.done = true;
    patch.cancelled = false;
    actionText = "完成了 TODO";
  } else if (action === "cancel") {
    patch.cancelled = true;
    patch.done = false;
    actionText = "取消了 TODO";
  } else if (action === "restore") {
    patch.done = false;
    patch.cancelled = false;
    actionText = "恢复了 TODO";
  }
  const newText = cleanAgentText(operation.newText || "", 120);
  if (newText) {
    patch.text = newText;
    if (actionText === "更新了 TODO") actionText = "改名了 TODO";
  }
  if (isDateKey(operation.newDateKey)) {
    patch.dateKey = operation.newDateKey;
    if (actionText === "更新了 TODO") actionText = "调整了 TODO 日期";
  }
  if (isTimeValue(operation.startTime) && isTimeValue(operation.endTime) && operation.startTime < operation.endTime) {
    patch.startTime = operation.startTime;
    patch.endTime = operation.endTime;
    if (actionText === "更新了 TODO") actionText = "调整了 TODO 时间";
  }
  return { patch, actionText };
}

function getTodoAgentOperationVerb(operation = {}) {
  const action = normalizeTodoAgentAction(operation.action);
  return {
    create: "添加",
    complete: "完成",
    cancel: "取消",
    restore: "恢复",
    reschedule: "改期",
    rename: "改名",
    retime: "改时间"
  }[action] || "更新";
}

function normalizeTodoAgentCreates(result, todoSnapshot = []) {
  const rawTodos = Array.isArray(result?.todos) && result.todos.length
    ? result.todos
    : [result?.todo || {}];
  const seenKeys = new Set((Array.isArray(todoSnapshot) ? todoSnapshot : [])
    .filter(item => item && item.text && item.dateKey)
    .map(item => buildTodoDuplicateKey(item.text, item.dateKey)));

  return rawTodos.map((todo, index) => {
    const text = cleanAgentText(todo.text || todo.title || "", 120);
    if (!text) return null;
    const dateKey = isDateKey(todo.dateKey) ? todo.dateKey : getDateKey(new Date());
    const duplicateKey = buildTodoDuplicateKey(text, dateKey);
    if (seenKeys.has(duplicateKey)) return null;
    seenKeys.add(duplicateKey);
    const startTime = isTimeValue(todo.startTime) ? todo.startTime : "";
    const endTime = isTimeValue(todo.endTime) ? todo.endTime : "";
    const item = {
      id: `todo_${Date.now()}_${index}_${crypto.randomUUID().slice(0, 8)}`,
      text,
      dateKey,
      done: false,
      cancelled: false,
      createdAt: Date.now()
    };
    if (startTime && endTime && startTime < endTime) {
      item.startTime = startTime;
      item.endTime = endTime;
    }
    return item;
  }).filter(Boolean).slice(0, 10);
}

function buildTodoDuplicateKey(text, dateKey) {
  return `${dateKey}::${String(text || "").replace(/\s+/g, " ").trim().toLowerCase()}`;
}

function injectVolatilePrompt(messages, prompt, insertMode, userMessageIndex) {
  const cleanPrompt = String(prompt || "").trim();
  if (!cleanPrompt) return messages;
  const nextMessages = messages.map(message => ({ ...message }));

  if (insertMode === "system") {
    const systemContent = ["=== 本轮即时系统信息 ===", "", cleanPrompt].join("\n\n");
    const worldInfoIndex = nextMessages.findIndex(message =>
      message?.role === "system"
      && (
        String(message.content || "").includes("=== 常驻世界知识/环境信息 ===")
        || String(message.content || "").includes("=== 背景信息补充 ===")
      )
    );
    if (worldInfoIndex >= 0) {
      nextMessages[worldInfoIndex].content = [
        nextMessages[worldInfoIndex].content || "",
        systemContent
      ].filter(Boolean).join("\n\n");
      return nextMessages;
    }

    // ★ 后台 Agent 回注也保持前置 system，不再插到最新 user 前面打断对话流。
    const firstNonSystemIndex = nextMessages.findIndex(message => message?.role !== "system");
    const insertIndex = firstNonSystemIndex >= 0 ? firstNonSystemIndex : nextMessages.length;
    nextMessages.splice(insertIndex, 0, { role: "system", content: systemContent });
    return nextMessages;
  }

  const index = Number.isInteger(userMessageIndex) && userMessageIndex >= 0
    ? userMessageIndex
    : nextMessages.map(message => message.role).lastIndexOf("user");
  if (insertMode === "user" || insertMode === "auto") {
    if (index >= 0 && nextMessages[index]?.role === "user") {
      const nextUserText = [
        "【系统信息补充】",
        cleanPrompt,
        "",
        "【用户当前消息】",
        getMessageText(nextMessages[index])
      ].join("\n\n");
      nextMessages[index].content = replaceMessageText(nextMessages[index].content, nextUserText);
      return nextMessages;
    }
  }
  const firstNonSystemIndex = nextMessages.findIndex(message => message?.role !== "system");
  const insertIndex = firstNonSystemIndex >= 0 ? firstNonSystemIndex : nextMessages.length;
  nextMessages.splice(insertIndex, 0, { role: "system", content: ["=== 本轮背景资料 ===", "", cleanPrompt].join("\n\n") });
  return nextMessages;
}

function sanitizeAgentPayload(agent, defaultAuthMode) {
  if (!agent || typeof agent !== "object" || Array.isArray(agent)) return null;
  const todo = agent.todo_manager && typeof agent.todo_manager === "object" ? agent.todo_manager : null;
  if (!todo || todo.enabled !== true) return null;
  const authMode = sanitizeAuthMode(todo.auth_mode || defaultAuthMode);
  const requestBodyExtra = sanitizeRequestBodyExtra(todo.request_body_extra);
  return {
    todoManager: {
      userText: cleanAgentText(todo.user_text || "", 1000),
      contactName: cleanAgentText(todo.contact_name || "", 120),
      todoSnapshot: sanitizeTodoSnapshot(todo.todo_snapshot),
      apiUrl: normalizeUrl(todo.api_url),
      apiKey: authMode === "server_secret" ? "" : String(todo.api_key || ""),
      authMode,
      model: sanitizeModel(todo.model || ""),
      temperature: clampNumber(todo.temperature, 0, 2, 0.1),
      maxTokens: clampInteger(todo.max_tokens, 1, 4096, 1200),
      requestBodyExtra: requestBodyExtra && typeof requestBodyExtra === "object" ? requestBodyExtra : {}
    }
  };
}

function sanitizeTodoSnapshot(items) {
  if (!Array.isArray(items)) return [];
  const todayKey = getDateKey(new Date());
  return items
    // ★ 后台兜底也只保留今天和未来的 TODO，避免旧前端把大段历史事项带进 Agent。
    .filter(item => item && item.text && (isDateKey(item.dateKey) ? item.dateKey : todayKey) >= todayKey)
    .slice(0, 100)
    .map(item => ({
      id: cleanAgentText(item?.id || "", 80),
      text: cleanAgentText(item?.text || "", 120),
      dateKey: isDateKey(item?.dateKey) ? item.dateKey : todayKey,
      done: item?.done === true,
      cancelled: item?.cancelled === true,
      startTime: isTimeValue(item?.startTime) ? item.startTime : "",
      endTime: isTimeValue(item?.endTime) ? item.endTime : ""
    })).filter(item => item.id && item.text);
}

function extractJsonObject(rawText) {
  const text = String(rawText || "").trim();
  if (!text) throw new Error("agent_empty_json");
  try {
    return JSON.parse(text);
  } catch (error) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1].trim());
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw error;
  }
}

// ★★★★★ 主动消息协议与前置过滤 START ★★★★★
function sanitizeProactiveCapsule(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const policySource = source.policy && typeof source.policy === "object" ? source.policy : {};
  const requestBodyExtra = sanitizeRequestBodyExtra(source.requestBodyExtra);
  const messages = Array.isArray(source.messages) ? source.messages.slice(-PROACTIVE_CONTEXT_MESSAGE_LIMIT).map((message) => ({
    messageId: String(message?.messageId || "").slice(0, 120),
    role: message?.role === "assistant" ? "assistant" : "user",
    content: String(message?.content || "").slice(0, 4000),
    eventAt: clampInteger(message?.eventAt, 0, Number.MAX_SAFE_INTEGER, 0)
  })) : [];

  return {
    enabled: source.enabled === true,
    characterId: String(source.characterId || "").slice(0, 120),
    characterName: String(source.characterName || "角色").slice(0, 120),
    characterPrompt: String(source.characterPrompt || "").slice(0, 20000),
    contextPrompt: String(source.contextPrompt || "").slice(0, 30000),
    messages,
    acknowledgedMessageIds: Array.isArray(source.acknowledgedMessageIds)
      ? source.acknowledgedMessageIds.slice(-100).map((id) => String(id || "").slice(0, 120)).filter(Boolean)
      : [],
    contextRevision: clampInteger(source.contextRevision, 0, Number.MAX_SAFE_INTEGER, 0),
    credentialMode: source.credentialMode === "stored_client_key" ? "stored_client_key" : "server_secret",
    apiUrl: normalizeUrl(source.apiUrl),
    model: sanitizeModel(source.model || ""),
    temperature: clampNumber(source.temperature, 0, 2, 1),
    maxTokens: clampInteger(source.maxTokens, 1, 4096, 1000),
    requestBodyExtra: requestBodyExtra && typeof requestBodyExtra === "object" ? requestBodyExtra : {},
    timezone: sanitizeProactiveTimezone(source.timezone),
    timezoneOffsetMinutes: clampInteger(source.timezoneOffsetMinutes, -14 * 60, 14 * 60, 0),
    lastUserAt: clampInteger(source.lastUserAt, 0, Number.MAX_SAFE_INTEGER, 0),
    lastChatAt: clampInteger(source.lastChatAt, 0, Number.MAX_SAFE_INTEGER, 0),
    nextWakeAt: clampInteger(source.nextWakeAt, 0, Number.MAX_SAFE_INTEGER, 0) || null,
    policy: {
      activeStartMinutes: clampInteger(policySource.activeStartMinutes, 0, 1439, 9 * 60),
      activeEndMinutes: clampInteger(policySource.activeEndMinutes, 0, 1439, 23 * 60),
      minCooldownMinutes: clampNumber(policySource.minCooldownMinutes, 0, 7 * 24 * 60, 180),
      recentChatQuietMinutes: clampNumber(policySource.recentChatQuietMinutes, 0, 24 * 60, 45),
      dailyLimit: clampInteger(policySource.dailyLimit, 1, 20, 3),
      unansweredLimit: clampInteger(policySource.unansweredLimit, 1, 10, 2),
      heartbeatHours: clampPositiveNumber(policySource.heartbeatHours, 168, 12)
    }
  };
}

// ★★★★★ 主动消息加密凭据 START ★★★★★
// 主动 Alarm 可能在浏览器关闭数天后才运行，不能沿用普通 job 的一小时临时 payload。
// 这里用 APP_TOKEN 派生 AES-GCM key；DO 只保存密文、随机 IV 和不可逆短指纹。
async function proactiveCredentialKey(env) {
  const appToken = String(env.APP_TOKEN || "");
  if (!appToken) throw new Error("app_token_missing");
  const source = new TextEncoder().encode(`telewindy:proactive-credential:v1:${appToken}`);
  const digest = await crypto.subtle.digest("SHA-256", source);
  return await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value || ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptProactiveCredential(apiKey, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await proactiveCredentialKey(env),
    new TextEncoder().encode(String(apiKey || ""))
  );
  return {
    version: 1,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted))
  };
}

async function decryptProactiveCredential(credential, env) {
  if (!credential?.iv || !credential?.ciphertext) throw new Error("stored_credential_missing");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(credential.iv) },
    await proactiveCredentialKey(env),
    base64ToBytes(credential.ciphertext)
  );
  const apiKey = new TextDecoder().decode(decrypted);
  if (!apiKey) throw new Error("stored_credential_empty");
  return apiKey;
}

async function fingerprintSecret(value) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || ""))));
  return Array.from(digest.slice(0, 6), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
// ★★★★★ 主动消息加密凭据 END ★★★★★

function getProactivePrefilter(capsule, runtime, now) {
  const policy = capsule.policy || {};
  const dateKey = getOffsetDateKey(now, capsule.timezoneOffsetMinutes);
  if (runtime.dailyDateKey !== dateKey) {
    runtime.dailyDateKey = dateKey;
    runtime.dailyCount = 0;
  }
  const localMinutes = getOffsetMinutesOfDay(now, capsule.timezoneOffsetMinutes);
  if (!isMinuteInActiveWindow(localMinutes, policy.activeStartMinutes, policy.activeEndMinutes)) {
    return { ok: false, reason: "quiet_hours", retryAt: getNextActiveStart(now, capsule.timezoneOffsetMinutes, policy.activeStartMinutes, policy.activeEndMinutes) };
  }
  if (runtime.dailyCount >= policy.dailyLimit) return { ok: false, reason: "daily_limit", retryAt: now + getHeartbeatMs(policy) };
  if (runtime.unansweredCount >= policy.unansweredLimit) return { ok: false, reason: "unanswered_limit", retryAt: now + getHeartbeatMs(policy) };
  const quietUntil = Number(capsule.lastChatAt || 0) + policy.recentChatQuietMinutes * 60 * 1000;
  if (quietUntil > now) return { ok: false, reason: "recent_chat", retryAt: quietUntil };
  // ★ 最短主动间隔保持用户设置的固定值；连续未回复由连发上限单独拦截。
  const cooldownUntil = Number(runtime.lastProactiveGeneratedAt || 0) + policy.minCooldownMinutes * 60 * 1000;
  if (cooldownUntil > now) return { ok: false, reason: "cooldown", retryAt: cooldownUntil };
  return { ok: true };
}

function stripProactiveThought(content) {
  return String(content || "").replace(/<(?:think|thinking|thought)[^>]*>[\s\S]*?(?:<\/(?:think|thinking|thought)>|$)/gi, "");
}

function mergeProactiveMessages(snapshot, pending) {
  // ★ Worker 自己生成的回复可能尚未被前端领取；按稳定 ID 合并，保持最近 15 条且不重复。
  const byId = new Map();
  for (const message of [...(snapshot || []), ...(pending || [])]) {
    if (!message) continue;
    // ★ 兼容升级前没有 messageId 的胶囊，旧聊天不能因为新去重逻辑被整批丢掉。
    const key = message.messageId || `${message.role}:${message.eventAt}:${message.content}`;
    byId.set(key, message);
  }
  return [...byId.values()].sort((a, b) => Number(a.eventAt || 0) - Number(b.eventAt || 0)).slice(-PROACTIVE_CONTEXT_MESSAGE_LIMIT);
}

function sanitizeProactiveTimezone(value) {
  const timezone = String(value || "").slice(0, 100);
  if (!timezone) return "";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return "";
  }
}

function formatProactiveLocalTime(timestamp, capsule) {
  const date = new Date(timestamp);
  const timezone = capsule.timezone;
  if (timezone) {
    // ★ Alarm 所在的 Worker 时区与浏览器无关；按同步的 IANA 时区还原消息发生时的当地钟表时间。
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
  }
  // ★ 升级前的胶囊没有时区名，继续使用原有浏览器偏移，避免回退到 Worker 自己的本地时间。
  const shifted = new Date(timestamp - Number(capsule.timezoneOffsetMinutes || 0) * 60000);
  return shifted.toISOString().slice(0, 16).replace("T", " ");
}

function buildProactiveDecisionMessages(capsule, runtime, now, manual = false) {
  const history = capsule.messages.map((message) => {
    const time = message.eventAt ? formatProactiveLocalTime(message.eventAt, capsule) : "未知时间";
    const speaker = message.role === "assistant" ? capsule.characterName : "对方";
    return `[${time}] ${speaker}：${message.content}`;
  }).join("\n");
  // ★ 模型只选间隔，不再计算绝对时间；发送时刻由 Worker 自己记录。
  const maxCheckMinutes = getHeartbeatMs(capsule.policy) / 60000;
  const system = [
    manual
      ? `你就是 ${capsule.characterName}。离你们上次对话已经过去了一会儿，想给对方发一条消息吗？还是先不发？你可以自由决定。`
      : `你就是 ${capsule.characterName}。离你们上次对话已经过去了一会儿，想给对方发一条消息吗？还是先不发？你可以自由决定。`,
    "不要解释决策过程，不要提及系统、定时器、JSON 或 AI。",
    "只输出一个严格 JSON 对象，不要输出 Markdown：",
    '{"decision":"silent或send","content":"send时填写消息正文，silent时为空字符串","next_check_in_minutes":"下次判断距离现在的分钟数或null"}',
    `当前真实时间：${formatProactiveLocalTime(now, capsule)}`,
    `下次判断请选在 ${maxCheckMinutes} 分钟内；是否实际发送由程序按设置检查。`,
    `连续主动未回复数：${Number(runtime.unansweredCount || 0)}`,
    "消息的实际发送时间由程序记录，不要输出时间戳。"
  ].join("\n");
  const context = [
    capsule.characterPrompt ? `【角色设定】\n${capsule.characterPrompt}` : "",
    capsule.contextPrompt ? `【背景与记忆】\n${capsule.contextPrompt}` : "",
    history ? `【最近聊天】\n${history}` : "【最近聊天】\n暂无聊天记录"
  ].filter(Boolean).join("\n\n");
  return [
    { role: "system", content: system },
    { role: "system", content: context },
    { role: "user", content: "现在请自行决定保持沉默还是主动联系，并安排下一次唤醒。只输出 JSON。" }
  ];
}

function normalizeProactiveDecision(rawText) {
  let parsed;
  try {
    parsed = extractJsonObject(String(rawText || "")
      .replace(/<(?:think|thinking|thought)[^>]*>[\s\S]*?(?:<\/(?:think|thinking|thought)>|$)/gi, "")
      .replace(/```(?:json)?/gi, "").replace(/```/g, "").trim());
  } catch {
    parsed = null;
  }
  const decision = parsed?.decision === "send" ? "send" : "silent";
  const content = decision === "send" ? String(parsed?.content || "").trim().slice(0, 4000) : "";
  const proposedMinutes = Number(parsed?.next_check_in_minutes);
  const nextCheckMinutes = Number.isFinite(proposedMinutes) && proposedMinutes > 0 ? proposedMinutes : null;
  if (!content) return { decision: "silent", content: "", sentAt: null, nextCheckMinutes };
  // ★ Worker 实时发送，不让模型猜测发出时间；使用请求完成时的实际时间。
  return { decision, content, sentAt: new Date().toISOString(), nextCheckMinutes };
}

function parseProactiveTime(value) {
  if (value == null || value === "") return null;
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) ? time : null;
}

function normalizeFutureWakeAt(value, fallback, policy = {}) {
  const now = Date.now();
  const parsed = typeof value === "number" ? value : parseProactiveTime(value);
  const maxTime = now + getHeartbeatMs(policy);
  if (!Number.isFinite(parsed) || parsed <= now) {
    const fallbackTime = Number(fallback);
    return Number.isFinite(fallbackTime) && fallbackTime > now ? Math.min(fallbackTime, maxTime) : maxTime;
  }
  return Math.min(parsed, maxTime);
}

function getHeartbeatMs(policy = {}) {
  return clampPositiveNumber(policy.heartbeatHours, 168, 12) * 60 * 60 * 1000;
}

function getOffsetDateKey(timestamp, offsetMinutes = 0) {
  return new Date(Number(timestamp) - Number(offsetMinutes || 0) * 60 * 1000).toISOString().slice(0, 10);
}

function getOffsetMinutesOfDay(timestamp, offsetMinutes = 0) {
  const date = new Date(Number(timestamp) - Number(offsetMinutes || 0) * 60 * 1000);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function isMinuteInActiveWindow(minutes, start, end) {
  if (start === end) return true;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

function getNextActiveStart(now, offsetMinutes, startMinutes, endMinutes) {
  const shifted = new Date(Number(now) - Number(offsetMinutes || 0) * 60 * 1000);
  const currentMinutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  let daysToAdd = 0;
  if (isMinuteInActiveWindow(currentMinutes, startMinutes, endMinutes)) return now;
  if (startMinutes <= endMinutes && currentMinutes >= startMinutes) daysToAdd = 1;
  const targetUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + daysToAdd, Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
  return targetUtc + Number(offsetMinutes || 0) * 60 * 1000;
}
// ★★★★★ 主动消息协议与前置过滤 END ★★★★★

function cleanAgentText(value, maxLength = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function formatTodoAgentLabel(item) {
  const timeText = item.startTime && item.endTime ? ` ${item.startTime}-${item.endTime}` : "";
  return `${item.dateKey || getDateKey(new Date())}${timeText}：${item.text}`;
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function isTimeValue(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(dateKey, days) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  const date = new Date(year || 1970, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + days);
  return getDateKey(date);
}
// ★★★★★ 后台 Agent：TODO 管理 END ★★★★★

// ★ 普通后台回复与主动 Alarm 共用同一个文本模型传输入口：
// 统一请求头、禁止隐式跳转并共用超时策略，避免两条业务链路以后逐渐分叉。
async function fetchChatCompletion(provider, payload, label) {
  return await fetchWithTimeout(provider.url, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Authorization": `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Accept-Language": "en-US,en",
      "User-Agent": "TeleWindy/1.0"
    },
    body: typeof payload === "string" ? payload : JSON.stringify(payload)
  }, UPSTREAM_TIMEOUT_MS, label);
}

async function fetchWithTimeout(url, options, timeoutMs, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(`${label}_timeout`), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError" || String(error?.message || error).includes("timeout")) {
      throw new Error(`${label}_timeout`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// ★★★★★ 后台 Key 模式 + 多 Provider 路由 START ★★★★★
// 这里专门决定“这个后台 job 应该用哪个 URL 和哪个模型 Key”：
// 1. client_key：跟随前端 API 预设。普通 job 的 Key 随完整载荷临时进入 KV，处理后删除；
// 2. server_secret：前端不传模型 Key，Worker 根据 API_URL 去匹配 Cloudflare secret；
// 3. 两种模式都不会把模型 Key 写进日志、任务状态或最终返回结果。
function resolveUpstream(apiUrl, apiKey, authMode, env) {
  const targetUrl = normalizeUrl(apiUrl);
  const targetSafety = validateUpstreamUrl(targetUrl);
  if (!targetSafety.ok) {
    return {
      ok: false,
      error: targetSafety.error,
      providerId: authMode === "server_secret" ? "server_secret" : "client_key"
    };
  }

  if (authMode === "client_key") {
    if (!targetUrl) {
      return {
        ok: false,
        error: "client_api_url_missing",
        providerId: "client_key"
      };
    }

    if (!apiKey) {
      return {
        ok: false,
        error: "client_api_key_missing",
        providerId: "client_key"
      };
    }

    return {
      ok: true,
      provider: {
        id: "client_key",
        authMode,
        url: targetUrl,
        apiKey
      }
    };
  }

  const providers = buildProviderConfigs(env);
  const fallback = providers.find((provider) => provider.id === "default");

  if (targetUrl) {
    const matched = providers.find((provider) => provider.matches(targetUrl));
    if (matched) {
      // 旧部署只配 UPSTREAM_* 时，如果它和前端 API_URL 正好一致，就继续走旧 Key。
      // 这样升级 Worker 后不用立刻把所有新 Provider secret 都补齐。
      if ((!matched.apiKey || !matched.url) && fallback?.url && fallback?.apiKey && fallback.matches(targetUrl)) {
        return {
          ok: true,
          provider: publicProviderConfig(fallback, authMode)
        };
      }

      if (!matched.apiKey) {
        return {
          ok: false,
          error: "upstream_provider_key_missing",
          providerId: matched.id
        };
      }
      if (!matched.url) {
        return {
          ok: false,
          error: "upstream_provider_url_missing",
          providerId: matched.id
        };
      }
      return {
        ok: true,
        provider: publicProviderConfig(matched, authMode)
      };
    }
  }

  // 兼容旧版：没有匹配到多 Provider 时，继续使用最早的单上游配置。
  // 这样只配置 UPSTREAM_CHAT_URL / UPSTREAM_API_KEY 的旧 Worker 还能照常工作。
  if (fallback?.url && fallback?.apiKey) {
    return {
      ok: true,
      provider: publicProviderConfig(fallback, authMode)
    };
  }

  return {
    ok: false,
    error: "upstream_provider_not_configured",
    providerId: ""
  };
}

function buildProviderConfigs(env) {
  const providers = [
    createProviderConfig({
      id: "deepseek",
      url: env.DEEPSEEK_CHAT_URL || "https://api.deepseek.com/v1/chat/completions",
      apiKey: env.DEEPSEEK_API_KEY,
      matchHosts: ["api.deepseek.com"]
    }),
    createProviderConfig({
      id: "siliconflow",
      url: env.SILICONFLOW_CHAT_URL || "https://api.siliconflow.cn/v1/chat/completions",
      apiKey: env.SILICONFLOW_API_KEY,
      matchHosts: ["api.siliconflow.cn"]
    }),
    createProviderConfig({
      id: "openai",
      url: env.OPENAI_CHAT_URL || "https://api.openai.com/v1/chat/completions",
      apiKey: env.OPENAI_API_KEY,
      matchHosts: ["api.openai.com"]
    }),
    createProviderConfig({
      id: "glm",
      url: env.GLM_CHAT_URL || "https://api.z.ai/api/paas/v4/chat/completions",
      apiKey: env.GLM_API_KEY,
      matchHosts: ["api.z.ai"]
    }),
    createProviderConfig({
      id: "default",
      url: env.UPSTREAM_CHAT_URL,
      apiKey: env.UPSTREAM_API_KEY,
      matchUrls: [env.UPSTREAM_CHAT_URL]
    })
  ];

  // ★ 自定义中转站槽位：
  // 如果你有自己的 OpenAI 兼容中转站，就配置 CUSTOM1_CHAT_URL + CUSTOM1_API_KEY。
  // 前端当前 API_URL 和 CUSTOM1_CHAT_URL 完全一致时，Worker 才会走这个槽位。
  for (const slot of CUSTOM_PROVIDER_SLOTS) {
    providers.push(createProviderConfig({
      id: slot.toLowerCase(),
      url: env[`${slot}_CHAT_URL`],
      apiKey: env[`${slot}_API_KEY`],
      matchUrls: [env[`${slot}_CHAT_URL`]],
      matchHosts: splitCsv(env[`${slot}_MATCH_HOSTS`])
    }));
  }

  return providers;
}

function createProviderConfig(config) {
  const matchUrls = (config.matchUrls || [])
    .map(normalizeUrl)
    .filter(Boolean);
  const matchHosts = (config.matchHosts || [])
    .map((host) => String(host || "").trim().toLowerCase())
    .filter(Boolean);

  return {
    id: config.id,
    url: normalizeUrl(config.url),
    apiKey: config.apiKey || "",
    matches(targetUrl) {
      const target = normalizeUrl(targetUrl);
      if (!target) return false;
      const targetHost = getUrlHost(target);
      return matchUrls.includes(target) || (targetHost && matchHosts.includes(targetHost));
    }
  };
}

function publicProviderConfig(provider, authMode = "server_secret") {
  return {
    id: provider.id,
    authMode,
    url: provider.url,
    apiKey: provider.apiKey
  };
}

function sanitizeAuthMode(mode) {
  return mode === "server_secret" ? "server_secret" : "client_key";
}

function normalizeUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

// ★ 自定义中转站仍然放行，但明显危险的地址先挡掉：
// 1. localhost / 私网 / 保留地址没有必要让公开 Worker 去请求；
// 2. 只允许 http/https，避免奇怪协议绕到不可预期的行为。
function validateUpstreamUrl(url) {
  if (!url) return { ok: true };
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "upstream_url_invalid" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "upstream_url_protocol_blocked" };
  }

  const host = parsed.hostname.toLowerCase();
  if (isBlockedHost(host)) {
    return { ok: false, error: "upstream_url_host_blocked" };
  }

  return { ok: true };
}

function isBlockedHost(host) {
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "0.0.0.0") return true;

  const ipv4 = parseIpv4(host);
  if (ipv4) return isBlockedIpv4(ipv4);

  const normalizedIpv6 = host.replace(/^\[|\]$/g, "");
  if (normalizedIpv6 === "::1" || normalizedIpv6 === "0:0:0:0:0:0:0:1") return true;
  if (normalizedIpv6.startsWith("fe80:") || normalizedIpv6.startsWith("fc") || normalizedIpv6.startsWith("fd")) return true;

  return false;
}

function parseIpv4(host) {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((num, index) => !Number.isInteger(num) || num < 0 || num > 255 || String(num) !== parts[index])) {
    return null;
  }
  return nums;
}

function isBlockedIpv4(parts) {
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true;
  return false;
}

function getUrlHost(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeLogText(value) {
  return String(value || "").slice(0, 300);
}

// ★ 上游 URL 可能带临时签名或 Key；诊断日志只保留协议、主机和路径。
function sanitizeUrlForLog(value) {
  try {
    const url = new URL(String(value || ""));
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return sanitizeLogText(value);
  }
}

// ★ 405/HTML 最需要看最终地址、跳转位置和 Allow；这些字段不会读取或复制响应正文。
function getUpstreamResponseDiagnostics(response) {
  return {
    status: response.status,
    statusText: response.statusText,
    finalUrl: sanitizeUrlForLog(response.url),
    contentType: response.headers.get("content-type") || "",
    location: sanitizeUrlForLog(response.headers.get("location") || ""),
    allow: response.headers.get("allow") || "",
    server: response.headers.get("server") || "",
    cfRay: response.headers.get("cf-ray") || "",
    cfMitigated: response.headers.get("cf-mitigated") || "",
    requestId: response.headers.get("x-request-id") || ""
  };
}
// ★★★★★ 后台 Key 模式 + 多 Provider 路由 END ★★★★★

function extractAssistantContent(data) {
  const message = data?.choices?.[0]?.message || {};
  let content = String(message.content || "");

  // ★★★★★ 推理模型思考链兼容 START ★★★★★
  // 前端直连 API 时已经把 reasoning_content 包成 <think>...</think>，
  // 后台接收也必须做同样处理，不然 Worker 存进 KV 的 result 只剩正文。
  const reasoningContent = message.reasoning_content || message.reasoningContent;
  if (reasoningContent) {
    content = `<think>\n${String(reasoningContent).trim()}\n</think>\n\n${content}`;
  }
  // ★★★★★ 推理模型思考链兼容 END ★★★★★

  return content;
}

function sanitizeMessages(messages) {
  return messages.slice(-80).map((message) => ({
    role: sanitizeRole(message.role),
    content: sanitizeMessageContent(message.content)
  }));
}

// ★★★★★ 后台多模态消息清洗 START ★★★★★
// 只接受本前端实际会生成的 text/image_url 块；其它对象一律丢弃，避免把任意结构透传给上游。
function sanitizeMessageContent(content) {
  if (!Array.isArray(content)) return String(content || "").slice(0, 20000);

  const blocks = content.slice(0, 8).map((block) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) return null;
    if (block.type === "text") {
      return { type: "text", text: String(block.text || "").slice(0, 20000) };
    }
    if (block.type === "image_url") {
      const imageUrl = String(block.image_url?.url || "");
      if (!/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\r\n]+$/i.test(imageUrl)) return null;
      return { type: "image_url", image_url: { url: imageUrl } };
    }
    return null;
  }).filter(Boolean);

  return blocks.length ? blocks : "";
}

function getMessageText(message) {
  const content = message?.content;
  if (!Array.isArray(content)) return String(content || "");
  return content
    .filter(block => block?.type === "text")
    .map(block => String(block.text || ""))
    .join("\n\n");
}

function replaceMessageText(content, text) {
  if (!Array.isArray(content)) return String(text || "");
  const nextBlocks = content.map(block => block?.type === "text" ? { ...block } : block);
  const textIndex = nextBlocks.findIndex(block => block?.type === "text");
  if (textIndex >= 0) nextBlocks[textIndex].text = String(text || "");
  else nextBlocks.unshift({ type: "text", text: String(text || "") });
  return nextBlocks;
}

function hasMultimodalImage(messages) {
  return Array.isArray(messages) && messages.some(message => Array.isArray(message?.content)
    && message.content.some(block => block?.type === "image_url" && block.image_url?.url));
}

// ★ 同一组字段同时用于 job_create / job_run_start，避免“hasVision=false”被误读成“本轮没图片”。
function getImageDiagnostics(messages, vision) {
  const usesVisionApi = !!vision;
  const usesMultimodalApi = hasMultimodalImage(messages);
  return {
    hasImage: usesVisionApi || usesMultimodalApi,
    imageMode: usesVisionApi ? "separate" : (usesMultimodalApi ? "multimodal" : "none"),
    usesVisionApi
  };
}

function isMultimodalUnsupportedError(status, errorText) {
  if (![400, 415, 422].includes(Number(status))) return false;
  const text = String(errorText || "").toLowerCase();
  return [
    "image", "vision", "multimodal", "image_url",
    "unsupported content", "content must be", "content type", "expected a string", "valid string"
  ].some(keyword => text.includes(keyword));
}

function buildMultimodalFallbackMessages(messages) {
  const fallbackText = "（系统提示：用户发送了一张图片，但当前主模型或 API 不支持读取图片，无法提供图片内容。请根据用户的文字上下文回复；如有需要，可以询问用户图片内容。）";
  const nextMessages = messages.map(message => ({ ...message }));
  for (let index = nextMessages.length - 1; index >= 0; index--) {
    const message = nextMessages[index];
    if (message.role !== "user" || !Array.isArray(message.content)) continue;
    const text = getMessageText(message).trim();
    message.content = text ? `${text}\n\n${fallbackText}` : fallbackText;
    break;
  }
  return nextMessages;
}
// ★★★★★ 后台多模态消息清洗 END ★★★★★

function sanitizeRole(role) {
  if (role === "system" || role === "assistant" || role === "user") {
    return role;
  }
  return "user";
}

function sanitizeModel(model) {
  return String(model || "").trim();
}

function sanitizeTtlSeconds(ttlHours) {
  const hours = clampNumber(ttlHours, MIN_JOB_TTL_HOURS, MAX_JOB_TTL_HOURS, DEFAULT_JOB_TTL_HOURS);
  return Math.round(hours * 60 * 60);
}

function sanitizeRequestBodyExtra(extra) {
  if (extra === undefined || extra === null) return {};
  if (typeof extra !== "object" || Array.isArray(extra)) return null;

  // 后台任务最终用 response.json() 取完整结果，所以这里兜底禁止流式返回。
  return {
    ...extra,
    stream: false
  };
}

function getAllowedModels(env) {
  const configured = String(env.ALLOWED_MODELS || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  if (!configured.length || configured.includes("*")) return null;
  return new Set(configured);
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clampPositiveNumber(value, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, n);
}

function clampInteger(value, min, max, fallback) {
  return Math.round(clampNumber(value, min, max, fallback));
}

function isAuthorized(request, env) {
  const token = request.headers.get("Authorization");
  return isAppTokenConfigured(env) && token === `Bearer ${env.APP_TOKEN}`;
}

function isAppTokenConfigured(env) {
  const token = String(env.APP_TOKEN || "");
  return !!token && token !== "replace-with-your-own-long-random-token";
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  if (isWildcardOrigin(env)) return true;
  return getAllowedOrigins(env).includes(origin);
}

function withCors(response, request, env) {
  // ★ Durable Object 子请求返回的响应头可能只读；复制响应后再补 CORS，保留原状态和正文。
  const corsResponse = new Response(response.body, response);
  const origin = request.headers.get("Origin");
  if (origin && (isWildcardOrigin(env) || getAllowedOrigins(env).includes(origin))) {
    corsResponse.headers.set("Access-Control-Allow-Origin", origin);
    corsResponse.headers.set("Vary", "Origin");
  }
  // ★ 主动角色同步使用 PUT；预检未声明时浏览器会在请求到达 Worker 路由前直接拦截。
  corsResponse.headers.set("Access-Control-Allow-Methods", "POST, PUT, GET, DELETE, OPTIONS");
  corsResponse.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  corsResponse.headers.set("Access-Control-Max-Age", "86400");
  return corsResponse;
}

function json(data, status, request, env) {
  return withCors(Response.json(data, { status }), request, env);
}

function buildJobEvent(code, detail = {}) {
  return {
    code,
    ts: Date.now(),
    detail: sanitizeJobEventDetail(detail)
  };
}

async function buildJobWithEvent(jobId, env, nextJob, code, detail = {}) {
  return await patchJobState(jobId, env, nextJob, buildJobEvent(code, detail));
}

async function appendJobEvent(jobId, env, code, detail = {}, ttlSeconds = DEFAULT_JOB_TTL_HOURS * 3600) {
  return await patchJobState(jobId, env, { ttlSeconds }, buildJobEvent(code, detail));
}

async function deleteJobPayload(jobId, env, ttlSeconds = DEFAULT_JOB_TTL_HOURS * 3600) {
  try {
    await env.CHAT_JOBS.delete(payloadKey(jobId));
    await appendJobEvent(jobId, env, "job_payload_delete", {}, ttlSeconds);
  } catch (error) {
    console.warn("job_payload_delete_error", {
      jobId: shortJobId(jobId),
      error: error?.message || String(error)
    });
  }
}

function sanitizeJobEventDetail(detail) {
  const safe = {};
  for (const [key, value] of Object.entries(detail || {})) {
    if (Array.isArray(value)) {
      safe[key] = value.map(item => sanitizeLogText(item)).slice(0, 20);
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      safe[key] = value;
    } else {
      safe[key] = sanitizeLogText(value);
    }
  }
  return safe;
}

function jobObjectStub(jobId, env) {
  const id = env.CHAT_JOB_OBJECT.idFromName(String(jobId || ""));
  return env.CHAT_JOB_OBJECT.get(id);
}

async function initJobState(jobId, env, job) {
  const response = await jobObjectStub(jobId, env).fetch("https://job.local/init", {
    method: "POST",
    body: JSON.stringify({ job })
  });
  return await response.json();
}

async function readJobState(jobId, env) {
  const response = await jobObjectStub(jobId, env).fetch("https://job.local/job");
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`job_state_read_${response.status}`);
  return await response.json();
}

async function patchJobState(jobId, env, nextJob = {}, event = null) {
  const response = await jobObjectStub(jobId, env).fetch("https://job.local/patch", {
    method: "POST",
    body: JSON.stringify({ nextJob, event })
  });
  if (!response.ok) throw new Error(`job_state_patch_${response.status}`);
  return await response.json();
}

async function deleteJobState(jobId, env) {
  const response = await jobObjectStub(jobId, env).fetch("https://job.local/delete", {
    method: "POST"
  });
  if (!response.ok) throw new Error(`job_state_delete_${response.status}`);
  return await response.json();
}

function payloadKey(jobId) {
  return `job_payload:${jobId}`;
}

function getPayloadTtlSeconds(ttlSeconds) {
  const seconds = Number(ttlSeconds || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return MAX_PAYLOAD_TTL_SECONDS;
  return Math.max(60, Math.min(seconds, MAX_PAYLOAD_TTL_SECONDS));
}

function shortJobId(jobId) {
  return String(jobId || "").slice(0, 8);
}

function getAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isWildcardOrigin(env) {
  return getAllowedOrigins(env).includes("*");
}
