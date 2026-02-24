"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  Menu, 
  X, 
  Ticket, 
  BookOpen, 
  Settings,
  ChevronRight,
  BarChart3,
  Mail,
  Code
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";

type NavItem = { 
  href: string; 
  label: string; 
  icon: React.ElementType;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/developer", label: "Developer", icon: Code },
  { href: "/settings/email-accounts", label: "Email Accounts", icon: Mail },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0B0F1A] via-[#12172A] to-[#1A2140]">
      {/* Logo Header */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C5CFF] to-[#9F7BFF]">
            <span className="text-white font-bold text-lg">D</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">
              Doldadress
            </span>
            <span className="text-[10px] text-slate-400">
              Ticket System
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    active 
                      ? "bg-gradient-to-r from-[#7C5CFF] to-[#9F7BFF] text-white shadow-[0_0_15px_rgba(124,92,255,0.4)]" 
                      : "text-[#A3AAC2] hover:bg-[#1E2648] hover:text-[#E8EBF2]"
                  }`}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 ${
                    active ? "text-white" : "text-[#6F7692] group-hover:text-[#A3AAC2]"
                  }`} />
                  <span className="flex-1">{item.label}</span>
                  {active && (
                    <ChevronRight className="h-4 w-4 text-white/60" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Branding */}
      <div className="border-t border-white/10 p-4">
        <div className="text-center text-xs text-slate-500">
          Powered by Successifier
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-[#12172A] border-b border-[#2A3360] px-4 py-3 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl hover:bg-[#1E2648] transition-colors"
        >
          <Menu className="h-5 w-5 text-white" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#7C5CFF] to-[#9F7BFF]">
            <span className="text-white font-bold text-xs">D</span>
          </div>
          <span className="text-sm font-semibold text-white">Doldadress</span>
        </div>
        <div className="w-9" /> {/* Spacer for centering */}
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile, shown on lg+ */}
      <aside className={`
        fixed top-0 left-0 z-50 flex h-screen w-72 lg:w-64 flex-col
        transform transition-transform duration-300 ease-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        {sidebarContent}
      </aside>
    </>
  );
}
