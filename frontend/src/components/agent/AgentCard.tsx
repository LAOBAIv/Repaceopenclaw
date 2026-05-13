import React, { useState } from "react";
import { Agent } from "@/types";
import { Edit2, Trash2, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AgentCardProps {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelete: (id: string) => void;
  onChat: (agent: Agent) => void;
}

const STYLE_LABELS: Record<string, string> = {
  balanced: "均衡风格",
  literary: "文学风格",
  technical: "技术文档",
  narrative: "叙事风格",
  concise: "简洁明了",
  creative: "创意写作",
};

export function AgentCard({ agent, onEdit, onDelete, onChat }: AgentCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={cn(
        "relative rounded-xl p-5 border transition-all duration-200 group cursor-default",
        "bg-[#1A1D2E] border-white/8",
        hovered && "border-white/15 shadow-lg shadow-black/30 -translate-y-0.5"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Color accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl transition-opacity duration-200"
        style={{ background: `linear-gradient(90deg, ${agent.color}, transparent)`, opacity: hovered ? 1 : 0.5 }}
      />

      <div className="flex items-start gap-3 mb-4">
        {/* Avatar */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-lg flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${agent.color}cc, ${agent.color}88)`, boxShadow: `0 4px 14px ${agent.color}33` }}
        >
          {agent.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm truncate">{agent.name}</h3>
          <p className="text-slate-400 text-xs mt-0.5">{STYLE_LABELS[agent.writingStyle] || agent.writingStyle}</p>
        </div>

        {/* Actions */}
        <div className={cn("flex gap-1 transition-opacity duration-150", hovered ? "opacity-100" : "opacity-0")}>
          <button
            onClick={() => onEdit(agent)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(agent.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* System prompt preview */}
      {agent.systemPrompt && (
        <p className="text-slate-500 text-xs leading-relaxed mb-3 line-clamp-2">
          {agent.systemPrompt}
        </p>
      )}

      {/* Expertise tags */}
      {agent.expertise.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {agent.expertise.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: `${agent.color}18`, color: agent.color }}
            >
              {tag}
            </span>
          ))}
          {agent.expertise.length > 4 && (
            <span className="px-2 py-0.5 rounded-full text-xs text-slate-500 bg-white/5">
              +{agent.expertise.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Chat button */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-xs text-slate-400 hover:text-white hover:bg-white/8 gap-1.5 h-8"
        onClick={() => onChat(agent)}
      >
        <MessageSquarePlus className="w-3.5 h-3.5" />
        开始对话
      </Button>
    </div>
  );
}
