import { useState } from "react";
import type { Agent } from "../../types";

const SKILL_OPTIONS = [
  "文案写作", "代码生成", "数据分析", "翻译润色",
  "逻辑推理", "创意策划", "摘要提炼", "问答对话",
  "情感支持", "知识检索", "图表解读", "任务规划",
];

const OUTPUT_FORMATS = ["纯文本", "Markdown", "JSON", "列表", "表格"];
const MEMORY_OPTIONS = ["短期（8K）", "中期（32K）", "长期（128K）"];
const TEMP_OPTIONS = ["0.1", "0.3", "0.5", "0.7", "0.9", "1.0"];

const MODEL_OPTIONS = [
  { label: "GPT-4o",        desc: "OpenAI" },
  { label: "GPT-4 Turbo",   desc: "OpenAI" },
  { label: "o1",            desc: "OpenAI" },
  { label: "Claude 3.5",    desc: "Anthropic" },
  { label: "Claude 3 Opus", desc: "Anthropic" },
  { label: "Gemini 1.5 Pro",desc: "Google" },
  { label: "Gemini 2.0",    desc: "Google" },
  { label: "DeepSeek-V3",   desc: "DeepSeek" },
  { label: "DeepSeek-R1",   desc: "DeepSeek" },
  { label: "Qwen-Max",      desc: "阿里云" },
  { label: "Qwen2.5-72B",   desc: "阿里云" },
  { label: "混元 Turbo",    desc: "腾讯云" },
];

interface Props {
  onCancel: () => void;
  onCreate: (data: Omit<Agent, "id" | "createdAt">) => void;
}

const inputBase: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid #E5E5E5",
  borderRadius: 8,
  fontSize: 13,
  color: "#333333",
  background: "#FAFAFA",
  outline: "none",
  transition: "border-color 0.15s, background 0.15s",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#666666",
  marginBottom: 8,
  display: "block",
};

function TagSelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              fontSize: 12,
              border: `1px solid ${active ? "#A5C8FF" : "#E5E5E5"}`,
              background: active ? "#EBF4FF" : "#FAFAFA",
              color: active ? "#2478E5" : "#666666",
              cursor: "pointer",
              transition: "all 0.15s",
              fontWeight: active ? 600 : 400,
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.borderColor = "#CCCCCC";
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.borderColor = "#E5E5E5";
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/** 核心技能弹窗多选 */
function SkillPickerModal({
  selected,
  onConfirm,
  onClose,
}: {
  selected: string[];
  onConfirm: (v: string[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<string[]>(selected);

  const toggle = (opt: string) => {
    setDraft((prev) =>
      prev.includes(opt) ? prev.filter((s) => s !== opt) : [...prev, opt]
    );
  };

  return (
    /* 遮罩 */
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
    >
      {/* 弹窗主体 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: 12,
          padding: "24px 28px 20px",
          width: 420,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        }}
      >
        {/* 标题 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#333333" }}>选择核心技能</span>
          <span style={{ fontSize: 12, color: "#AAAAAA" }}>已选 {draft.length} / {SKILL_OPTIONS.length}</span>
        </div>

        {/* 技能网格 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
          {SKILL_OPTIONS.map((opt) => {
            const active = draft.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                style={{
                  padding: "7px 0",
                  borderRadius: 8,
                  fontSize: 12,
                  border: `1px solid ${active ? "#A5C8FF" : "#E5E5E5"}`,
                  background: active ? "#EBF4FF" : "#FAFAFA",
                  color: active ? "#2478E5" : "#555555",
                  cursor: "pointer",
                  fontWeight: active ? 600 : 400,
                  transition: "all 0.15s",
                  textAlign: "center",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = "#F0F0F0";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "#FAFAFA";
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {/* 操作按钮 */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "7px 18px", background: "#F5F5F5", color: "#666666", border: "none", borderRadius: 7, fontSize: 13, cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#EBEBEB")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#F5F5F5")}
          >取消</button>
          <button
            onClick={() => { onConfirm(draft); onClose(); }}
            style={{ padding: "7px 22px", background: "#2478E5", color: "#FFFFFF", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1A68D0")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#2478E5")}
          >确认</button>
        </div>
      </div>
    </div>
  );
}

/** 模型切换弹窗单选 */
function ModelPickerModal({
  selected,
  onConfirm,
  onClose,
}: {
  selected: string;
  onConfirm: (v: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(selected);

  const groups: Record<string, typeof MODEL_OPTIONS> = {};
  MODEL_OPTIONS.forEach((m) => {
    if (!groups[m.desc]) groups[m.desc] = [];
    groups[m.desc].push(m);
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: 12,
          padding: "24px 28px 20px",
          width: 460,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: "#333333", marginBottom: 16 }}>选择模型</div>

        {Object.entries(groups).map(([provider, models]) => (
          <div key={provider} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#AAAAAA", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>{provider}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {models.map((m) => {
                const active = draft === m.label;
                return (
                  <button
                    key={m.label}
                    onClick={() => setDraft(m.label)}
                    style={{
                      padding: "6px 16px",
                      borderRadius: 20,
                      fontSize: 12,
                      border: `1px solid ${active ? "#A5C8FF" : "#E5E5E5"}`,
                      background: active ? "#EBF4FF" : "#FAFAFA",
                      color: active ? "#2478E5" : "#555555",
                      cursor: "pointer",
                      fontWeight: active ? 600 : 400,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#F0F0F0"; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "#FAFAFA"; }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{ padding: "7px 18px", background: "#F5F5F5", color: "#666666", border: "none", borderRadius: 7, fontSize: 13, cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#EBEBEB")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#F5F5F5")}
          >取消</button>
          <button
            onClick={() => { onConfirm(draft); onClose(); }}
            style={{ padding: "7px 22px", background: "#2478E5", color: "#FFFFFF", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1A68D0")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#2478E5")}
          >确认</button>
        </div>
      </div>
    </div>
  );
}

export function AgentCreateForm({ onCancel, onCreate }: Props) {
  const [name, setName] = useState("");
  const [model, setModel] = useState("GPT-4o");
  const [role, setRole] = useState("");
  const [style, setStyle] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [boundary, setBoundary] = useState("");
  const [outputFormat, setOutputFormat] = useState("纯文本");
  const [memory, setMemory] = useState("中期（32K）");
  const [temperature, setTemperature] = useState("0.7");

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      color: "#6366f1",
      systemPrompt: role.trim(),
      writingStyle: style.trim(),
      expertise: selectedSkills,
      description: boundary.trim(),
      status: "idle",
    });
    setName(""); setRole(""); setStyle("");
    setSelectedSkills([]); setBoundary("");
    setOutputFormat("纯文本"); setMemory("中期（32K）"); setTemperature("0.7");
  };

  const focusInput = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "#A5C8FF";
    e.currentTarget.style.background = "#FFFFFF";
  };
  const blurInput = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "#E5E5E5";
    e.currentTarget.style.background = "#FAFAFA";
  };

  return (
    <>
      {skillModalOpen && (
        <SkillPickerModal
          selected={selectedSkills}
          onConfirm={(v) => setSelectedSkills(v)}
          onClose={() => setSkillModalOpen(false)}
        />
      )}
      {modelModalOpen && (
        <ModelPickerModal
          selected={model}
          onConfirm={(v) => setModel(v)}
          onClose={() => setModelModalOpen(false)}
        />
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "16px 32px 28px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* 名称 + 语言风格 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>智能体名称</label>
              <input style={inputBase} value={name} onChange={(e) => setName(e.target.value)}
                placeholder="例：写作助手" onFocus={focusInput} onBlur={blurInput} />
            </div>
            <div>
              <label style={labelStyle}>语言风格</label>
              <input style={inputBase} value={style} onChange={(e) => setStyle(e.target.value)}
                placeholder="例：严谨学术 / 轻松口语" onFocus={focusInput} onBlur={blurInput} />
            </div>
          </div>

          {/* 角色设定 */}
          <div>
            <label style={labelStyle}>角色设定</label>
            <textarea
              style={{ ...inputBase, resize: "none", lineHeight: 1.6 } as React.CSSProperties}
              rows={3} value={role} onChange={(e) => setRole(e.target.value)}
              placeholder="描述该智能体的角色定位与核心职责…"
              onFocus={focusInput as unknown as React.FocusEventHandler<HTMLTextAreaElement>}
              onBlur={blurInput as unknown as React.FocusEventHandler<HTMLTextAreaElement>}
            />
          </div>

          {/* 核心技能 + 模型切换 — 同一排两列 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

            {/* 核心技能 — 弹窗多选 */}
            <div>
              <label style={labelStyle}>核心技能</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {selectedSkills.length > 0 ? (
                  selectedSkills.map((s) => (
                    <span
                      key={s}
                      style={{
                        padding: "4px 12px",
                        borderRadius: 20,
                        fontSize: 12,
                        background: "#EBF4FF",
                        color: "#2478E5",
                        border: "1px solid #A5C8FF",
                        fontWeight: 600,
                      }}
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: 12, color: "#AAAAAA" }}>未选择任何技能</span>
                )}
                <button
                  onClick={() => setSkillModalOpen(true)}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 20,
                    fontSize: 12,
                    border: "1px dashed #C0D8F5",
                    background: "#F5FAFF",
                    color: "#2478E5",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    marginLeft: selectedSkills.length > 0 ? 4 : 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#EBF4FF")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#F5FAFF")}
                >
                  {selectedSkills.length > 0 ? "编辑" : "+ 选择技能"}
                </button>
              </div>
            </div>

            {/* 模型切换 — 弹窗单选 */}
            <div>
              <label style={labelStyle}>模型切换</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  padding: "4px 14px",
                  borderRadius: 20,
                  fontSize: 12,
                  background: "#EBF4FF",
                  color: "#2478E5",
                  border: "1px solid #A5C8FF",
                  fontWeight: 600,
                }}>
                  {model}
                </span>
                <button
                  onClick={() => setModelModalOpen(true)}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 20,
                    fontSize: 12,
                    border: "1px dashed #C0D8F5",
                    background: "#F5FAFF",
                    color: "#2478E5",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#EBF4FF")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#F5FAFF")}
                >
                  切换
                </button>
              </div>
            </div>

          </div>

          {/* 能力边界 */}
          <div>
            <label style={labelStyle}>能力边界</label>
            <textarea
              style={{ ...inputBase, resize: "none", lineHeight: 1.6 } as React.CSSProperties}
              rows={2} value={boundary} onChange={(e) => setBoundary(e.target.value)}
              placeholder="描述该智能体不应处理的任务范围或限制…"
              onFocus={focusInput as unknown as React.FocusEventHandler<HTMLTextAreaElement>}
              onBlur={blurInput as unknown as React.FocusEventHandler<HTMLTextAreaElement>}
            />
          </div>

          {/* 输出格式 / 记忆长度 / 温度值 — 同一排 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>输出格式</label>
              <TagSelect options={OUTPUT_FORMATS} value={outputFormat}
                onChange={(v) => setOutputFormat(v)} />
            </div>
            <div>
              <label style={labelStyle}>记忆长度</label>
              <TagSelect options={MEMORY_OPTIONS} value={memory}
                onChange={(v) => setMemory(v)} />
            </div>
            <div>
              <label style={labelStyle}>
                温度值
                <span style={{ fontWeight: 400, color: "#AAAAAA", marginLeft: 6 }}>当前：{temperature}</span>
              </label>
              <TagSelect options={TEMP_OPTIONS} value={temperature}
                onChange={(v) => setTemperature(v)} />
            </div>
          </div>

          {/* 操作按钮 */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", paddingTop: 4 }}>
            <button
              onClick={onCancel}
              style={{ padding: "9px 22px", background: "#F5F5F5", color: "#666666", border: "none", borderRadius: 7, fontSize: 13, cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#EBEBEB")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#F5F5F5")}
            >取消</button>
            <button
              onClick={handleCreate}
              style={{ padding: "9px 28px", background: name.trim() ? "#2478E5" : "#C5D9F5", color: "#FFFFFF", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: name.trim() ? "pointer" : "not-allowed", transition: "background 0.15s" }}
              onMouseEnter={(e) => { if (name.trim()) e.currentTarget.style.background = "#1A68D0"; }}
              onMouseLeave={(e) => { if (name.trim()) e.currentTarget.style.background = "#2478E5"; }}
            >创建</button>
          </div>

        </div>
      </div>
    </>
  );
}
