# DeepSeek 只读监视器 Agent

## 它做什么

DeepSeek 的角色不是第四个被评价的执行 Agent，而是轨迹分析入口：

1. 你用自然语言提出统计或诊断问题。
2. DeepSeek 调用 `trajectory_stats`。
3. 插件从三个 live source 重新生成只读快照并确定性计算答案。
4. DeepSeek把结构化结果解释成易读结论。

精确数字由插件计算，DeepSeek 不从长日志中自行估算。工具不会运行外部模型、执行 Implant 工具、修改日志或向三个被评价 Agent 回传信息。

## 使用方式

`[Live Monitor] Codex · Claude · ImplantAgent` 是纯展示 session，guard 会拒绝任何模型 step。若要问问题，请新建一个普通 DeepSeek Harness 会话，然后提问；该会话可以看到全局只读工具 `trajectory_stats`。

示例问题：

- “比较三个 arm 当前各调用了多少次工具，失败率是多少？”
- “ImplantAgent 调用了多少次 jq，其中失败多少次？”
- “ImplantAgent 有哪些未观察恢复的错误？按错误类别排序。”
- “Codex 和 Claude 的唯一工具数、pending 调用和恢复步数有什么差异？”
- “只看病例 CASE_001，并给我最多 10 个错误例子。”

工具参数：

| 参数 | 可选值/含义 |
| --- | --- |
| `agent` | `all`, `implantagent`, `codex`, `claude` |
| `case_id` | 当前 live stream 的精确病例 ID |
| `tool_name` | 不区分大小写的工具名子串，例如 `jq` |
| `include_errors` | 是否返回最多 10 个有界错误例子 |

## 结果边界

- “恢复”只表示同一规范工具后来出现成功调用，是调试信号，不证明根因被修复。
- Codex 没有逐事件时间戳时，只能回答调用顺序和计数，不能编造分钟/秒级耗时。
- 监视器不显示或重建隐藏 chain-of-thought；它分析公开工具轨迹、公开决策和真实结果。
- 若 cloud supervisor 没有持续同步 JSONL，统计只能反映最近一次已同步快照。
- 将 DeepSeek 的总结用于论文前，应保留 `trajectory_stats` JSON 输出并用预注册规则/人工复核关键错误标签。
