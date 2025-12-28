"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  Inbox,
  FileText,
  Home,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  useSidebar,
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
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  }, []);

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

    // Fetch unread count on mount (use setTimeout to avoid cascading renders warning)
    setTimeout(() => {
      fetchUnreadCount();
    }, 0);

    // Poll for unread count more frequently (every 2 seconds) to catch changes faster
    const interval = setInterval(fetchUnreadCount, 2000);

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
  }, [fetchUnreadCount]);

  return (
    <Sidebar>
      <SidebarHeader className="flex items-center justify-center border-b px-3 py-3 bg-background transition-all duration-200">
        <Link 
          href="/" 
          className="flex items-center justify-center w-full h-full min-h-[80px] group/logo transition-all duration-200 hover:opacity-80"
        >
          <Image
            src={theme === "dark" ? "/images/mr-engines-logo-light.png" : "/images/mr-engines-logo-dark.png"}
            alt="MR Engines"
            width={200}
            height={200}
            className={cn(
              "h-auto max-h-[80px] object-contain transition-all duration-300",
              isCollapsed ? "w-12 max-h-[48px]" : "w-[80%]"
            )}
            quality={100}
            priority
            unoptimized={false}
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={cn(
            "transition-opacity duration-200",
            isCollapsed && "opacity-0 h-0 overflow-hidden"
          )}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <TooltipProvider delayDuration={0}>
                {navigation.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                  const showBadge = item.showBadge && unreadCount > 0;
                  
                  const menuButton = (
                    <SidebarMenuButton asChild isActive={isActive} className="transition-all duration-200 hover:bg-sidebar-accent/80">
                      <Link 
                        href={item.href} 
                        className="flex items-center gap-3 group/item no-underline hover:no-underline visited:no-underline active:no-underline text-inherit hover:text-inherit visited:text-inherit active:text-inherit"
                        style={{ 
                          textDecoration: 'none',
                          color: 'inherit',
                          fontFamily: 'inherit',
                          fontSize: 'inherit',
                          fontWeight: 'inherit'
                        }}
                      >
                        <item.icon className={cn(
                          "h-5 w-5 transition-all duration-200 shrink-0",
                          isActive && "scale-110"
                        )} />
                        <span className={cn(
                          "transition-all duration-200",
                          isCollapsed && "opacity-0 w-0 overflow-hidden"
                        )}>
                          {item.name}
                        </span>
                        {showBadge && (
                          <Badge 
                            variant="destructive" 
                            className={cn(
                              "ml-auto h-5 min-w-5 px-1.5 text-xs transition-all duration-200 animate-in fade-in zoom-in",
                              isCollapsed && "opacity-0 w-0 overflow-hidden"
                            )}
                          >
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  );

                  if (isCollapsed) {
                    return (
                      <Tooltip key={item.name}>
                        <TooltipTrigger asChild>
                          <SidebarMenuItem>
                            {menuButton}
                          </SidebarMenuItem>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="flex items-center gap-2">
                          <span>{item.name}</span>
                          {showBadge && (
                            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </Badge>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.name}>
                      {menuButton}
                    </SidebarMenuItem>
                  );
                })}
              </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t px-2 py-2 flex items-center justify-center transition-all duration-200">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                "opacity-70 hover:opacity-100 transition-all duration-200",
                isCollapsed && "w-full"
              )}>
                <ThemeToggle />
              </div>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">
                <span>Promeni temu</span>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </SidebarFooter>
    </Sidebar>
  );
}

