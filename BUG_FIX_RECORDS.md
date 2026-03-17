# Bug 修复记录

> 本文件记录项目开发过程中每次 Bug 修复的详情，按时间顺序排列。

---

## #001 · 管理后台添加模型无法保存（成功提示被吞）

**日期：** 2026-03-17  
**文件：** `frontend/src/pages/ModelChannels.tsx`  
**问题类型：** 前端逻辑错误 / React 状态更新顺序问题

### 问题描述

用户在管理后台的"模型渠道"页面填写表单并点击保存后，界面没有任何反馈，用户误以为保存失败，实际上后端已经成功写入数据库。

### 根本原因

`handleSave` 函数中存在两个相互叠加的问题：

**问题一：`cancelForm()` 内部会清空 `saveMsg`**

```js
// 原始代码（有问题）
await apiClient.post('/token-channels', form);
await fetchChannels();
cancelForm();              // ← cancelForm 内部调用了 setSaveMsg('')
setSaveMsg('✅ 保存成功'); // ← React 批处理中被上一行的 setSaveMsg('') 覆盖
```

React 在同一同步调用栈中会批量合并多个 `setState`，`cancelForm()` 内部的 `setSaveMsg('')` 和后续的 `setSaveMsg('✅ 保存成功')` 发生冲突，最终状态不确定。

**问题二：成功提示渲染在表单内部**

`saveMsg` 对应的 `<div>` 在表单区域内，`cancelForm()` 把 `showForm` 设为 `false` 后，整个表单（包括提示文字）立刻从 DOM 中移除，用户根本看不到任何反馈。

### 修复方案

1. **`handleSave` 不再调用 `cancelForm()`**，改为手动逐步重置各表单状态，确保 `setSaveMsg('✅ 保存成功')` 在最后执行，不被覆盖。
2. **成功/失败提示移到表单外部渲染**（`!showForm` 时显示），表单关闭后提示依然可见，3 秒后自动消失。

### 修复代码摘要

```diff
- cancelForm();
- setSaveMsg('✅ 保存成功');
+ setShowForm(false);
+ setShowPresets(true);
+ setSelectedPreset(null);
+ setHint('');
+ setEditingProvider(null);
+ setForm({ ...emptyForm });
+ setSaveMsg('✅ 保存成功');   // 最后设置，不会被覆盖
+ setTimeout(() => setSaveMsg(''), 3000);
```

同时在渠道列表区域外部增加提示渲染：

```jsx
{saveMsg && !showForm && (
  <div style={{ ... }}>
    {saveMsg}
  </div>
)}
```

### 验证

- 后端 POST `/api/token-channels` 接口测试返回 201，确认后端始终正常
- 修复后前端保存可正常显示"✅ 保存成功"提示，3 秒后消失
- `npx tsc --noEmit` 编译零错误

---

## #002 · 智能体管理页面缺少模型参数展示

**日期：** 2026-03-17  
**文件：** `frontend/src/pages/AgentManager.tsx`  
**问题类型：** 功能缺失 / UI 信息不完整

### 问题描述

智能体管理页面的卡片布局中，只显示智能体名称、描述、标签等基本信息，没有展示绑定的模型及关键推理参数（Temperature、Max Tokens、Top-P 等），用户无法在列表视图中快速了解每个智能体的模型配置。

### 修复方案

在每张智能体卡片底部新增 **`ModelParamBar` 模型参数展示栏**，包含以下内容：

| 展示元素 | 说明 |
|---|---|
| 渠道标签 + 模型名 | 如 `豆包 · Doubao-Pro-32K`，鼠标悬停显示完整 model ID |
| Temperature（🌡） | 橙色温度计图标，1 位小数精度；优先取 `temperatureOverride` |
| Max Tokens（#） | 紫色，千位自动转 K（如 `4K`、`8K`、`128K`） |
| Top-P（≋） | 青色 Layers 图标 |
| 记忆轮数（紫色徽章） | 仅当 `memoryTurns > 0` 时显示 |
| 输出格式（绿色徽章） | 仅当不是默认"纯文本"时显示 |
| 未配置模型（占位） | 所有参数均为空时显示灰色占位提示 |

### 新增内容

- 新增 `ModelParamBar` 函数组件
- 新增 `PROVIDER_LABEL` 渠道 ID → 中文标签映射表
- 新增对应 CSS 样式（`.am-model-bar`、`.am-model-name`、`.am-param`、`.am-param-badge` 等）
- 新增 `lucide-react` 图标引用：`Cpu`、`Thermometer`、`Hash`、`Layers`

### 验证

- `npx tsc --noEmit` 编译零错误
- Lint 检查零报错

---

*如有新的 Bug 修复，请在本文件末尾按相同格式追加记录。*
