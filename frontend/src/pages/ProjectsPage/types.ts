/**
 * 项目页面类型定义
 */

import { Project } from '../../types';

/** ProjectModal 组件的 props 类型 */
export interface ProjectModalProps {
  initial?: Project;
  onSave: (data: Partial<Project>) => Promise<void>;
  onClose: () => void;
}
