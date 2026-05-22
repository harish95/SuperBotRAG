import { Bot, FileArchive, Files, LayoutDashboard, Menu, Settings, ShieldCheck } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";

const baseNavigation = [
  { to: "/chat", label: "Chat", icon: Bot },
  { to: "/documents", label: "Documents", icon: FileArchive },
  { to: "/uploads", label: "Uploads", icon: Files },
  { to: "/settings", label: "Settings", icon: Settings },
];

const adminNavItem = { to: "/admin", label: "Admin", icon: ShieldCheck };

function SidebarContent() {
  const location = useLocation();
  const isAdmin = useAuthStore((state) => state.user?.role === "admin");
  const navigation = isAdmin ? [...baseNavigation, adminNavItem] : baseNavigation;

  const messages = useChatStore((state) => state.messages);
  const setDraft = useChatStore((state) => state.setDraft);
  const showHistory = location.pathname === "/chat";

  const recentPrompts = useMemo(
    () =>
      messages
        .filter((message) => message.role === "user")
        .slice(-8)
        .reverse(),
    [messages],
  );

  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
      <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-4">
        <div className="rounded-2xl bg-blue-600 p-2 text-white">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-slate-900">Enterprise RAG</p>
          <p className="text-xs text-slate-500">Internal AI workspace</p>
        </div>
      </div>

      <nav className="mt-6 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition hover:bg-slate-100",
                  isActive ? "bg-blue-50 text-blue-700" : "text-slate-600",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {showHistory ? (
        <div className="mt-6 flex min-h-0 flex-1 flex-col border-t border-slate-100 pt-4">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Recent prompts
          </p>
          <div className="scrollbar-thin mt-2 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {recentPrompts.length ? (
              recentPrompts.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  onClick={() => setDraft(prompt.content)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <p className="line-clamp-2 text-xs font-medium text-slate-700">{prompt.content}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {formatRelativeTime(prompt.createdAt)}
                  </p>
                </button>
              ))
            ) : (
              <p className="px-1 text-xs text-slate-400">
                Your recent questions will appear here for quick reuse.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-auto rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          <p className="font-medium text-slate-900">MVP workspace</p>
          <p className="mt-1 leading-6">Chat, upload, and health monitoring in one place.</p>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="hidden w-72 shrink-0 lg:block">
        <SidebarContent />
      </aside>

      <div className="lg:hidden">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm">
              <Menu className="h-5 w-5" />
            </button>
          </DialogTrigger>
          <DialogContent className="left-0 top-0 h-full max-w-[290px] translate-x-0 translate-y-0 rounded-none border-r border-slate-200 p-4">
            <SidebarContent />
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
