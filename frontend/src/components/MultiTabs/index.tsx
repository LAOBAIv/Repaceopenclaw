/**
 * 多标签栏组件
 * 基于 Ant Design Tabs 二次封装
 * 支持标签切换、新增、关闭、拖拽排序、状态缓存
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Tabs, Dropdown, Button, Tooltip, message } from 'antd';
import {
  PlusOutlined,
  CloseOutlined,
  ReloadOutlined,
  CloseCircleOutlined,
  VerticalRightOutlined,
  VerticalLeftOutlined,
  HolderOutlined,
} from '@ant-design/icons';
import type { TabsProps, MenuProps } from 'antd';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// ============ 类型定义 ============

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

// ============ 拖拽标签组件 ============

interface DraggableTabProps {
  item: TabItem;
  index: number;
  moveTab: (dragIndex: number, hoverIndex: number) => void;
  children: React.ReactNode;
}

const DraggableTab: React.FC<DraggableTabProps> = ({ item, index, moveTab, children }) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: 'TAB_ITEM',
    item: { index, key: item.key },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'TAB_ITEM',
    hover: (draggedItem: { index: number; key: string }) => {
      if (draggedItem.index === index) return;
      if (item.fixed) return; // 固定标签不可拖入

      moveTab(draggedItem.index, index);
      draggedItem.index = index;
    },
  });

  if (!item.fixed && drag && drop && ref.current) {
    drag(drop(ref.current));
  }

  return (
    <div
      ref={ref}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: item.fixed ? 'default' : 'grab',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {children}
    </div>
  );
};

// ============ 标签图标组件 ============

interface TabIconProps {
  type: 'task' | 'project';
  color?: string;
}

const TabIcon: React.FC<TabIconProps> = ({ type, color = '#6366f1' }) => {
  if (type === 'project') {
    // 项目图标：文件夹
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}>
        <path
          d="M1.5 3.5C1.5 2.67 2.17 2 3 2H6L7.5 3.5H13C13.83 3.5 14.5 4.17 14.5 5V12.5C14.5 13.33 13.83 14 13 14H3C2.17 14 1.5 13.33 1.5 12.5V3.5Z"
          stroke={color}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M1.5 6H14.5" stroke={color} strokeWidth="1.2" />
      </svg>
    );
  }
  // 任务图标：对勾圆圈
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}>
      <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.2" />
      <path d="M5 8L7 10L11 6" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ============ 主组件 ============

const MultiTabs: React.FC<MultiTabsProps> = ({
  items,
  activeKey,
  onChange,
  onAdd,
  onClose,
  onCloseOthers,
  onCloseLeft,
  onCloseRight,
  onCloseAll,
  onRefresh,
  onSort,
  showAdd = true,
  showRefresh = true,
  draggable = true,
  maxTabs = 20,
  style,
  className,
}) => {
  // 内部标签列表（用于拖拽排序）
  const [internalItems, setInternalItems] = useState<TabItem[]>(items);
  // 缓存的标签状态
  const cacheRef = useRef<Map<string, Record<string, unknown>>>(new Map());

  // 同步外部 items
  useEffect(() => {
    setInternalItems(items);
  }, [items]);

  // 更新缓存
  useEffect(() => {
    internalItems.forEach((item) => {
      if (item.cachedState) {
        cacheRef.current.set(item.key, item.cachedState);
      }
    });
  }, [internalItems]);

  // 拖拽排序处理
  const moveTab = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      const dragItem = internalItems[dragIndex];
      if (dragItem?.fixed) return; // 固定标签不可拖拽

      const newItems = [...internalItems];
      newItems.splice(dragIndex, 1);
      newItems.splice(hoverIndex, 0, dragItem);
      setInternalItems(newItems);
      onSort?.(newItems);
    },
    [internalItems, onSort]
  );

  // 获取缓存的标签状态
  const getCachedState = useCallback((key: string) => {
    return cacheRef.current.get(key);
  }, []);

  // 关闭单个标签
  const handleClose = useCallback(
    (key: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const item = internalItems.find((i) => i.key === key);
      if (item?.fixed) {
        message.warning('固定标签不可关闭');
        return;
      }
      // 保存状态到缓存
      cacheRef.current.delete(key);
      onClose?.(key);
    },
    [internalItems, onClose]
  );

  // 右键菜单
  const getContextMenu = useCallback(
    (key: string): MenuProps['items'] => {
      const item = internalItems.find((i) => i.key === key);
      const currentIndex = internalItems.findIndex((i) => i.key === key);
      const leftCount = currentIndex;
      const rightCount = internalItems.length - currentIndex - 1;
      const otherCount = internalItems.filter((i) => i.key !== key && !i.fixed).length;

      return [
        {
          key: 'refresh',
          icon: <ReloadOutlined />,
          label: '刷新',
          onClick: () => onRefresh?.(key),
        },
        { type: 'divider' },
        {
          key: 'close',
          icon: <CloseOutlined />,
          label: '关闭',
          disabled: item?.fixed,
          onClick: () => handleClose(key),
        },
        {
          key: 'closeOthers',
          icon: <CloseCircleOutlined />,
          label: `关闭其他 (${otherCount})`,
          disabled: otherCount === 0,
          onClick: () => onCloseOthers?.(key),
        },
        { type: 'divider' },
        {
          key: 'closeLeft',
          icon: <VerticalRightOutlined />,
          label: `关闭左侧 (${leftCount})`,
          disabled: leftCount === 0,
          onClick: () => onCloseLeft?.(key),
        },
        {
          key: 'closeRight',
          icon: <VerticalLeftOutlined />,
          label: `关闭右侧 (${rightCount})`,
          disabled: rightCount === 0,
          onClick: () => onCloseRight?.(key),
        },
        { type: 'divider' },
        {
          key: 'closeAll',
          icon: <CloseCircleOutlined />,
          label: '关闭全部',
          onClick: () => onCloseAll?.(),
        },
      ];
    },
    [internalItems, handleClose, onCloseOthers, onCloseLeft, onCloseRight, onCloseAll, onRefresh]
  );

  // 渲染标签
  const renderTabLabel = useCallback(
    (item: TabItem, index: number) => {
      const isActive = item.key === activeKey;

      const labelContent = (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '0 4px',
          }}
        >
          <TabIcon type={item.type} color={item.iconColor} />
          <span
            style={{
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </span>
          {item.closable !== false && !item.fixed && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => handleClose(item.key, e)}
              onKeyDown={(e) => e.key === 'Enter' && handleClose(item.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 16,
                height: 16,
                marginLeft: 4,
                borderRadius: 4,
                cursor: 'pointer',
                opacity: isActive ? 1 : 0.6,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <CloseOutlined style={{ fontSize: 10 }} />
            </span>
          )}
        </div>
      );

      // 固定标签不需要拖拽
      if (item.fixed || !draggable) {
        return labelContent;
      }

      return (
        <DraggableTab item={item} index={index} moveTab={moveTab}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <HolderOutlined
              style={{
                fontSize: 12,
                color: '#999',
                marginRight: 4,
                cursor: 'grab',
              }}
            />
            {labelContent}
          </div>
        </DraggableTab>
      );
    },
    [activeKey, draggable, handleClose, moveTab]
  );

  // 构建 Tabs items
  const tabItems: TabsProps['items'] = useMemo(
    () =>
      internalItems.map((item, index) => ({
        key: item.key,
        label: (
          <Dropdown menu={{ items: getContextMenu(item.key) }} trigger={['contextMenu']}>
            {renderTabLabel(item, index)}
          </Dropdown>
        ),
        closable: item.closable !== false && !item.fixed,
        children: (
          <div key={item.key} data-tab-key={item.key}>
            {/* 子内容由外部渲染 */}
          </div>
        ),
      })),
    [internalItems, getContextMenu, renderTabLabel]
  );

  // 标签栏额外操作
  const tabBarExtraContent = useMemo(
    () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {showRefresh && (
          <Tooltip title="刷新当前标签">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => onRefresh?.(activeKey)}
            />
          </Tooltip>
        )}
        {showAdd && (
          <Tooltip title={`新增标签 (${internalItems.length}/${maxTabs})`}>
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              disabled={internalItems.length >= maxTabs}
              onClick={onAdd}
            />
          </Tooltip>
        )}
      </div>
    ),
    [showAdd, showRefresh, internalItems.length, maxTabs, activeKey, onAdd, onRefresh]
  );

  // 标签栏样式
  const tabBarStyle: React.CSSProperties = {
    background: '#fff',
    marginBottom: 0,
    padding: '4px 12px 0',
    borderBottom: '1px solid #f0f0f0',
  };

  // 不使用拖拽时直接渲染
  if (!draggable) {
    return (
      <div className={className} style={style}>
        <Tabs
          activeKey={activeKey}
          items={tabItems}
          onChange={onChange}
          tabBarStyle={tabBarStyle}
          tabBarExtraContent={tabBarExtraContent}
          type="editable-card"
          hideAdd
          onEdit={(targetKey, action) => {
            if (action === 'remove' && typeof targetKey === 'string') {
              handleClose(targetKey);
            }
          }}
        />
      </div>
    );
  }

  // 使用 DndProvider 包裹支持拖拽
  return (
    <div className={className} style={style}>
      <DndProvider backend={HTML5Backend}>
        <Tabs
          activeKey={activeKey}
          items={tabItems}
          onChange={onChange}
          tabBarStyle={tabBarStyle}
          tabBarExtraContent={tabBarExtraContent}
          type="editable-card"
          hideAdd
          onEdit={(targetKey, action) => {
            if (action === 'remove' && typeof targetKey === 'string') {
              handleClose(targetKey);
            }
          }}
        />
      </DndProvider>
    </div>
  );
};

export default MultiTabs;