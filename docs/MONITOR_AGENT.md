# DeepSeek 启动与只读监视器 Agent

## 它做什么

DeepSeek 的角色不是第四个被评价的执行 Agent，而是受控启动与轨迹分析入口：

1. DeepSeek 用 `external_preexperiment_catalog` 查看本地白名单。
2. 你确认后，它用 `external_preexperiment_start` 请求启动；Harness 必须弹出人工批准。
3. 可信 supervisor 启动真正的 Codex、Claude 或其他外部 Agent；DeepSeek 不执行病例任务。
4. 新日志源自动登记并出现在同一监控界面。
5. DeepSeek 用 `external_preexperiment_status` 和 `trajectory_stats` 解释状态、调用次数和公开错误。

精确数字由插件计算，DeepSeek 不从长日志中自行估算。启动工具只能选择本地已经批准的 plan/case；模型不能填写命令、参数、provider、模型、prompt 或日志路径，也不能向被评价 Agent 回传信息。

## 使用方式

直接打开 `[Live Control + Monitor] External agents`。这个 session 同时承担启动、状态和统计问答，不再需要另开页面。它只允许四个插件工具：catalog、start、status 和 trajectory_stats；terminal、文件修改及其他工具会被拒绝。

启动一个新病例时，先让 DeepSeek列出 catalog，再指定其中已有的 `plan_id` 和 `case_id`。`start` 调用出现批准卡片后，由你点击允许。插件先复制全新的运行目录并登记监控源，再启动可信 supervisor，因此随后写入的完整 JSONL 行会自动进入轨迹。

示例问题：

- “比较当前所有 arm 各调用了多少次工具，失败率是多少？”
- “只看 source ID `my-external-agent`，列出它的工具切换和错误。”
- “ImplantAgent 调用了多少次 jq，其中失败多少次？”
- “ImplantAgent 有哪些未观察恢复的错误？按错误类别排序。”
- “Codex 和 Claude 的唯一工具数、pending 调用和恢复步数有什么差异？”
- “只看病例 CASE_001，并给我最多 10 个错误例子。”

工具参数：

| 参数 | 可选值/含义 |
| --- | --- |
| `agent` | `all`，或任意配置的 source ID、kind、label |
| `case_id` | 当前 live stream 的精确病例 ID |
| `tool_name` | 不区分大小写的工具名子串，例如 `jq` |
| `include_errors` | 是否返回最多 10 个有界错误例子 |

## 结果边界

- “恢复”只表示同一规范工具后来出现成功调用，是调试信号，不证明根因被修复。
- Codex 没有逐事件时间戳时，只能回答调用顺序和计数，不能编造分钟/秒级耗时。
- 监视器不显示或重建隐藏 chain-of-thought；它分析公开工具轨迹、公开决策和真实结果。
- 若 cloud supervisor 没有持续同步 JSONL，统计只能反映最近一次已同步快照。
- `completed` 只表示可信 supervisor 进程以 0 退出，不代表临床结果正确。
- 将 DeepSeek 的总结用于论文前，应保留 `trajectory_stats` JSON 输出并用预注册规则/人工复核关键错误标签。
