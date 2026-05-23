/**
 * PromptSection - 提示词区组件
 *
 * 职责：渲染提示词相关表单字段
 * - 角色设定（系统提示词 textarea）
 * - 能力边界（textarea）
 */
interface PromptSectionProps {
  role: string;
  setRole: (v: string) => void;
  boundary: string;
  setBoundary: (v: string) => void;
  // 样式
  inputStyle: React.CSSProperties;
  focusStyle: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  blurStyle: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  labelStyle: React.CSSProperties;
  fieldStyle: React.CSSProperties;
}

export function PromptSection({
  role, setRole, boundary, setBoundary,
  inputStyle, focusStyle, blurStyle, labelStyle, fieldStyle,
}: PromptSectionProps) {
  return (
    <>
      {/* 角色设定 */}
      <div style={{ ...fieldStyle, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <label style={labelStyle}>角色设定</label>
        <textarea
          style={{ ...inputStyle, flex: 1, resize: 'none', minHeight: 0 } as React.CSSProperties}
          value={role}
          onChange={e => setRole(e.target.value)}
          placeholder="定义智能体的人设和核心定位..."
          onFocus={focusStyle} onBlur={blurStyle}
        />
      </div>

      {/* 能力边界 */}
      <div style={{ ...fieldStyle, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <label style={labelStyle}>能力边界</label>
        <textarea
          style={{ ...inputStyle, flex: 1, resize: 'none', minHeight: 0 } as React.CSSProperties}
          value={boundary}
          onChange={e => setBoundary(e.target.value)}
          placeholder="明确智能体不能做的事..."
          onFocus={focusStyle} onBlur={blurStyle}
        />
      </div>
    </>
  );
}
