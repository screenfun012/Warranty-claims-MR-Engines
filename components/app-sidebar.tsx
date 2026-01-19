"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Inbox,
  FileText,
  Home,
  Settings,
  Shield,
  LogOut,
  User,
  Mail,
  Crown,
  Eye,
  UserRoundCog,
  UserCheck,
  BarChart3,
} from "lucide-react";
import { useUser } from "@auth0/nextjs-auth0/client";
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

type NavigationItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  showBadge?: boolean;
};

type NavigationItemWithRole = NavigationItem & {
  minRole?: "VIEWER" | "OPERATOR" | "ADMIN" | "SUPER_ADMIN";
};

const allNavigation: NavigationItemWithRole[] = [
  { name: "Dashboard", href: "/", icon: Home, minRole: "VIEWER" },
  { name: "Inbox", href: "/inbox", icon: Inbox, showBadge: true, minRole: "VIEWER" },
  { name: "Claims", href: "/claims", icon: FileText, minRole: "VIEWER" },
  { name: "Statistics", href: "/statistics", icon: BarChart3, minRole: "ADMIN" },
  { name: "Settings", href: "/settings", icon: Settings, minRole: "ADMIN" },
  { name: "Admin", href: "/admin/users", icon: Shield, minRole: "SUPER_ADMIN" },
];

// Role hierarchy for permission checks
const ROLE_LEVELS: Record<string, number> = {
  VIEWER: 0,
  OPERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

function hasMinRole(userRole: string | undefined, minRole: string): boolean {
  const userLevel = ROLE_LEVELS[userRole || "VIEWER"] ?? 0;
  const requiredLevel = ROLE_LEVELS[minRole] ?? 0;
  return userLevel >= requiredLevel;
}

const fetchUnreadCount = async (): Promise<number> => {
  const res = await fetch("/api/inbox/unread-count");
  if (!res.ok) return 0;
  const data = await res.json();
  return data.count || 0;
};


export function AppSidebar() {
  const pathname = usePathname();
  const { user, isLoading: userLoading } = useUser();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { state, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const queryClient = useQueryClient();

  // Eksplicitno pozovi profil endpoint da vidimo role
  useEffect(() => {
    if (!userLoading && !user) {
      // Ako nema user-a, eksplicitno pozovi profil endpoint
      fetch('/auth/profile')
        .then(res => {
          if (res.ok) {
            return res.json();
          }
          return null;
        })
        .then(data => {
          if (data && process.env.NODE_ENV === 'development') {
            console.log('[AppSidebar] Profile fetched:', data);
          }
        })
        .catch(err => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[AppSidebar] Error fetching profile:', err);
          }
        });
    }
  }, [userLoading, user]);

  // Get user role from Auth0 claims
  interface Auth0User {
    email?: string;
    name?: string;
    picture?: string;
    sub?: string;
    role?: string;
    roles?: string[];
    'https://mr-engines-warranty/roles'?: string[] | string;
    app_metadata?: {
      roles?: string[] | string;
    };
  }
  const auth0User = user as Auth0User | undefined;
  
  // Get role from various possible locations
  const userRolesRaw = auth0User?.role || auth0User?.roles?.[0] || auth0User?.['https://mr-engines-warranty/roles'] || auth0User?.app_metadata?.roles || [];
  const userRole = Array.isArray(userRolesRaw) ? userRolesRaw[0] : userRolesRaw;
  
  // Filter navigation based on user role
  const navigation = allNavigation.filter(item => 
    hasMinRole(userRole, item.minRole || "VIEWER")
  );

  // React Query automatski cache-uje i deduplira request-e
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unreadCount"],
    queryFn: fetchUnreadCount,
    refetchInterval: 30000, // 30 sekundi umesto 10 (3x manje request-ova)
    refetchIntervalInBackground: false, // Ne refetch-uj kada je tab hidden
    staleTime: 20 * 1000, // 20 sekundi - data je fresh 20 sekundi
    retry: (failureCount, error) => {
      // Ne retry-uj ako je 401 (unauthorized) - korisnik nije ulogovan
      if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });

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

    // Listen for inbox updates - invalidate query cache
    const handleInboxUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    };
    window.addEventListener('inbox-updated', handleInboxUpdate);

    return () => {
      observer.disconnect();
      window.removeEventListener('inbox-updated', handleInboxUpdate);
    };
  }, [queryClient]);

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
                  const isActive = Boolean(pathname === item.href || (pathname && item.href && pathname.startsWith(item.href + "/")));
                  const showBadge = item.showBadge && unreadCount > 0;
                  
                  const handleLinkClick = () => {
                    // Close mobile sidebar when a link is clicked
                    if (isMobile) {
                      setOpenMobile(false);
                    }
                  };

                  const menuButton = (
                    <SidebarMenuButton asChild isActive={isActive} className="transition-all duration-200 hover:bg-sidebar-accent/80">
                      <Link 
                        href={item.href}
                        onClick={handleLinkClick}
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
      <SidebarFooter className="border-t px-2 py-3 flex flex-col gap-3 transition-all duration-200">
        {/* User Profile Section */}
        {user && (
          <Link 
            href="/profile"
            className={cn(
              "flex items-center gap-3 px-2 py-2 rounded-lg bg-sidebar-accent/30 hover:bg-sidebar-accent/50 transition-all duration-200 group/user cursor-pointer no-underline hover:no-underline visited:no-underline active:no-underline text-inherit hover:text-inherit visited:text-inherit active:text-inherit",
              isCollapsed && "justify-center"
            )}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            {/* User Avatar with Role Icon */}
            <div className="relative shrink-0">
              <div className="relative h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-sidebar-accent group-hover/user:ring-primary transition-all duration-200 overflow-hidden">
                {/* Always show User icon - simple and clean */}
                <User className="h-4 w-4 text-primary" />
              </div>
              {/* Role Icon Badge - Use lucide icons directly */}
              {userRole && (
                <div className={cn(
                  "absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-background transition-all duration-200",
                  userRole === "SUPER_ADMIN" && "bg-amber-500 dark:bg-amber-600",
                  userRole === "ADMIN" && "bg-purple-500 dark:bg-purple-600",
                  userRole === "OPERATOR" && "bg-blue-500 dark:bg-blue-600",
                  userRole === "VIEWER" && "bg-gray-500 dark:bg-gray-600"
                )}>
                  {/* Use lucide icons directly */}
                  {userRole === "SUPER_ADMIN" && <Crown className="h-2.5 w-2.5 text-white" />}
                  {userRole === "ADMIN" && <UserRoundCog className="h-2.5 w-2.5 text-white" />}
                  {userRole === "OPERATOR" && <UserCheck className="h-2.5 w-2.5 text-white" />}
                  {userRole === "VIEWER" && <Eye className="h-2.5 w-2.5 text-white" />}
                </div>
              )}
            </div>
            
            {/* User Info */}
            {!isCollapsed && (
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {auth0User?.name || "Korisnik"}
                  </p>
                  {userRole && (
                    <Badge 
                      variant={
                        userRole === "SUPER_ADMIN" ? "default" : 
                        userRole === "ADMIN" ? "secondary" :
                        userRole === "OPERATOR" ? "outline" :
                        "outline"
                      } 
                      className={cn(
                        "h-4 px-1.5 text-xs shrink-0 flex items-center gap-1",
                        userRole === "SUPER_ADMIN" && "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
                        userRole === "ADMIN" && "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
                        userRole === "OPERATOR" && "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
                        userRole === "VIEWER" && "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20"
                      )}
                    >
                      {/* Role Icon in Badge - Use lucide icons directly */}
                      <div className="relative h-3 w-3 shrink-0 flex items-center justify-center">
                        {userRole === "SUPER_ADMIN" && <Crown className="h-3 w-3" />}
                        {userRole === "ADMIN" && <UserRoundCog className="h-3 w-3" />}
                        {userRole === "OPERATOR" && <UserCheck className="h-3 w-3" />}
                        {userRole === "VIEWER" && <Eye className="h-3 w-3" />}
                      </div>
                      <span>{userRole}</span>
                    </Badge>
                  )}
                </div>
                {auth0User?.email && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground truncate">
                      {auth0User.email}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Link>
        )}

        {/* Theme Toggle and Logout */}
        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "flex-1 opacity-70 hover:opacity-100 transition-all duration-200",
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
          
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="/auth/logout"
                  className={cn(
                    "opacity-70 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all duration-200",
                    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium",
                    "disabled:pointer-events-none disabled:opacity-50",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-destructive/20",
                    "border border-transparent hover:border-destructive/20",
                    isCollapsed ? "size-9 flex-shrink-0" : "flex-1 px-3 py-2"
                  )}
                >
                  <LogOut className="h-4 w-4" />
                  {!isCollapsed && <span>Odjavi se</span>}
                </a>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  <span>Odjavi se</span>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

