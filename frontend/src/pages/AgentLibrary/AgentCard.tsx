/**
 * AgentCard.tsx - 单个智能体卡片组件
 *
 * 展示智能体的 emoji、名称、描述、系统提示、风格、输出格式和执行分类，
 * 并提供"创建"按钮触发创建流程。
 */

import { AgentTemplate } from "../../types";
import {
  cnName,
  cnDesc,
  templateCategoryToAgentType,
  WRITING_STYLE_CN,
  OUTPUT_FORMAT_CN,
  AGENT_TYPE_LABELS,
} from "./constants";

interface AgentCardProps {
  template: AgentTemplate;
  onCreate: (template: AgentTemplate) => void;
}

export default function AgentCard({ template: t, onCreate }: AgentCardProps) {
  const displayName = cnName(t.name);
  const displayDesc = cnDesc(t.name, t.description);
  const execType = templateCategoryToAgentType(t.category);

  return (
    <div
      className="border rounded-xl p-4 hover:shadow-md transition-shadow bg-card"
      style={{
        border: "1px solid #e5e7eb",
        background: "#fff",
        height: "165px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 标题行：emoji + 名称 + 创建按钮 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-2xl"
            style={{ lineHeight: 1, display: "flex", alignItems: "center" }}
          >
            {t.emoji}
          </span>
          <h3
            className="font-semibold truncate"
            style={{
              color: "#333333",
              fontSize: 14,
              fontFamily: "inherit",
              margin: 0,
            }}
          >
            {displayName}
          </h3>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCreate(t);
          }}
          className="create-btn px-4 py-1.5 text-sm font-semibold min-w-[60px]"
        >
          创建
        </button>
      </div>

      {/* 描述 */}
      <p
        className="text-xs mt-2 line-clamp-2"
        style={{ color: "var(--text-muted)", fontFamily: "inherit" }}
      >
        {displayDesc}
      </p>

      {/* 底部信息：系统提示 + 风格/输出/执行分类 */}
      <div
        className="mt-2 pt-2 border-t text-xs space-y-1.5"
        style={{ borderTop: "1px solid #e5e7eb", fontFamily: "inherit" }}
      >
        <p
          className="line-clamp-2"
          style={{
            color: "#9ca3af",
            lineHeight: 1.5,
            margin: 0,
            fontFamily: "inherit",
          }}
        >
          <span
            style={{
              fontWeight: 500,
              color: "#94a3b8",
              fontFamily: "inherit",
            }}
          >
            系统提示：
          </span>
          {t.description}
        </p>
        <div
          className="flex flex-wrap gap-3"
          style={{ color: "#9ca3af", fontFamily: "inherit" }}
        >
          <span>
            风格: {WRITING_STYLE_CN[t.writingStyle] || t.writingStyle}
          </span>
          <span>
            输出: {OUTPUT_FORMAT_CN[t.outputFormat] || t.outputFormat}
          </span>
          <span>执行分类: {AGENT_TYPE_LABELS[execType]}</span>
        </div>
      </div>
    </div>
  );
}
