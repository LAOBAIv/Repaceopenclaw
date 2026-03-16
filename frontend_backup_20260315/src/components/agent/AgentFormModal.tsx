import React, { useState, useEffect } from "react";
import { Agent } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus } from "lucide-react";

const COLORS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#F59E0B",
  "#10B981", "#3B82F6", "#EF4444", "#14B8A6",
];

const WRITING_STYLES = [
  { value: "balanced", label: "均衡风格" },
  { value: "literary", label: "文学风格" },
  { value: "technical", label: "技术文档" },
  { value: "narrative", label: "叙事风格" },
  { value: "concise", label: "简洁明了" },
  { value: "creative", label: "创意写作" },
];

interface Props {
  open: boolean;
  agent?: Agent | null;
  onClose: () => void;
  onSave: (data: Omit<Agent, "id" | "createdAt">) => Promise<void>;
}

export function AgentFormModal({ open, agent, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [writingStyle, setWritingStyle] = useState("balanced");
  const [expertise, setExpertise] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setColor(agent.color);
      setSystemPrompt(agent.systemPrompt);
      setWritingStyle(agent.writingStyle);
      setExpertise(agent.expertise);
    } else {
      setName(""); setColor(COLORS[0]); setSystemPrompt(""); setWritingStyle("balanced"); setExpertise([]);
    }
  }, [agent, open]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !expertise.includes(t)) {
      setExpertise([...expertise, t]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => setExpertise(expertise.filter((t) => t !== tag));

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name, color, systemPrompt, writingStyle, expertise });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}88)` }}>
              {name ? name.charAt(0).toUpperCase() : "?"}
            </div>
            {agent ? "编辑智能体" : "新建智能体"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">智能体名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="例如：策划顾问、创意写手、文字编辑..."
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500" />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">头像颜色</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-lg transition-all duration-150 cursor-pointer"
                  style={{
                    background: c,
                    outline: color === c ? `2px solid ${c}` : "2px solid transparent",
                    outlineOffset: "2px",
                    transform: color === c ? "scale(1.15)" : "scale(1)",
                  }} />
              ))}
            </div>
          </div>

          {/* Writing style */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">写作风格</Label>
            <Select value={writingStyle} onValueChange={setWritingStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WRITING_STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* System prompt */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">系统提示词</Label>
            <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="描述该智能体的角色设定、写作风格和行为规范..."
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500 min-h-[90px]" />
          </div>

          {/* Expertise tags */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">专长标签</Label>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTag()}
                placeholder="输入标签后按 Enter"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500 flex-1" />
              <Button variant="outline" size="icon" onClick={addTag} className="border-white/10 hover:bg-white/10">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {expertise.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {expertise.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: `${color}18`, color }}>
                    {tag}
                    <button onClick={() => removeTag(tag)} className="ml-0.5 hover:opacity-70 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">取消</Button>
          <Button variant="gradient" onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "保存中..." : agent ? "保存更改" : "创建智能体"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
