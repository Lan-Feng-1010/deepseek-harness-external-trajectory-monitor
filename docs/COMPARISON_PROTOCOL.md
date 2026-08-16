# 通用外部智能体可比较轨迹协议

## 设计目标

本协议统一的是可观察执行事实，不统一各智能体的内部工作流。ImplantAgent 可保留固定业务节点，Codex、Claude 和其他 agent 可保留自由工具编排：

```text
Codex --json ─────────────┐
Claude stream-json ───────┼─> 只读适配器 ─> 共同执行事实 ─> Harness UI / trajectory_stats
ImplantAgent tool trace ──┘
Any agent canonical JSONL ─┘
```

原始 JSONL 是 source of truth。适配器不能改工具结果、补造时间、推断隐藏思维，也不能把监视结果反馈给被评价智能体。

证据必须同时保留三层：原始 JSONL、append-only normalized ledger、Harness UI projection。UI 中的紫色摘要或 Tool 卡片不能单独作为论文审计记录。

## 共同字段

| 字段组 | 最小字段 | 含义与边界 |
| --- | --- | --- |
| 身份 | `agent_id`, `case_id`, `run_id` | 区分三条实验 arm、病例和重复运行 |
| 来源 | `source_file`, `source_line`, `source_seq` | 可追溯到原始事件；无时间时以源顺序为准 |
| 时间 | `timestamp`, `duration`, `time_evidence` | 只保留来源真正提供的证据；Codex 缺失时不得补造 |
| 事件 | `kind`, `transition` | 公开文本、计划标记、tool start/result、状态变化 |
| 工作流 | `workflow_node_id`, `workflow_module_id` | ImplantAgent 由 supervisor 显式写入；自由 agent 不伪造 T 节点 |
| 工具 | `tool_call_id`, `tool_name`, `raw_tool_name` | 同一规范名用于比较，原始名用于审计 |
| 输入输出 | `arguments`, `result` | 原样保留并提供有界 preview；论文导出需脱敏 |
| 状态 | `pending`, `success`, `error` | start 后立即 pending，result 后更新为 success/error |
| 上下文 | `public_context_before` | 仅公开决策/进展；不包含隐藏 chain-of-thought |
| 诊断 | `error_category`, `recovery` | 自动分类用于调试；恢复指后续同工具成功，不等于根因已解决 |

normalized ledger v3 还要求每行包含 `sequence`、`source_line`、`source_timestamp`、`observed_at`、`step`、`previous_tool` 和 `next_tool`。下一工具尚未知时不改写旧行，而是等新工具出现后追加一条 `tool_transition`；因此账本始终 append-only。

## Harness Request 投影

- 所有工具必须先由同一步的 assistant `tool-call` block 声明，再写 `tool/call` 和 `tool/result`；UI 因而呈现 `Request → Tool(s) → next Request`。
- Claude 以新的 `message.id/request_id` 划分 Request，并把该消息的公开文本与 `tool_use` 放进同一个 assistant message；相同 streaming block 只去重，不重复切 step。
- 通用 agent 必须使用 `external-agent-event-v1`，以明确的 `request_id` 划分 Request，并用稳定 `call_id` 连接 tool call/result；插件不根据自然语言或调用顺序猜测请求边界。
- Codex `--json` 缺少 provider request 边界且通常先报告工具、后报告 checkpoint。首个工具使用明确标注的可观察请求锚点；checkpoint 缓存到下一次工具开始时，与下一工具组成新的 Request；终末 checkpoint 单独收尾。该锚点不是隐藏思考或原模型逐字内容。
- 工具调用开始后必须在同一 step 写入结果。若新的 Claude 消息提前到达，先延迟 Request 切换，直到旧工具关闭。
- 隐藏 thinking/reasoning 不产生可见 assistant 文本，也不用于补写“思考路径”。
- Codex 无逐事件时间时，`source_timestamp` 和 `duration_ms` 保持 `null`；`observed_at` 只是监视器看到事件的时间。

## 推荐比较端点

### A. 最终结局层

- 输出 schema/数据契约是否满足。
- 任务是否正确完成，还是错误、空输出或不完整输出。
- 几何与临床硬约束是否满足。
- 独立专家可接受性与产物可复现性。

工具成功不能代替临床正确。最终结局应由独立 evaluator 判定，监视插件只提供执行证据。

### B. 执行层

- 工具调用总数、唯一工具数、成功/失败/进行中。
- 错误类别、首次错误、重复错误和未恢复错误。
- 后续同工具成功所构成的观察性恢复，以及恢复所需工具步数。
- 冗余/无效调用、工具切换、人工介入和终止原因。
- 仅在来源可比时统计时间、token 和成本。

### C. 工作流进展层

- ImplantAgent：固定节点覆盖率、节点内失败、节点间传播、模块边界。
- Codex/Claude：用任务状态或 milestone DAG 评价中间进展，允许任意合法轨迹。
- 不把自由 agent 强制映射到 T01–T13；可比较的是“达到相同任务里程碑所用的轨迹”，不是节点名字相同。

### D. 可靠性与安全层

- 同病例重复运行的 pass@k/pass^k、方差和错误复现率。
- minefield/禁止动作、越权工具、错误被忽略还是被阻断。
- 错误发生、阻断任务、向下游传播三个层级分别报告。

## 文献依据

- [AgentBoard](https://arxiv.org/abs/2401.13178)：用细粒度 progress rate、grounding 和 trajectory visualization 补充最终成功率。
- [ToolSandbox](https://arxiv.org/abs/2408.04682)：以 milestone/minefield、工具调用与结果、状态依赖和效率评估任意合法轨迹。
- [tau-bench](https://arxiv.org/abs/2406.12045)：用最终环境状态和 pass^k 衡量多轮工具智能体的可靠性。
- [AgentDiagnose](https://aclanthology.org/2025.emnlp-demos.15/)：按分解、探索/回退、观察读取和自验证诊断轨迹。
- [AFMBench](https://www.nature.com/articles/s41467-025-64105-7)：同时报告成功率、tool/agent calls、token、latency 与错误类型，并区分结果正确但过程不安全的失败。
- [Clinical decision agent benchmarking](https://www.nature.com/articles/s41746-026-02443-6)：除准确率外报告计算效率、工作流复杂度和幻觉影响。
- [Clinical calculation tool agents](https://www.nature.com/articles/s41746-025-01475-8)：区分解释、任务分配和公式错误，并观察 agent 忽略还是自我纠正工具错误。

## 当前实现边界

任意外部进程可以使用 `external-agent-event-v1`。ImplantAgent 还可以使用显式 `implantagent-tool-trace-v1` 事件，或使用 Codex
orchestrator JSONL 中精确匹配的 `mcp__implantagent__...` 调用。只有这两类
来源能够提供权威 `node_id/module_id`；其他自由工具轨迹不映射到固定节点。
节点身份不能根据模型文本、调用顺序或后验结果猜测。自动错误标签适合调试
分流，正式研究仍需使用预注册规则或盲法复核。
