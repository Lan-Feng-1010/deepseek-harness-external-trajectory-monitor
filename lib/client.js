window.__ModuleLoader__.load({
	id: "dsh-external-trajectory-importer",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:src/client/observable-reasoning.module.css.mjs
		const css = ".sVMnbW_root{--trace-border:color-mix(in srgb, currentColor 14%, transparent);--trace-muted:color-mix(in srgb, currentColor 62%, transparent);height:100%;color:var(--dsw-color-text-primary,#17211b);background:radial-gradient(circle at 12% 0%, #299c6714, transparent 26rem), var(--dsw-color-bg-primary,#fbfcfa);box-sizing:border-box;padding:24px clamp(18px,4vw,56px) 40px;overflow:auto}.sVMnbW_header{justify-content:space-between;align-items:flex-start;gap:28px;max-width:1180px;margin:0 auto 16px;display:flex}.sVMnbW_header h2{letter-spacing:-.025em;margin:5px 0 7px;font-size:clamp(22px,3vw,34px);line-height:1.15}.sVMnbW_header p{color:var(--trace-muted);margin:0;font-size:14px}.sVMnbW_eyebrow{color:#14764a;letter-spacing:.12em;font:700 11px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace}.sVMnbW_exactBadge,.sVMnbW_sequenceBadge{border:1px solid;border-radius:999px;flex:none;padding:9px 12px;font-size:12px;font-weight:700}.sVMnbW_exactBadge{color:#0d7044;background:#e8f7ef;border-color:#addbc4}.sVMnbW_sequenceBadge{color:#76530a;background:#fff7df;border-color:#e8d28e}.sVMnbW_boundary{border:1px solid var(--trace-border);background:color-mix(in srgb, var(--dsw-color-bg-primary,white) 92%, #dcefe4);border-left:3px solid #2b8a60;border-radius:8px;gap:14px;max-width:1150px;margin:0 auto 18px;padding:13px 15px;font-size:13px;display:flex}.sVMnbW_boundary strong{white-space:nowrap}.sVMnbW_boundary span{color:var(--trace-muted)}.sVMnbW_summary{border:1px solid var(--trace-border);background:color-mix(in srgb, var(--dsw-color-bg-primary,white) 96%, currentColor);border-radius:12px;grid-template-columns:repeat(5,minmax(110px,1fr));max-width:1180px;margin:0 auto 18px;display:grid;overflow:hidden}.sVMnbW_summary div{border-right:1px solid var(--trace-border);padding:14px 16px}.sVMnbW_summary div:last-child{border-right:0}.sVMnbW_summary span{color:var(--trace-muted);margin-bottom:3px;font-size:11px;display:block}.sVMnbW_summary strong{font:700 20px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace}.sVMnbW_streams{grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:9px;max-width:1180px;margin:-5px auto 18px;display:grid}.sVMnbW_streams>div{border:1px solid var(--trace-border);background:var(--dsw-color-bg-primary,white);border-radius:9px;padding:11px 12px}.sVMnbW_streams>div[data-live=true]{border-color:#67b58d;box-shadow:inset 3px 0 #2b8a60}.sVMnbW_streams>div>div{justify-content:space-between;gap:8px;display:flex}.sVMnbW_streams strong{font-size:12px}.sVMnbW_streams span{color:var(--trace-muted);font-size:10px}.sVMnbW_streams p{margin:6px 0;font:12px ui-monospace,SFMono-Regular,Consolas,monospace}.sVMnbW_streams dl{grid-template-columns:repeat(6,auto);gap:4px;margin:0;font-size:10px;display:grid}.sVMnbW_streams dt{color:var(--trace-muted)}.sVMnbW_streams dd{margin:0 5px 0 0;font-weight:700}.sVMnbW_streams small{color:var(--trace-muted);margin-top:6px;display:block}.sVMnbW_errorCompare{border:1px solid var(--trace-border);background:color-mix(in srgb, var(--dsw-color-bg-primary,white) 96%, #ead7d7);border-radius:12px;max-width:1180px;margin:0 auto 18px;padding:15px}.sVMnbW_comparisonContract{background:color-mix(in srgb, var(--dsw-color-bg-primary,white) 93%, #dcecf3);border-left:3px solid #4d748a;grid-template-columns:235px 1fr;gap:12px;margin-bottom:10px;padding:9px 11px;font-size:11px;display:grid}.sVMnbW_comparisonContract span{color:var(--trace-muted)}.sVMnbW_comparisonTable{border:1px solid var(--trace-border);background:var(--trace-border);border-radius:8px;gap:1px;margin-bottom:15px;display:grid;overflow:hidden}.sVMnbW_comparisonTable>div{background:var(--dsw-color-bg-primary,white);grid-template-columns:1.25fr 1.75fr .65fr .42fr .5fr .5fr .72fr;align-items:center;gap:8px;padding:7px 9px;font-size:9px;display:grid}.sVMnbW_comparisonTable>div[data-head=true]{color:var(--trace-muted);font-weight:700}.sVMnbW_comparisonTable>div[data-focus=true]{box-shadow:inset 3px 0 #d4863c}.sVMnbW_comparisonTable strong{font-size:10px}.sVMnbW_sectionTitle{justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:11px;display:flex}.sVMnbW_sectionTitle span{color:#a03d3d;letter-spacing:.1em;font:700 9px ui-monospace,SFMono-Regular,Consolas,monospace}.sVMnbW_sectionTitle h3{margin:2px 0 0;font-size:17px}.sVMnbW_sectionTitle p{color:var(--trace-muted);margin:0;font-size:11px}.sVMnbW_errorGrid{grid-template-columns:repeat(3,1fr);gap:9px;display:grid}.sVMnbW_errorGrid article{border:1px solid var(--trace-border);background:var(--dsw-color-bg-primary,white);border-radius:9px;min-width:0;padding:12px}.sVMnbW_errorGrid article[data-focus=true]{border-color:#d4863c;box-shadow:inset 3px 0 #d4863c}.sVMnbW_errorGrid header{justify-content:space-between;gap:8px;display:flex}.sVMnbW_errorGrid header strong,.sVMnbW_errorGrid header span{display:block}.sVMnbW_errorGrid header strong{font-size:12px}.sVMnbW_errorGrid header span{color:var(--trace-muted);margin-top:2px;font:10px ui-monospace,SFMono-Regular,Consolas,monospace}.sVMnbW_errorGrid header b{color:#b33a3a;font:700 18px ui-monospace,SFMono-Regular,Consolas,monospace}.sVMnbW_errorCounts{color:var(--trace-muted);gap:12px;margin:9px 0;font-size:10px;display:flex}.sVMnbW_recoveryLine{color:#6e4c29;margin:-4px 0 8px;font-size:9px}.sVMnbW_errorChips{flex-wrap:wrap;gap:4px;display:flex}.sVMnbW_errorChips code{color:#8f3030;background:#faeeee;border-radius:4px;padding:3px 5px;font-size:9px}.sVMnbW_categoryChips{flex-wrap:wrap;gap:4px;margin-bottom:6px;display:flex}.sVMnbW_categoryChips code{color:#82501e;background:#fff6e9;border:1px solid #d9a973;border-radius:999px;padding:3px 5px;font-size:9px}.sVMnbW_noError{color:#24704b;font-size:11px}.sVMnbW_errorGrid details{margin-top:10px;font-size:10px}.sVMnbW_errorGrid summary{cursor:pointer;color:#9a3434;font-weight:700}.sVMnbW_errorGrid dl{grid-template-columns:76px 1fr;gap:5px 8px;margin:8px 0 0;display:grid}.sVMnbW_errorGrid dt{color:var(--trace-muted)}.sVMnbW_errorGrid dd{word-break:break-word;min-width:0;margin:0}.sVMnbW_implantQueue{border-top:1px solid var(--trace-border);margin-top:13px;padding-top:12px}.sVMnbW_queueTitle{justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:8px;display:flex}.sVMnbW_queueTitle span{color:#a45b22;letter-spacing:.1em;font:700 9px ui-monospace,SFMono-Regular,Consolas,monospace}.sVMnbW_queueTitle h4{margin:2px 0 0;font-size:15px}.sVMnbW_queueTitle p{color:var(--trace-muted);margin:0;font-size:10px}.sVMnbW_queueList{gap:6px;display:grid}.sVMnbW_queueList details{border:1px solid var(--trace-border);background:var(--dsw-color-bg-primary,white);border-radius:7px;overflow:hidden}.sVMnbW_queueList summary{cursor:pointer;grid-template-columns:28px minmax(140px,.7fr) minmax(140px,1fr) auto;align-items:center;gap:8px;padding:8px 10px;display:grid}.sVMnbW_queueList summary b{color:#a43e3e;font:700 10px ui-monospace,SFMono-Regular,Consolas,monospace}.sVMnbW_queueList summary code{text-overflow:ellipsis;color:#333;white-space:nowrap;font-size:10px;overflow:hidden}.sVMnbW_queueList summary span{color:#96511f;font-size:10px;font-weight:700}.sVMnbW_queueList summary small{color:var(--trace-muted);font:9px ui-monospace,SFMono-Regular,Consolas,monospace}.sVMnbW_queueList dl{border-top:1px solid var(--trace-border);grid-template-columns:105px minmax(0,1fr);gap:5px 10px;margin:0;padding:9px 12px 11px 46px;font-size:10px;display:grid}.sVMnbW_queueList dt{color:var(--trace-muted)}.sVMnbW_queueList dd{word-break:break-word;min-width:0;margin:0}.sVMnbW_queueList dd code{white-space:pre-wrap}.sVMnbW_errorCategory{color:#8e561f;border:1px solid #e3b477;border-radius:999px;padding:2px 6px;font-size:9px}.sVMnbW_workflowNode{color:#355a84;background:#e9eff8;border-radius:4px;padding:2px 6px;font:700 9px ui-monospace,SFMono-Regular,Consolas,monospace}.sVMnbW_controls{z-index:3;background:color-mix(in srgb, var(--dsw-color-bg-primary,#fbfcfa) 94%, transparent);backdrop-filter:blur(10px);align-items:center;gap:12px;max-width:1180px;margin:0 auto 14px;padding:12px 0;display:flex;position:sticky;top:-24px}.sVMnbW_filters{border:1px solid var(--trace-border);background:var(--dsw-color-bg-primary,white);border-radius:9px;gap:5px;padding:4px;display:flex}.sVMnbW_filters button,.sVMnbW_expand{color:inherit;cursor:pointer;background:0 0;border:0;border-radius:6px}.sVMnbW_filters button{padding:6px 9px;font-size:12px}.sVMnbW_filters button[data-active=true]{color:#fff;background:#1d7650}.sVMnbW_controls input{border:1px solid var(--trace-border);min-width:160px;color:inherit;background:var(--dsw-color-bg-primary,white);border-radius:8px;flex:1;padding:9px 11px}.sVMnbW_visibleCount{color:var(--trace-muted);white-space:nowrap;font:12px ui-monospace,SFMono-Regular,Consolas,monospace}.sVMnbW_timeline{max-width:1180px;margin:0 auto}.sVMnbW_event{grid-template-columns:24px 1fr;min-width:0;display:grid}.sVMnbW_rail{justify-content:center;display:flex;position:relative}.sVMnbW_rail:after{content:\"\";background:var(--trace-border);width:1px;position:absolute;top:22px;bottom:-12px}.sVMnbW_event:last-child .sVMnbW_rail:after{display:none}.sVMnbW_dot,.sVMnbW_toolDot,.sVMnbW_errorDot,.sVMnbW_markerDot{z-index:1;border:3px solid var(--dsw-color-bg-primary,#fbfcfa);width:9px;height:9px;box-shadow:0 0 0 1px var(--trace-border);border-radius:50%;margin-top:19px;position:relative}.sVMnbW_dot{background:#29825b}.sVMnbW_toolDot{background:#336fb0}.sVMnbW_errorDot{background:#c94242}.sVMnbW_markerDot{background:#9b7a3b}.sVMnbW_eventBody{border:1px solid var(--trace-border);background:color-mix(in srgb, var(--dsw-color-bg-primary,white) 97%, currentColor);border-radius:10px;min-width:0;margin:0 0 12px 7px;padding:14px 16px}.sVMnbW_publicEvent .sVMnbW_eventBody{border-left:3px solid #38956c}.sVMnbW_markerEvent .sVMnbW_eventBody{background:color-mix(in srgb, var(--dsw-color-bg-primary,white) 95%, #e6d6b5);border-style:dashed}.sVMnbW_toolEvent[data-tool-status=error] .sVMnbW_eventBody{border-left:3px solid #c94242}.sVMnbW_eventTopline{flex-wrap:wrap;align-items:center;gap:9px;display:flex}.sVMnbW_kind,.sVMnbW_toolName{font-size:13px;font-weight:750}.sVMnbW_streamBadge,.sVMnbW_streamLive{border:1px solid var(--trace-border);color:var(--trace-muted);border-radius:999px;padding:2px 6px;font-size:9px}.sVMnbW_streamLive{color:#12673f;background:#e9f8ef;border-color:#8bc9a8}.sVMnbW_toolName{color:#215f9a;font:750 14px ui-monospace,SFMono-Regular,Consolas,monospace}.sVMnbW_time,.sVMnbW_source{color:var(--trace-muted);font:11px ui-monospace,SFMono-Regular,Consolas,monospace}.sVMnbW_source{margin-left:auto}.sVMnbW_statusOk,.sVMnbW_statusError{border-radius:999px;padding:2px 6px;font-size:10px;font-weight:700}.sVMnbW_statusOk{color:#12673f;background:#e4f5eb}.sVMnbW_statusError{color:#a72e2e;background:#fde8e8}.sVMnbW_prose,.sVMnbW_markerCopy{white-space:pre-wrap;margin:10px 0 0;font-size:13px;line-height:1.6}.sVMnbW_markerCopy{color:var(--trace-muted)}.sVMnbW_transition{color:#315f8b;margin:9px 0 8px;font:650 12px ui-monospace,SFMono-Regular,Consolas,monospace}.sVMnbW_metrics{color:var(--trace-muted);flex-wrap:wrap;gap:8px 18px;font-size:11px;display:flex}.sVMnbW_metrics strong{color:inherit;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.sVMnbW_context{background:color-mix(in srgb, var(--dsw-color-bg-primary,white) 91%, #cfe9db);border-radius:7px;margin-top:10px;padding:9px 11px;font-size:12px;line-height:1.5}.sVMnbW_context span,.sVMnbW_previewGrid span{color:var(--trace-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;font-size:10px;font-weight:700;display:block}.sVMnbW_previewGrid{grid-template-columns:1fr 1fr;gap:9px;margin-top:10px;display:grid}.sVMnbW_previewGrid>div{border:1px solid var(--trace-border);border-radius:7px;min-width:0;padding:8px 10px}.sVMnbW_previewGrid code{color:inherit;white-space:nowrap;text-overflow:ellipsis;font-size:11px;display:block;overflow:hidden}.sVMnbW_expand{color:#1d7650;margin-top:9px;padding:5px 0;font-size:11px;font-weight:700}.sVMnbW_fullGrid{grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;display:grid}.sVMnbW_fullGrid section{min-width:0}.sVMnbW_fullGrid h4{margin:0 0 5px;font-size:11px}.sVMnbW_fullGrid pre{border:1px solid var(--trace-border);background:color-mix(in srgb, var(--dsw-color-bg-primary,#fff) 92%, #8aa59a);white-space:pre-wrap;word-break:break-word;border-radius:7px;max-height:380px;margin:0;padding:10px;font-size:10px;line-height:1.45;overflow:auto}.sVMnbW_footer{max-width:1150px;color:var(--trace-muted);margin:16px auto 0;padding-left:31px;font-size:11px}.sVMnbW_footer summary{cursor:pointer;font-weight:700}.sVMnbW_footer code,.sVMnbW_footer span{word-break:break-all;margin-top:5px;display:block}.sVMnbW_centerState{height:100%;color:var(--dsw-color-text-secondary,#66736b);place-items:center;display:grid}@media (width<=800px){.sVMnbW_root{padding:18px 12px 28px}.sVMnbW_header,.sVMnbW_boundary,.sVMnbW_controls{flex-direction:column;align-items:stretch}.sVMnbW_summary{grid-template-columns:repeat(2,1fr)}.sVMnbW_summary div{border-bottom:1px solid var(--trace-border)}.sVMnbW_previewGrid,.sVMnbW_fullGrid,.sVMnbW_errorGrid,.sVMnbW_comparisonContract{grid-template-columns:1fr}.sVMnbW_comparisonTable>div{grid-template-columns:1fr 1fr}.sVMnbW_comparisonTable>div span:last-child{grid-column:2}.sVMnbW_queueTitle{flex-direction:column;align-items:flex-start;gap:4px}.sVMnbW_queueList summary{grid-template-columns:28px 1fr}.sVMnbW_queueList summary small{grid-column:2}.sVMnbW_queueList dl{grid-template-columns:1fr;padding-left:12px}.sVMnbW_source{margin-left:0}}";
		const tagId = "dsh-external-trajectory-importer/observable-reasoning.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-external-trajectory-importer";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var observable_reasoning_module_css_default = {
			"recoveryLine": "sVMnbW_recoveryLine",
			"comparisonContract": "sVMnbW_comparisonContract",
			"queueList": "sVMnbW_queueList",
			"source": "sVMnbW_source",
			"transition": "sVMnbW_transition",
			"errorGrid": "sVMnbW_errorGrid",
			"errorChips": "sVMnbW_errorChips",
			"boundary": "sVMnbW_boundary",
			"comparisonTable": "sVMnbW_comparisonTable",
			"expand": "sVMnbW_expand",
			"timeline": "sVMnbW_timeline",
			"errorDot": "sVMnbW_errorDot",
			"markerDot": "sVMnbW_markerDot",
			"streamBadge": "sVMnbW_streamBadge",
			"controls": "sVMnbW_controls",
			"statusOk": "sVMnbW_statusOk",
			"queueTitle": "sVMnbW_queueTitle",
			"streamLive": "sVMnbW_streamLive",
			"noError": "sVMnbW_noError",
			"context": "sVMnbW_context",
			"footer": "sVMnbW_footer",
			"toolName": "sVMnbW_toolName",
			"header": "sVMnbW_header",
			"centerState": "sVMnbW_centerState",
			"eyebrow": "sVMnbW_eyebrow",
			"errorCategory": "sVMnbW_errorCategory",
			"kind": "sVMnbW_kind",
			"markerEvent": "sVMnbW_markerEvent",
			"time": "sVMnbW_time",
			"filters": "sVMnbW_filters",
			"exactBadge": "sVMnbW_exactBadge",
			"errorCompare": "sVMnbW_errorCompare",
			"implantQueue": "sVMnbW_implantQueue",
			"visibleCount": "sVMnbW_visibleCount",
			"publicEvent": "sVMnbW_publicEvent",
			"sequenceBadge": "sVMnbW_sequenceBadge",
			"errorCounts": "sVMnbW_errorCounts",
			"sectionTitle": "sVMnbW_sectionTitle",
			"workflowNode": "sVMnbW_workflowNode",
			"metrics": "sVMnbW_metrics",
			"prose": "sVMnbW_prose",
			"dot": "sVMnbW_dot",
			"toolDot": "sVMnbW_toolDot",
			"previewGrid": "sVMnbW_previewGrid",
			"summary": "sVMnbW_summary",
			"eventTopline": "sVMnbW_eventTopline",
			"streams": "sVMnbW_streams",
			"toolEvent": "sVMnbW_toolEvent",
			"statusError": "sVMnbW_statusError",
			"markerCopy": "sVMnbW_markerCopy",
			"event": "sVMnbW_event",
			"fullGrid": "sVMnbW_fullGrid",
			"root": "sVMnbW_root",
			"categoryChips": "sVMnbW_categoryChips",
			"rail": "sVMnbW_rail",
			"eventBody": "sVMnbW_eventBody"
		};
		//#endregion
		//#region src/client/observable-reasoning.tsx
		function formatTime(value) {
			if (value === null || value === void 0) return "未记录（仅保留源日志顺序）";
			return new Intl.DateTimeFormat("zh-CN", {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				fractionalSecondDigits: 3,
				hour12: false
			}).format(new Date(value));
		}
		function formatDuration(value) {
			if (value === null || value === void 0) return "不可计算";
			return value < 1e3 ? `${value} ms` : `${(value / 1e3).toFixed(value < 1e4 ? 3 : 1)} s`;
		}
		function lineEvidence(event) {
			if (event.kind === "tool") {
				if (event.callSourceSeq !== void 0 || event.resultSourceSeq !== void 0) return `Harness 调用事件 ${event.callSourceSeq === null || event.callSourceSeq === void 0 ? "未定位" : `#${event.callSourceSeq}`} · 结果事件 ${event.resultSourceSeq === null || event.resultSourceSeq === void 0 ? "运行中" : `#${event.resultSourceSeq}`}`;
				return `调用 ${event.callSourceLine === null || event.callSourceLine === void 0 ? "未单独记录" : `L${event.callSourceLine}`} · 结果 ${event.resultSourceLine === null || event.resultSourceLine === void 0 ? "未匹配" : `L${event.resultSourceLine}`}`;
			}
			return event.sourceLine === void 0 ? "源行未知" : `源行 L${event.sourceLine}`;
		}
		function safeNativeText(value) {
			const forbidden = /* @__PURE__ */ new Set([
				"analysis",
				"chain_of_thought",
				"reasoning",
				"reasoning_content",
				"signature",
				"thinking",
				"thinking_tokens"
			]);
			return ((typeof value === "string" ? value : JSON.stringify(value, (key, item) => forbidden.has(key.toLowerCase()) ? void 0 : item)) ?? "").replace(/((?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret|authorization)\s*[=:]\s*)([^\s,;]+)/gi, "$1[REDACTED]").replace(/("(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret|authorization)"\s*:\s*")[^"]*(")/gi, "$1[REDACTED]$2").replace(/\b(Bearer\s+)[A-Za-z0-9._~+\x2f-]+=*/gi, "$1[REDACTED]");
		}
		function nativePreview(value, limit = 280) {
			const normalized = safeNativeText(value).replace(/\s+/g, " ").trim();
			return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`;
		}
		function buildNativeTrace(snapshot) {
			const events = [];
			const tools = /* @__PURE__ */ new Map();
			let phase = 0;
			let publicContext = "";
			for (const node of snapshot.nodes) if (node.kind === "assistant") node.blocks.forEach((block, blockIndex) => {
				if (block.kind === "reasoning") events.push({
					seq: 0,
					sortSeq: node.seq + blockIndex / 1e3,
					kind: "private_reasoning_marker",
					phase,
					timestampMs: node.time,
					timeEvidence: "harness-event",
					sourceLine: node.seq,
					...node.messageId === void 0 ? {} : { messageId: String(node.messageId) },
					contentOmitted: true,
					label: "私有 reasoning 事件（内容不可见）"
				});
				else if (block.kind === "text" && block.text.trim() !== "") {
					phase += 1;
					publicContext = safeNativeText(block.text);
					events.push({
						seq: 0,
						sortSeq: node.seq + blockIndex / 1e3,
						kind: "public_reasoning",
						phase,
						timestampMs: node.time,
						timeEvidence: "harness-event",
						sourceLine: node.seq,
						...node.messageId === void 0 ? {} : { messageId: String(node.messageId) },
						text: publicContext,
						preview: nativePreview(publicContext)
					});
				} else if (block.kind === "tool-call") {
					const argumentsText = safeNativeText(block.argsRaw);
					const tool = {
						seq: 0,
						sortSeq: node.seq + blockIndex / 1e3,
						kind: "tool",
						phase,
						timestampMs: null,
						resultTimestampMs: null,
						timeEvidence: "harness-event",
						durationMs: null,
						gapFromPreviousToolMs: null,
						callId: block.callId,
						toolName: block.name,
						status: "pending",
						exitCode: null,
						callSourceSeq: node.seq,
						resultSourceSeq: null,
						arguments: argumentsText,
						argumentsPreview: nativePreview(argumentsText),
						result: "",
						resultPreview: "",
						publicContextBefore: publicContext,
						publicContextPreview: publicContext === "" ? "" : nativePreview(publicContext)
					};
					events.push(tool);
					tools.set(block.callId, tool);
				}
			});
			else if (node.kind === "tool-result") {
				let tool = tools.get(node.callId);
				if (tool === void 0) {
					const argumentsText = safeNativeText(node.call?.argsRaw ?? "{}");
					tool = {
						seq: 0,
						sortSeq: node.seq - .001,
						kind: "tool",
						phase,
						timestampMs: node.callTime,
						resultTimestampMs: node.time,
						timeEvidence: "harness-event",
						durationMs: node.callTime === null ? null : Math.max(0, node.time - node.callTime),
						gapFromPreviousToolMs: null,
						callId: node.callId,
						toolName: node.call?.name ?? "unknown_tool",
						status: node.isError ? "error" : "success",
						exitCode: null,
						callSourceSeq: null,
						resultSourceSeq: node.seq,
						arguments: argumentsText,
						argumentsPreview: nativePreview(argumentsText),
						result: safeNativeText(node.content),
						resultPreview: nativePreview(node.content),
						publicContextBefore: publicContext,
						publicContextPreview: publicContext === "" ? "" : nativePreview(publicContext)
					};
					events.push(tool);
					tools.set(node.callId, tool);
				} else {
					tool.timestampMs = node.callTime;
					tool.resultTimestampMs = node.time;
					tool.durationMs = node.callTime === null ? null : Math.max(0, node.time - node.callTime);
					tool.status = node.isError ? "error" : "success";
					tool.resultSourceSeq = node.seq;
					tool.result = safeNativeText(node.content);
					tool.resultPreview = nativePreview(node.content);
				}
			}
			for (const running of snapshot.runningCalls) {
				if (tools.has(running.callId)) continue;
				const argumentsText = safeNativeText(running.argsRaw);
				const tool = {
					seq: 0,
					sortSeq: Number.MAX_SAFE_INTEGER,
					kind: "tool",
					phase,
					timestampMs: running.time,
					resultTimestampMs: null,
					timeEvidence: "harness-event",
					durationMs: null,
					gapFromPreviousToolMs: null,
					callId: running.callId,
					toolName: running.name,
					status: "pending",
					exitCode: null,
					callSourceSeq: null,
					resultSourceSeq: null,
					arguments: argumentsText,
					argumentsPreview: nativePreview(argumentsText),
					result: "",
					resultPreview: "",
					publicContextBefore: publicContext,
					publicContextPreview: publicContext === "" ? "" : nativePreview(publicContext)
				};
				events.push(tool);
				tools.set(running.callId, tool);
			}
			events.sort((left, right) => (left.sortSeq ?? 0) - (right.sortSeq ?? 0));
			const toolEvents = events.filter((event) => event.kind === "tool");
			toolEvents.forEach((event, index) => {
				const previous = toolEvents[index - 1];
				const next = toolEvents[index + 1];
				event.previousTool = previous?.toolName ?? null;
				event.nextTool = next?.toolName ?? null;
				event.transition = previous === void 0 ? `START → ${event.toolName}` : `${previous.toolName} → ${event.toolName}`;
				const previousEnd = previous?.resultTimestampMs ?? previous?.timestampMs;
				event.gapFromPreviousToolMs = previousEnd !== null && previousEnd !== void 0 && event.timestampMs !== null ? Math.max(0, event.timestampMs - previousEnd) : null;
			});
			events.forEach((event, index) => {
				event.seq = index + 1;
				delete event.sortSeq;
			});
			const turnTimes = [...snapshot.turnTimings.values()];
			const startedAtMs = turnTimes.length === 0 ? Date.now() : Math.min(...turnTimes.map((item) => item.startTime));
			const finishedCandidates = turnTimes.flatMap((item) => item.endTime === void 0 ? [] : [item.endTime]);
			const finishedAtMs = snapshot.running || finishedCandidates.length === 0 ? Date.now() : Math.max(...finishedCandidates);
			const implantAgent = toolEvents.some((event) => event.toolName?.includes("implantagent") === true);
			return {
				schemaVersion: 1,
				sessionId: snapshot.sessionId,
				agent: implantAgent ? "implantagent" : "harness",
				caseId: implantAgent ? "ImplantAgent live session" : "Harness live session",
				title: "Harness native live observable trace",
				source: {
					path: "Harness 当前会话的实时事件流",
					malformedLines: [],
					timeCoverage: "harness-live-events"
				},
				run: {
					startedAtMs,
					finishedAtMs,
					durationMs: Math.max(0, finishedAtMs - startedAtMs)
				},
				boundary: {
					hiddenChainOfThoughtIncluded: false,
					hiddenReasoningMarkersContainContent: false
				},
				stats: {
					observableEvents: events.length,
					toolCalls: toolEvents.length,
					publicReasoningEvents: events.filter((event) => event.kind === "public_reasoning").length,
					publicPlanEvents: 0,
					privateReasoningMarkers: events.filter((event) => event.kind === "private_reasoning_marker").length,
					successfulTools: toolEvents.filter((event) => event.status === "success").length,
					failedTools: toolEvents.filter((event) => event.status === "error").length,
					exactToolTimestamps: toolEvents.filter((event) => event.timestampMs !== null).length,
					exactToolDurations: toolEvents.filter((event) => event.durationMs !== null).length
				},
				events,
				live: snapshot.running
			};
		}
		function toolStatusLabel(status) {
			if (status === "success") return "成功";
			if (status === "error") return "失败";
			return "未匹配结果";
		}
		function StreamBadge({ event }) {
			if (event.streamLabel === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: event.streamLive ? observable_reasoning_module_css_default.streamLive : observable_reasoning_module_css_default.streamBadge,
				children: [
					event.streamLabel,
					" · ",
					event.streamCaseId
				]
			});
		}
		function PublicEvent({ event }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: `${observable_reasoning_module_css_default.event} ${observable_reasoning_module_css_default.publicEvent}`,
				"data-event-kind": event.kind,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: observable_reasoning_module_css_default.rail,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: observable_reasoning_module_css_default.dot })
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: observable_reasoning_module_css_default.eventBody,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: observable_reasoning_module_css_default.eventTopline,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StreamBadge, { event }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: observable_reasoning_module_css_default.kind,
								children: event.kind === "public_plan" ? "公开计划" : "公开决策文本"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: observable_reasoning_module_css_default.time,
								children: formatTime(event.timestampMs)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: observable_reasoning_module_css_default.source,
								children: lineEvidence(event)
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: observable_reasoning_module_css_default.prose,
						children: event.text
					})]
				})]
			});
		}
		function MarkerEvent({ event }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: `${observable_reasoning_module_css_default.event} ${observable_reasoning_module_css_default.markerEvent}`,
				"data-event-kind": event.kind,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: observable_reasoning_module_css_default.rail,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: observable_reasoning_module_css_default.markerDot })
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: observable_reasoning_module_css_default.eventBody,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: observable_reasoning_module_css_default.eventTopline,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StreamBadge, { event }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: observable_reasoning_module_css_default.kind,
								children: "私有 reasoning 标记"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: observable_reasoning_module_css_default.time,
								children: formatTime(event.timestampMs)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: observable_reasoning_module_css_default.source,
								children: lineEvidence(event)
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: observable_reasoning_module_css_default.markerCopy,
						children: "日志记录了 reasoning 事件，但本页不显示、也不重建其内容。"
					})]
				})]
			});
		}
		function ToolEvent({ event }) {
			const [expanded, setExpanded] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: `${observable_reasoning_module_css_default.event} ${observable_reasoning_module_css_default.toolEvent}`,
				"data-event-kind": "tool",
				"data-tool-status": event.status,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: observable_reasoning_module_css_default.rail,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: event.status === "error" ? observable_reasoning_module_css_default.errorDot : observable_reasoning_module_css_default.toolDot })
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: observable_reasoning_module_css_default.eventBody,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: observable_reasoning_module_css_default.eventTopline,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StreamBadge, { event }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: observable_reasoning_module_css_default.toolName,
									children: event.toolName
								}),
								event.workflowNodeId !== null && event.workflowNodeId !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: observable_reasoning_module_css_default.workflowNode,
									children: event.workflowNodeId
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: event.status === "error" ? observable_reasoning_module_css_default.statusError : observable_reasoning_module_css_default.statusOk,
									children: toolStatusLabel(event.status)
								}),
								event.status === "error" && event.errorCategoryLabel !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: observable_reasoning_module_css_default.errorCategory,
									children: event.errorCategoryLabel
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: observable_reasoning_module_css_default.time,
									children: formatTime(event.timestampMs)
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: observable_reasoning_module_css_default.transition,
							children: event.transition
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: observable_reasoning_module_css_default.metrics,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["耗时 ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: formatDuration(event.durationMs) })] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["距上一工具 ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: formatDuration(event.gapFromPreviousToolMs) })] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: lineEvidence(event) })
							]
						}),
						event.publicContextPreview !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: observable_reasoning_module_css_default.context,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "调用前公开上下文" }), event.publicContextPreview]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: observable_reasoning_module_css_default.previewGrid,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "参数" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: event.argumentsPreview || "—" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "结果" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: event.resultPreview || "—" })] })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: observable_reasoning_module_css_default.expand,
							type: "button",
							onClick: () => {
								setExpanded((value) => !value);
							},
							children: expanded ? "收起完整参数与结果" : "查看完整参数与结果"
						}),
						expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: observable_reasoning_module_css_default.fullGrid,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "完整参数（已做密钥模式脱敏）" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: event.arguments || "—" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "完整结果（已做密钥模式脱敏）" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: event.result || "—" })] })]
						})
					]
				})]
			});
		}
		function ObservableReasoningView({ sessionId, useSession }) {
			const [trace, setTrace] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [nativeMode, setNativeMode] = (0, react.useState)(false);
			const [filter, setFilter] = (0, react.useState)("all");
			const [query, setQuery] = (0, react.useState)("");
			const snapshot = useSession((value) => value);
			const nativeTrace = (0, react.useMemo)(() => buildNativeTrace(snapshot), [snapshot]);
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				setTrace(null);
				setError(null);
				setNativeMode(false);
				const refresh = () => fetch(`/api/external-reasoning-trace/${encodeURIComponent(sessionId)}`, {
					signal: controller.signal,
					cache: "no-store"
				}).then(async (response) => {
					if (response.status === 404 && !sessionId.startsWith("session-external-trajectory-")) {
						setNativeMode(true);
						return null;
					}
					if (response.status === 404) throw new Error("历史导入会话已停用；请打开 [Live Monitor] 查看实时与结束后比较。");
					if (!response.ok) throw new Error(`读取轨迹失败（HTTP ${response.status}）`);
					return response.json();
				}).then((value) => {
					if (value !== null) setTrace(value);
				}).catch((reason) => {
					if (reason instanceof DOMException && reason.name === "AbortError") return;
					setError(reason instanceof Error ? reason.message : String(reason));
				});
				refresh();
				const timer = sessionId.includes("live-monitor-v1") ? window.setInterval(() => {
					refresh();
				}, 3e3) : void 0;
				return () => {
					controller.abort();
					if (timer !== void 0) window.clearInterval(timer);
				};
			}, [sessionId]);
			const activeTrace = nativeMode ? nativeTrace : trace;
			const visible = (0, react.useMemo)(() => {
				if (activeTrace === null) return [];
				const needle = query.trim().toLowerCase();
				return activeTrace.events.filter((event) => {
					if (filter === "tools" && event.kind !== "tool") return false;
					if (filter === "public" && event.kind !== "public_reasoning" && event.kind !== "public_plan") return false;
					if (filter === "markers" && event.kind !== "private_reasoning_marker") return false;
					if (needle === "") return true;
					return [
						event.streamLabel,
						event.streamCaseId,
						event.toolName,
						event.transition,
						event.preview,
						event.argumentsPreview,
						event.resultPreview,
						event.publicContextPreview
					].some((value) => value?.toLowerCase().includes(needle) === true);
				});
			}, [
				activeTrace,
				filter,
				query
			]);
			if (error !== null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: observable_reasoning_module_css_default.centerState,
				children: error
			});
			if (activeTrace === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: observable_reasoning_module_css_default.centerState,
				children: "正在读取可观察轨迹…"
			});
			const shownTrace = activeTrace;
			const exact = shownTrace.source.timeCoverage !== "run-boundaries-only";
			const liveNative = shownTrace.source.timeCoverage === "harness-live-events";
			const liveExternal = shownTrace.source.timeCoverage === "mixed-live-sources";
			const implantDiagnostics = shownTrace.errorComparison?.find((arm) => arm.id === "implantagent-external");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: observable_reasoning_module_css_default.root,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: observable_reasoning_module_css_default.header,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: observable_reasoning_module_css_default.eyebrow,
								children: ["OBSERVABLE REASONING TRACE · ", shownTrace.agent.toUpperCase()]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h2", { children: [shownTrace.caseId, " 工具调用与公开决策路径"] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "显示公开文本、真实工具调用/结果与工具切换；不显示或推断隐藏思维链。" })
						] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: exact ? observable_reasoning_module_css_default.exactBadge : observable_reasoning_module_css_default.sequenceBadge,
							children: liveNative ? `Harness 实时事件${shownTrace.live ? " · 正在运行" : ""}` : liveExternal ? `外部 JSONL 实时同步${shownTrace.live ? " · 检测到写入" : ""}` : exact ? "逐事件时间：源日志精确记录" : "逐事件时间：源日志未记录"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: observable_reasoning_module_css_default.boundary,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: liveNative ? "Harness 实时轴" : liveExternal ? "多智能体同步观察轴" : exact ? "Claude 时间轴" : "Codex 顺序轴" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: liveNative ? "页面直接订阅当前 Harness 会话；ImplantAgent T01–T13、web search 和其他真实工具会在调用与返回时自动更新。" : liveExternal ? "每 3 秒只读刷新各 arm 最新 JSONL。各 arm 内顺序真实；Claude 与 ImplantAgent 工具审计保留精确时间，Codex 缺失的逐事件时间不会被补造，因此不声称跨 arm 的严格时间排序。" : exact ? "工具调用与结果时间来自 stream-json；耗时和切换间隔由这两个源时间相减。" : "这批 --json 只有运行开始/结束时间。本页仅按 JSONL 源行显示真实顺序，单步时间和耗时明确标为不可计算。" })]
					}),
					shownTrace.streams !== void 0 && shownTrace.streams.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
						className: observable_reasoning_module_css_default.streams,
						children: shownTrace.streams.map((stream) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							"data-live": stream.live,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: stream.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: stream.live ? "正在写入" : "最近记录" })] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: stream.caseId }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "工具" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: stream.toolCalls }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "公开决策" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: stream.publicReasoningEvents }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "失败" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: stream.failedTools })
								] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: stream.timeCoverage === "run-boundaries-only" ? "源内顺序；无逐事件时间" : "源事件时间可用" })
							]
						}, stream.id))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: observable_reasoning_module_css_default.summary,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "工具调用" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: shownTrace.stats.toolCalls })] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "公开决策/计划" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: (shownTrace.stats.publicReasoningEvents ?? 0) + (shownTrace.stats.publicPlanEvents ?? 0) })] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "失败工具" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: shownTrace.stats.failedTools })] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "精确耗时" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
								shownTrace.stats.exactToolDurations,
								"/",
								shownTrace.stats.toolCalls
							] })] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "运行总时长" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: formatDuration(shownTrace.run.durationMs) })] })
						]
					}),
					shownTrace.errorComparison !== void 0 && shownTrace.errorComparison.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: observable_reasoning_module_css_default.errorCompare,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: observable_reasoning_module_css_default.comparisonContract,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "统一比较的是执行事实，不是强行统一工作流" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "ImplantAgent 保留固定业务节点；Codex/Claude 保留自由编排。三者只在工具调用、参数、结果、失败、恢复、顺序和可用时间证据上使用同一口径。" })]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: observable_reasoning_module_css_default.comparisonTable,
								role: "table",
								"aria-label": "三智能体统一执行指标",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									role: "row",
									"data-head": "true",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "智能体" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "编排" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "工具/种类" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "失败" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "已恢复" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "进行中" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "时间证据" })
									]
								}), shownTrace.errorComparison.map((arm) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									role: "row",
									"data-focus": arm.id === "implantagent-external",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: arm.label }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [arm.workflowMode, arm.workflowNodeCount > 0 ? ` · ${arm.workflowNodeCount} 节点` : ""] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
											arm.toolCalls,
											" / ",
											arm.uniqueTools
										] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: arm.failedTools }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: arm.recoveredFailures }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: arm.pendingTools }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: arm.timeCoverage === "source-event-timestamps" ? "逐事件时间" : "源顺序" })
									]
								}, `compare-${arm.id}`))]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: observable_reasoning_module_css_default.sectionTitle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "POST-RUN ERROR COMPARISON" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "三臂错误对比" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "按最新完成/正在写入的同名 arm 汇总；重点卡片为 ImplantAgent。" })]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: observable_reasoning_module_css_default.errorGrid,
								children: shownTrace.errorComparison.map((arm) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
									"data-focus": arm.id === "implantagent-external",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: arm.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: arm.caseId })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("b", { children: [(arm.failureRate * 100).toFixed(1), "%"] })] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: observable_reasoning_module_css_default.errorCounts,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [arm.failedTools, " 次失败"] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [arm.toolCalls, " 次调用"] })]
										}),
										arm.failedTools > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: observable_reasoning_module_css_default.recoveryLine,
											children: [
												"已观察恢复 ",
												arm.recoveredFailures,
												" · 未观察恢复 ",
												arm.unrecoveredFailures,
												arm.averageRecoveryToolSteps !== null ? ` · 平均 ${arm.averageRecoveryToolSteps.toFixed(1)} 个工具步` : ""
											]
										}),
										arm.errorCategories.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: observable_reasoning_module_css_default.categoryChips,
											children: arm.errorCategories.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("code", { children: [
												item.label,
												" × ",
												item.count
											] }, item.label))
										}),
										arm.errorTools.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: observable_reasoning_module_css_default.errorChips,
											children: arm.errorTools.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("code", { children: [
												item.toolName,
												" × ",
												item.count
											] }, item.toolName))
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: observable_reasoning_module_css_default.noError,
											children: "未观察到失败工具。"
										}),
										arm.firstError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
											"首个错误：",
											arm.firstError.toolName,
											" · ",
											arm.firstError.errorCategoryLabel
										] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "时间" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: formatTime(arm.firstError.timestampMs) }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "切换" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: arm.firstError.transition || "—" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "源位置" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dd", { children: [
												"调用 L",
												arm.firstError.callSourceLine ?? "—",
												" · 结果 L",
												arm.firstError.resultSourceLine ?? "—"
											] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "调用前公开上下文" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: arm.firstError.publicContextPreview || "无公开文本" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "参数" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: arm.firstError.argumentsPreview || "—" }) }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "错误结果" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: arm.firstError.resultPreview || "—" }) })
										] })] })
									]
								}, arm.id))
							}),
							implantDiagnostics !== void 0 && implantDiagnostics.diagnostics.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: observable_reasoning_module_css_default.implantQueue,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: observable_reasoning_module_css_default.queueTitle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "IMPLANTAGENT DEBUG QUEUE" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "ImplantAgent 调试队列" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [implantDiagnostics.diagnostics.length, " 个失败，按真实源日志顺序列出；这里不自动改代码或重跑模型。"] })]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: observable_reasoning_module_css_default.queueList,
									children: implantDiagnostics.diagnostics.map((item, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
										open: index === 0,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("b", { children: ["#", index + 1] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: item.toolName || item.rawToolName || "tool" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: item.errorCategoryLabel || "工具执行失败" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
												"L",
												item.callSourceLine ?? "—",
												" → L",
												item.resultSourceLine ?? "—"
											] })
										] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "时间" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: formatTime(item.timestampMs) }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "工具切换" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: item.transition || "—" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "调用前公开上下文" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: item.publicContextPreview || "无公开文本" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "参数/命令" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: item.argumentsPreview || "—" }) }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "错误结果" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: item.resultPreview || "—" }) })
										] })]
									}, `${item.resultSourceLine ?? index}-${item.toolName ?? "tool"}`))
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: observable_reasoning_module_css_default.controls,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: observable_reasoning_module_css_default.filters,
								children: [
									["all", "全部"],
									["tools", "仅工具"],
									["public", "仅公开决策"],
									["markers", "仅私有标记"]
								].map(([value, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									"data-active": filter === value,
									onClick: () => {
										setFilter(value);
									},
									children: label
								}, value))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								value: query,
								onChange: (event) => {
									setQuery(event.target.value);
								},
								placeholder: "搜索工具、参数、结果或公开上下文"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: observable_reasoning_module_css_default.visibleCount,
								children: [
									"显示 ",
									visible.length,
									"/",
									shownTrace.events.length
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("main", {
						className: observable_reasoning_module_css_default.timeline,
						children: visible.map((event) => event.kind === "tool" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolEvent, { event }, `event-${event.seq}`) : event.kind === "private_reasoning_marker" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarkerEvent, { event }, `event-${event.seq}`) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PublicEvent, { event }, `event-${event.seq}`))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("footer", {
						className: observable_reasoning_module_css_default.footer,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "审计来源" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: shownTrace.source.path }),
							shownTrace.source.sha256 !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("code", { children: ["SHA-256 ", shownTrace.source.sha256] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								"运行：",
								formatTime(shownTrace.run.startedAtMs),
								" → ",
								formatTime(shownTrace.run.finishedAtMs)
							] })
						] })
					})
				]
			});
		}
		const inject = ["slots"];
		function apply(ctx) {
			ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "observable-reasoning",
				order: 20,
				label: "可观察推理",
				inject: (sessionId) => ({ sessionId })
			}, ObservableReasoningView));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map