/**
 * LibraryGrid.tsx - 智能体卡片网格展示组件
 *
 * 根据当前选中的分类，展示两种视图：
 * - "全部模板"：扁平列表 + 分页
 * - 分类视图：按分类分组展示
 */

import { AgentTemplate } from "../../types";
import { CATEGORY_LABELS } from "./constants";
import AgentCard from "./AgentCard";
import Pagination from "./Pagination";

interface LibraryGridProps {
  selectedCategory: string;
  paginatedTemplates: AgentTemplate[];
  totalPages: number;
  totalItems: number;
  grouped: Record<string, AgentTemplate[]>;
  currentPage: number;
  onPageChange: (page: number) => void;
  onCreate: (template: AgentTemplate) => void;
}

export default function LibraryGrid({
  selectedCategory,
  paginatedTemplates,
  totalPages,
  totalItems,
  grouped,
  currentPage,
  onPageChange,
  onCreate,
}: LibraryGridProps) {
  // 全部模板视图：扁平列表 + 分页
  if (selectedCategory === "all") {
    if (paginatedTemplates.length === 0) {
      return (
        <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
          暂无模板
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedTemplates.map((t) => (
            <AgentCard key={t.id} template={t} onCreate={onCreate} />
          ))}
        </div>
        {/* 分页组件 */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={onPageChange}
        />
      </>
    );
  }

  // 分类视图：按分类分组
  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "#333333" }}>
            {CATEGORY_LABELS[cat] || cat}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((t) => (
              <AgentCard key={t.id} template={t} onCreate={onCreate} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
