/**
 * MultiTabs 类型定义
 * 包含标签项、组件 Props、拖拽标签、图标等接口
 */

/** 标签项类型 */
export interface TabItem {
  /** 标签唯一标识 */
  key: string;
  /** 标签标题 */
  label: string;
  /** 标签类型：task 任务 / project 项目 */
  type: 'task' | 'project';
  /** 是否可关闭 */
  closable?: boolean;
  /** 是否固定（不可关闭/拖拽） */
  fixed?: boolean;
  /** 图标颜色 */
  iconColor?: string;
  /** 缓存的状态数据 */
  cachedState?: Record<string, unknown>;
  /** 最后访问时间 */
  lastVisited?: number;
}

/** 组件 Props */
export interface MultiTabsProps {
  /** 标签页数据 */
  items: TabItem[];
  /** 当前激活的标签 key */
  activeKey: string;
  /** 标签切换回调 */
  onChange?: (activeKey: string) => void;
  /** 新增标签回调 */
  onAdd?: () => void;
  /** 关闭标签回调 */
  onClose?: (key: string) => void;
  /** 关闭其他标签回调 */
  onCloseOthers?: (key: string) => void;
  /** 关闭左侧标签回调 */
  onCloseLeft?: (key: string) => void;
  /** 关闭右侧标签回调 */
  onCloseRight?: (key: string) => void;
  /** 关闭所有标签回调 */
  onCloseAll?: () => void;
  /** 刷新当前标签回调 */
  onRefresh?: (key: string) => void;
  /** 标签排序变化回调 */
  onSort?: (items: TabItem[]) => void;
  /** 是否显示新增按钮 */
  showAdd?: boolean;
  /** 是否显示刷新按钮 */
  showRefresh?: boolean;
  /** 是否启用拖拽排序 */
  draggable?: boolean;
  /** 最大标签数量 */
  maxTabs?: number;
  /** 标签栏样式 */
  style?: React.CSSProperties;
  /** 标签栏类名 */
  className?: string;
}

/** 可拖拽标签组件 Props */
export interface DraggableTabProps {
  /** 标签项数据 */
  item: TabItem;
  /** 标签索引 */
  index: number;
  /** 移动标签回调 */
  moveTab: (dragIndex: number, hoverIndex: number) => void;
  /** 子节点 */
  children: React.ReactNode;
}

/** 标签图标组件 Props */
export interface TabIconProps {
  /** 图标类型 */
  type: 'task' | 'project';
  /** 图标颜色 */
  color?: string;
}
