"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Inbox,
  FileText,
  Wrench,
  Home,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Inbox", href: "/inbox", icon: Inbox, showBadge: true },
  { name: "Claims", href: "/claims", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Check current theme
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");
    };
    
    checkTheme();
    
    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Fetch unread count on mount
    fetchUnreadCount();

    // Poll for unread count every 10 seconds
    const interval = setInterval(fetchUnreadCount, 10000);

    // Listen for inbox updates
    const handleInboxUpdate = () => {
      fetchUnreadCount();
    };
    window.addEventListener('inbox-updated', handleInboxUpdate);

    return () => {
      observer.disconnect();
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
    <Sidebar>
      <SidebarHeader className="flex items-center justify-center border-b px-3 py-3 bg-background">
        <Link href="/" className="flex items-center justify-center w-full h-full min-h-[80px]">
          <Image
            src={theme === "dark" ? "/images/mr-engines-logo-light.png" : "/images/mr-engines-logo-dark.png"}
            alt="MR Engines"
            width={200}
            height={200}
            className="w-[80%] h-auto max-h-[80px] object-contain transition-opacity duration-200"
            quality={100}
            priority
            unoptimized={false}
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                const showBadge = item.showBadge && unreadCount > 0;
                
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href} className="flex items-center gap-3">
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                        {showBadge && (
                          <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-xs">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t px-2 py-2 flex items-center justify-center">
        <div className="opacity-70 hover:opacity-100 transition-opacity">
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

