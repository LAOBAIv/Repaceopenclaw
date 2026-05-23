/**
 * Pagination.tsx - 分页组件
 *
 * 智能体模板库的分页控件，支持页码按钮、省略号、上一页/下一页。
 * 最多显示 6 个页码按钮，超出部分用省略号表示。
 */

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  /** 是否显示在 footer 区域（影响样式） */
  inFooter?: boolean;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  inFooter = false,
}: PaginationProps) {
  if (totalPages <= 0) return null;

  // 生成页码数组（含省略号）
  const pages: (number | string)[] = [];
  const total = totalPages || 1;
  const maxShow = 6;

  if (total <= maxShow) {
    // 总页数 <= 6，显示所有
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage <= 3) {
      // 当前页在开头
      for (let i = 2; i <= 5; i++) pages.push(i);
      pages.push("...");
      pages.push(total);
    } else if (currentPage >= total - 2) {
      // 当前页在结尾
      pages.push("...");
      for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
      // 当前页在中间
      pages.push("...");
      for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
      pages.push("...");
      pages.push(total);
    }
  }

  const accentColor = inFooter ? "#2a3b4d" : "var(--accent)";
  const disabledBg = "#e5e7eb";
  const disabledColor = "#9ca3af";

  return (
    <div className="flex justify-center items-center gap-2" style={{ padding: "8px 0 0" }}>
      {/* 上一页 */}
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="px-3 py-1.5 text-sm rounded-lg font-medium"
        style={{
          background: currentPage === 1 ? disabledBg : accentColor,
          color: currentPage === 1 ? disabledColor : "#fff",
          cursor: currentPage === 1 ? "not-allowed" : "pointer",
        }}
      >
        上一页
      </button>

      {/* 页码按钮 */}
      <div
        className="flex items-center gap-1"
        style={{ minWidth: "200px", justifyContent: "center" }}
      >
        {pages.map((p, idx) => {
          if (p === "...") {
            return (
              <span
                key={`ellipsis-${inFooter ? "footer-" : ""}${idx}`}
                style={{ color: "#9ca3af", padding: "0 4px" }}
              >
                ...
              </span>
            );
          }
          return (
            <button
              key={`${inFooter ? "footer-" : ""}page-${p}`}
              onClick={() => onPageChange(p as number)}
              className="px-3 py-1.5 text-sm rounded-lg font-medium min-w-[32px]"
              style={{
                background: currentPage === p ? accentColor : "#fff",
                color: currentPage === p ? "#fff" : "#374151",
                border: "1px solid #d1d5db",
                cursor: "pointer",
              }}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* 总数 */}
      <span className="text-sm px-2" style={{ color: "var(--text-secondary)" }}>
        共 {totalItems} 个
      </span>

      {/* 下一页 */}
      <button
        onClick={() => onPageChange(Math.min(totalPages || 1, currentPage + 1))}
        disabled={currentPage === totalPages || totalPages === 0}
        className="px-3 py-1.5 text-sm rounded-lg font-medium"
        style={{
          background:
            currentPage === totalPages || totalPages === 0
              ? disabledBg
              : accentColor,
          color:
            currentPage === totalPages || totalPages === 0
              ? disabledColor
              : "#fff",
          cursor:
            currentPage === totalPages || totalPages === 0
              ? "not-allowed"
              : "pointer",
        }}
      >
        下一页
      </button>
    </div>
  );
}
