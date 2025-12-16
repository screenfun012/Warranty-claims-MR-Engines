"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Inbox, FileText, Wrench, Home, Settings } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Badge } from "@/components/ui/badge";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Inbox", href: "/inbox", icon: Inbox, showBadge: true },
  { name: "Claims", href: "/claims", icon: FileText },
  // { name: "Work Orders", href: "/work-orders", icon: Wrench }, // Hidden for now
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    // Fetch unread count on mount
    fetchUnreadCount();

    // Poll for unread count every 10 seconds to catch changes faster
    const interval = setInterval(fetchUnreadCount, 10000);

    // Listen for inbox updates
    const handleInboxUpdate = () => {
      fetchUnreadCount();
    };
    window.addEventListener('inbox-updated', handleInboxUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('inbox-updated', handleInboxUpdate);
    };
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch("/api/inbox/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-sidebar">
      <div className="flex h-16 items-center justify-between border-b border-border px-6">
        <h1 className="text-lg font-semibold">MR Engines</h1>
        <ThemeToggle />
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          const showBadge = item.showBadge && unreadCount > 0;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors no-underline hover:no-underline",
                "text-inherit hover:text-inherit visited:text-inherit active:text-inherit",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <item.icon className="h-5 w-5" />
              <span className="flex-1">{item.name}</span>
              {showBadge && (
                <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-xs">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

