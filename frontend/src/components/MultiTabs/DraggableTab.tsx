/**
 * 可拖拽 Tab 组件
 * 基于 react-dnd 实现标签拖拽排序
 */

import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import type { DraggableTabProps } from './types';
import { DRAG_TYPE_TAB_ITEM } from './constants';

const DraggableTab: React.FC<DraggableTabProps> = ({ item, index, moveTab, children }) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: DRAG_TYPE_TAB_ITEM,
    item: { index, key: item.key },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: DRAG_TYPE_TAB_ITEM,
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

export default DraggableTab;
