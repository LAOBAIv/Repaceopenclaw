/**
 * CreateTaskModal 主组件
 * 新建任务/项目模态框入口
 * 负责状态管理、业务逻辑，渲染委托给 TaskForm
 */

import { useState } from 'react';
import { showToast } from '@/components/Toast';
import { useAgentStore } from '@/stores/agentStore';
import { useTaskStore } from '@/stores/taskStore';
import { useConversationStore } from '@/stores/conversationStore';
import type { ProjectPriority } from '@/stores/projectKanbanStore';
import { CreateTaskModalProps } from './types';
import { TaskForm } from './TaskForm';

export function CreateTaskModal({ open, onClose }: CreateTaskModalProps) {
  const [taskName, setTaskName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ProjectPriority>('mid');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const { agents } = useAgentStore();
  const { addTask } = useTaskStore();
  const { openPanel, sendMessage } = useConversationStore();

  if (!open) return null;

  const isProject = selectedAgentIds.length >= 2;

  function toggleAgent(agentId: string) {
    setSelectedAgentIds(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  }

  async function handleCreate() {
    if (!taskName.trim()) {
      showToast('请输入任务名称', 'warning');
      return;
    }
    if (selectedAgentIds.length === 0) {
      showToast('请选择至少一个智能体', 'warning');
      return;
    }

    setCreating(true);
    try {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');

      const selectedAgents = agents.filter(a => selectedAgentIds.includes(a.id));
      const mainAgent = selectedAgents[0];
      
      // 生成基础ID（时间戳）- 用于项目/任务升级降级时保持一致
      const baseId = String(Date.now());
      // 任务/项目ID：使用统一前缀，便于去重处理
      const taskId = isProject ? `proj_${baseId}` : `task_${baseId}`;
      
      const newTask = {
        id: taskId,
        baseId, // 基础ID，升级降级时保持不变
        title: taskName.trim(),
        description: description.trim(),
        agent: mainAgent.name,
        agentColor: mainAgent.color ?? '#6366f1',
        agents: selectedAgents.map(a => ({ name: a.name, color: a.color ?? '#6366f1' })),
        agentIds: selectedAgentIds, // 智能体ID列表
        priority,
        tags: isProject ? ['项目', '协作', `tid_${baseId}`] : ['任务', `tid_${baseId}`], // 添加ID作为tag
        updatedAt: '刚刚',
        dueDate: `${mm}/${String(Number(dd) + 7).padStart(2, '0')}`,
        commentCount: 0,
        fileCount: 0,
        source: 'manual' as const,
        isProject,
        projectId: isProject ? taskId : undefined,
        participantCount: selectedAgentIds.length,
        sessionIds: [], // 初始化空会话ID列表
      };
      
      // 先添加任务到任务栏（确保任务栏立即更新）
      addTask(newTask, 'progress');
      
      // 关闭模态框，让用户看到任务已创建
      resetAndClose();
      const typeLabel = isProject ? '项目' : '任务';
      showToast(`${typeLabel}创建成功`, 'success');
      
      // 延迟打开会话面板，确保UI已更新
      setTimeout(async () => {
        const createdPanelIds: string[] = [];
        
        // 为每个选中的智能体创建会话
        for (const agent of selectedAgents) {
          const panelId = await openPanel({
            agentId: agent.id,
            agentName: agent.name,
            agentColor: agent.color,
            projectId: isProject ? taskId : undefined,
          });
          
          // 记录创建的 panelId
          if (panelId) {
            createdPanelIds.push(panelId);
          }
        }
        
        // 更新任务的sessionIds关联，并添加sessionId到tags
        if (createdPanelIds.length > 0) {
          const { updateTask } = useTaskStore.getState();
          // 构建新tags：保留原有tags + 新增taskId_tag + sessionId_tag
          const baseTags = isProject ? ['项目', '协作'] : ['任务'];
          const newTags = [
            ...baseTags,
            `tid_${baseId}`, // taskId tag
            ...createdPanelIds.map((sid, idx) => `sid_${idx}_${sid}`) // sessionId tags
          ];
          updateTask(taskId, { 
            sessionIds: createdPanelIds,
            tags: newTags
          });
        }
        
        // 发送初始消息到第一个智能体的面板
        if (createdPanelIds.length > 0) {
          const firstPanelId = createdPanelIds[0];
          const participantInfo = isProject 
            ? `\n参与智能体：${selectedAgents.map(a => a.name).join('、')}` 
            : '';
          sendMessage(
            firstPanelId, 
            `开始新${typeLabel}：${taskName.trim()}${participantInfo}\n\n${description.trim() || '暂无描述'}`
          );
        }
      }, 100);
      
    } catch {
      showToast('创建失败', 'error');
    } finally {
      setCreating(false);
    }
  }

  function resetAndClose() {
    setTaskName('');
    setDescription('');
    setPriority('mid');
    setSelectedAgentIds([]);
    onClose();
  }

  return (
    <TaskForm
      taskName={taskName}
      description={description}
      priority={priority}
      selectedAgentIds={selectedAgentIds}
      creating={creating}
      isProject={isProject}
      agents={agents}
      setTaskName={setTaskName}
      setDescription={setDescription}
      setPriority={setPriority}
      toggleAgent={toggleAgent}
      handleCreate={handleCreate}
      resetAndClose={resetAndClose}
    />
  );
}
