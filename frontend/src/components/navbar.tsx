import { ChevronDown, LogOut, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/authStore";

const pageTitles: Record<string, string> = {
  "/chat": "Chat Workspace",
  "/documents": "Document Uploads",
  "/uploads": "Upload History",
  "/admin": "Admin Panel",
  "/settings": "Settings",
};

export function Navbar() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <header className="mb-6 flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
          <Sparkles className="h-3.5 w-3.5" />
          Enterprise assistant
        </div>
        <h1 className="text-xl font-semibold text-slate-900">
          {pageTitles[location.pathname] ?? "Dashboard"}
        </h1>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{user?.full_name?.slice(0, 2).toUpperCase() || "AI"}</AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-medium text-slate-900">{user?.full_name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuItem onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
