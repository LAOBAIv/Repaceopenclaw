/**
 * LibraryHeader.tsx - 智能体库顶部搜索和分类筛选栏
 *
 * 包含：搜索输入框（支持名称、描述、简介、角色设定搜索）
 * 和分类筛选按钮组（全部模板 + 各分类）。
 */

import { CATEGORY_LABELS } from "./constants";
import { AgentTemplate } from "../../types";

interface LibraryHeaderProps {
  templates: AgentTemplate[];
  categories: string[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
}

export default function LibraryHeader({
  templates,
  categories,
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
}: LibraryHeaderProps) {
  return (
    <>
      {/* 搜索框 */}
      <div className="mb-3 al-panel" style={{ padding: 0 }}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="搜索智能体（名称、描述、简介、角色设定）..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 pl-10 rounded-xl text-sm"
            style={{ border: "1px solid #d1d5db", background: "#fff", color: "#333333" }}
          />
        </div>
      </div>

      {/* 分类筛选按钮组 */}
      <div
        className="mb-3 al-panel"
        style={{
          padding: "10px 12px",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
        }}
      >
        <div className="flex flex-wrap gap-2">
          {/* 全部模板按钮 */}
          <button
            onClick={() => onCategoryChange("all")}
            className="px-3 py-1.5 text-sm rounded-full min-w-[120px]"
            style={{
              background: selectedCategory === "all" ? "#2a3b4d" : "#f3f4f6",
              color: selectedCategory === "all" ? "#fff" : "#4b5563",
              fontWeight: selectedCategory === "all" ? 600 : 400,
              border: "1px solid " + (selectedCategory === "all" ? "#2a3b4d" : "#e5e7eb"),
            }}
          >
            全部模板 ({templates.length})
          </button>

          {/* 各分类按钮 */}
          {categories.map((cat) => {
            const count = templates.filter((t) => t.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => onCategoryChange(cat)}
                className="px-3 py-1.5 text-sm rounded-full min-w-[120px]"
                style={{
                  background: selectedCategory === cat ? "#2a3b4d" : "#f3f4f6",
                  color: selectedCategory === cat ? "#fff" : "#4b5563",
                  fontWeight: selectedCategory === cat ? 600 : 400,
                  border: "1px solid " + (selectedCategory === cat ? "#2a3b4d" : "#e5e7eb"),
                }}
              >
                {CATEGORY_LABELS[cat] || cat} ({count})
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
