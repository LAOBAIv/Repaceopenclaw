import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  FolderOpen,
  Kanban,
  Sparkles,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/authStore";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "仪表盘" },
  { to: "/agents", icon: Bot, label: "智能体" },
  { to: "/projects", icon: FolderOpen, label: "项目" },
  { to: "/kanban", icon: Kanban, label: "看板" },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  function handleLogout() {
    if (confirm('确定要退出登录吗？')) {
      logout();
      navigate('/login');
    }
  }

  return (
    <TooltipProvider>
      <aside className="fixed left-0 top-0 h-full w-16 flex flex-col items-center py-4 z-40"
        style={{ background: "rgba(15,17,23,0.95)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Logo */}
        <div className="mb-6 flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
          <Sparkles className="w-5 h-5 text-white" />
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
            return (
              <Tooltip key={to} delayDuration={200}>
                <TooltipTrigger asChild>
                  <Link to={to}>
                    <button
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer",
                        active
                          ? "bg-indigo-500/20 text-indigo-400 shadow-sm shadow-indigo-500/20"
                          : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all cursor-pointer">
              <Settings className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">设置</TooltipContent>
        </Tooltip>

        {/* 退出登录 */}
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer mt-2"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">退出登录</TooltipContent>
        </Tooltip>
      </aside>
    </TooltipProvider>
  );
}
