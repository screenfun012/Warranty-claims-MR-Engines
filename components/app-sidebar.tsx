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
  Crown,
  Eye,
  UserRoundCog,
  UserCheck,
  BarChart3,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Truck,
  LayoutDashboard,
  LayoutList,
  Bell,
} from "lucide-react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/components/language-switcher";
import { locales, localeNames, localeFlags, type Locale } from "@/i18n/config";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Moon, Sun, Globe, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  translationKey: string;
  plannerOnly?: boolean;
};

const warrantyNavigation: NavigationItemWithRole[] = [
  { name: "Dashboard", translationKey: "nav.dashboard", href: "/", icon: Home, minRole: "VIEWER" },
  { name: "Inbox", translationKey: "nav.inbox", href: "/inbox", icon: Inbox, showBadge: false, minRole: "VIEWER" },
  { name: "Claims", translationKey: "nav.claims", href: "/claims", icon: FileText, minRole: "VIEWER" },
  { name: "Statistics", translationKey: "nav.statistics", href: "/statistics", icon: BarChart3, minRole: "ADMIN" },
  { name: "Settings", translationKey: "nav.settings", href: "/settings", icon: Settings, minRole: "ADMIN" },
  { name: "Admin", translationKey: "nav.admin", href: "/admin", icon: Shield, minRole: "SUPER_ADMIN" },
];

// Planer je nezavisan od reklamacija: Planer → Planer izvoza | General (klik vodi na tu grupaciju)
const plannerNavigation: NavigationItemWithRole[] = [
  { name: "Planer izvoza", translationKey: "nav.plannerExport", href: "/export-planner/izvoz", icon: Truck },
  { name: "General", translationKey: "nav.plannerGeneral", href: "/export-planner/general", icon: LayoutDashboard },
];

// Role hierarchy for permission checks
const ROLE_LEVELS: Record<string, number> = {
  VIEWER: 0,
  OPERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

const WARRANTY_ROLES = ["VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"] as const;
const PLANNER_ROLES = ["PLANNER_OPERATOR", "PLANNER_VIEWER"] as const;

function hasMinRole(userRole: string | undefined, minRole: string): boolean {
  const userLevel = ROLE_LEVELS[userRole || "VIEWER"] ?? 0;
  const requiredLevel = ROLE_LEVELS[minRole] ?? 0;
  return userLevel >= requiredLevel;
}

function isPlannerOnly(userRole: string | undefined): boolean {
  if (!userRole) return false;
  return PLANNER_ROLES.includes(userRole as any) && !WARRANTY_ROLES.includes(userRole as any);
}

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const fetchNotifications = async (): Promise<{ notifications: NotificationItem[]; unreadCount: number }> => {
  const res = await fetch("/api/notifications");
  if (!res.ok) return { notifications: [], unreadCount: 0 };
  return res.json();
};

function NotificationsDropdown({
  isCollapsed,
  isMobile,
  inboxUnreadCount = 0,
}: {
  isCollapsed: boolean;
  isMobile: boolean;
  inboxUnreadCount?: number;
}) {
  const t = useTranslations("notifications");
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    staleTime: 60 * 1000,
  });
  const notifications = data?.notifications ?? [];
  const notificationsUnread = data?.unreadCount ?? 0;
  const totalUnread = notificationsUnread + inboxUnreadCount;

  const markRead = React.useCallback(
    async (id: string, link: string | null) => {
      try {
        await fetch(`/api/notifications/${id}`, { method: "PATCH" });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        if (link) router.push(link);
      } catch {
        if (link) router.push(link);
      }
    },
    [queryClient, router]
  );

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size={isCollapsed ? "default" : "lg"}
                  className={cn("relative", isCollapsed && "justify-center")}
                >
                  <Bell className={cn("h-5 w-5 shrink-0", !isCollapsed && "mr-2")} />
                  {!isCollapsed && <span className="truncate">{t("title")}</span>}
                  {totalUnread > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] animate-pulse"
                    >
                      {totalUnread > 99 ? "99+" : totalUnread}
                    </Badge>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">{t("title")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent align="end" className="w-80 max-h-[70vh] overflow-y-auto">
          <div className="px-2 py-1.5 text-sm font-semibold text-foreground">{t("title")}</div>
          {isLoading && notifications.length === 0 && inboxUnreadCount === 0 ? (
            <div className="px-2 py-4 text-sm text-muted-foreground">{t("empty")}</div>
          ) : (
            <>
              {inboxUnreadCount > 0 && (
                <DropdownMenuItem
                  className="flex flex-col items-stretch gap-0.5 py-2 cursor-pointer font-medium text-foreground"
                  onSelect={() => router.push("/inbox")}
                >
                  <span className="text-sm">{t("unreadMessages", { count: inboxUnreadCount })}</span>
                  <span className="text-xs text-muted-foreground">{t("inboxClickHint")}</span>
                </DropdownMenuItem>
              )}
              {inboxUnreadCount > 0 && notifications.length > 0 && (
                <div className="my-1 border-t border-border" role="separator" />
              )}
              {notifications.length === 0 && inboxUnreadCount === 0 ? (
                <div className="px-2 py-4 text-sm text-muted-foreground">{t("empty")}</div>
              ) : (
                notifications.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className="flex flex-col items-stretch gap-0.5 py-2 cursor-pointer"
                    onSelect={() => markRead(n.id, n.link)}
                  >
                    <span className={cn("font-medium text-sm", !n.readAt && "text-foreground")}>{n.title}</span>
                    {n.body && <span className="text-xs text-muted-foreground line-clamp-2">{n.body}</span>}
                  </DropdownMenuItem>
                ))
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

const fetchUnreadCount = async (): Promise<number> => {
  const res = await fetch("/api/inbox/unread-count");
  if (!res.ok) return 0;
  const data = await res.json();
  return data.count || 0;
};

type PlannerBatch = { id: string; customName: string | null; batchCode: string; batchType: string };
const fetchPlannerBatches = async (batchType: string): Promise<PlannerBatch[]> => {
  const res = await fetch(`/api/export-planner/batches?batchType=${batchType}`);
  if (!res.ok) return [];
  return res.json();
};

type PlannerSummary = { assignedCount: number; lateCount: number };
const fetchPlannerSummary = async (): Promise<PlannerSummary> => {
  const res = await fetch("/api/export-planner/my-summary");
  if (!res.ok) return { assignedCount: 0, lateCount: 0 };
  return res.json();
};

export function AppSidebar() {
  const pathname = usePathname();
  const { user, isLoading: userLoading } = useUser();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { state, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const queryClient = useQueryClient();
  const currentLocale = useLocale();
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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

  const plannerOnly = isPlannerOnly(userRole);
  const showWarrantyNav = !plannerOnly;
  const showPlannerNav = plannerOnly || hasMinRole(userRole, "OPERATOR");
  const warrantyNavItems = warrantyNavigation.filter(item => hasMinRole(userRole, item.minRole || "VIEWER"));

  const [exportPlannerOpen, setExportPlannerOpen] = useState(false);
  const [generalPlannerOpen, setGeneralPlannerOpen] = useState(false);
  const { data: exportBatches = [] } = useQuery({
    queryKey: ["export-planner-batches", "MR_ENGINES"],
    queryFn: () => fetchPlannerBatches("MR_ENGINES"),
    enabled: showPlannerNav,
  });
  const { data: generalBatches = [] } = useQuery({
    queryKey: ["export-planner-batches", "GENERIC"],
    queryFn: () => fetchPlannerBatches("GENERIC"),
    enabled: showPlannerNav,
  });
  const { data: plannerSummary = { assignedCount: 0, lateCount: 0 } } = useQuery({
    queryKey: ["export-planner-my-summary"],
    queryFn: fetchPlannerSummary,
    enabled: showPlannerNav,
    staleTime: 60 * 1000,
  });
  const isExportBatchPage = pathname?.startsWith("/export-planner/") && pathname !== "/export-planner/izvoz" && pathname !== "/export-planner/general" && pathname !== "/export-planner/pregled";
  const currentBatchId = isExportBatchPage && pathname ? pathname.split("/").pop() : null;
  useEffect(() => {
    if (!currentBatchId) return;
    if (exportBatches.some((b) => b.id === currentBatchId)) setExportPlannerOpen(true);
    if (generalBatches.some((b) => b.id === currentBatchId)) setGeneralPlannerOpen(true);
  }, [currentBatchId, exportBatches, generalBatches]);

  const renderNavItem = (item: NavigationItemWithRole) => {
    const isActive = Boolean(pathname === item.href || (pathname && item.href && pathname.startsWith(item.href + "/")));
    const showBadge = item.showBadge && unreadCount > 0;
    const handleLinkClick = () => { if (isMobile) setOpenMobile(false); };
    const menuButton = (
      <SidebarMenuButton asChild isActive={isActive} className={cn("transition-all duration-200 hover:bg-sidebar-accent/80", isCollapsed && !isMobile && "justify-center")}>
        <Link href={item.href} onClick={handleLinkClick} className={cn("flex items-center group/item no-underline hover:no-underline visited:no-underline active:no-underline text-inherit", isCollapsed && !isMobile ? "justify-center" : "gap-3")} style={{ textDecoration: "none", color: "inherit" }}>
          <item.icon className={cn("h-5 w-5 shrink-0", isActive && "scale-110")} />
          <span className={cn(isCollapsed && !isMobile && "hidden")}>{t(item.translationKey)}</span>
          {showBadge && !isCollapsed && <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-xs">{unreadCount > 99 ? "99+" : unreadCount}</Badge>}
        </Link>
      </SidebarMenuButton>
    );
    const wrapped = isCollapsed && !isMobile ? (
      <Tooltip key={item.name}><TooltipTrigger asChild><SidebarMenuItem>{menuButton}</SidebarMenuItem></TooltipTrigger><TooltipContent side="right"><span>{t(item.translationKey)}</span>{showBadge && <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1.5 text-xs">{unreadCount > 99 ? "99+" : unreadCount}</Badge>}</TooltipContent></Tooltip>
    ) : (
      <SidebarMenuItem key={item.name}>{menuButton}</SidebarMenuItem>
    );
    return wrapped;
  };

  // React Query automatski cache-uje i deduplira request-e (skip for planner-only - no inbox)
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unreadCount"],
    queryFn: fetchUnreadCount,
    enabled: !plannerOnly,
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
    <Sidebar collapsible={isMobile ? "offcanvas" : "icon"}>
      <SidebarHeader className={cn(
        "flex items-center justify-center border-b bg-background transition-all duration-200",
        isCollapsed && !isMobile ? "px-2 py-2 min-h-[64px]" : "px-3 py-3 min-h-[80px]"
      )}>
        <Link 
          href={plannerOnly ? "/export-planner/izvoz" : "/"}
          className="flex items-center justify-center w-full h-full group/logo transition-all duration-200 hover:opacity-80"
        >
          {isCollapsed && !isMobile ? (
            <Image
              src="/images/mr-engines-logo-icon.png"
              alt="MR Engines"
              width={48}
              height={48}
              className="h-12 w-12 object-contain transition-all duration-300"
              quality={100}
              priority
              unoptimized={false}
            />
          ) : (
            <Image
              src={theme === "dark" ? "/images/mr-engines-logo-light.png" : "/images/mr-engines-logo-dark.png"}
              alt="MR Engines"
              width={200}
              height={200}
              className="h-auto max-h-[80px] w-[80%] object-contain transition-all duration-300"
              quality={100}
              priority
              unoptimized={false}
            />
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {showWarrantyNav && warrantyNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className={cn(
              "transition-opacity duration-200",
              isCollapsed && "opacity-0 h-0 overflow-hidden"
            )}>
              {t("nav.groupWarranty")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <TooltipProvider delayDuration={0}>
                  {warrantyNavItems.map((item) => renderNavItem(item))}
                </TooltipProvider>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {showPlannerNav && (
          <SidebarGroup>
            <SidebarGroupLabel className={cn(
              "transition-opacity duration-200",
              isCollapsed && "opacity-0 h-0 overflow-hidden"
            )}>
              {t("nav.groupPlanner")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <TooltipProvider delayDuration={0}>
                  {!isCollapsed && (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname === "/export-planner/pregled"} className={cn("transition-all duration-200 hover:bg-sidebar-accent/80")}>
                          <Link
                            href="/export-planner/pregled"
                            onClick={() => isMobile && setOpenMobile(false)}
                            className="flex flex-1 min-w-0 items-center gap-3 rounded-md py-2 pr-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground no-underline"
                          >
                            <LayoutList className="h-5 w-5 shrink-0" />
                            <span className="truncate text-left">{t("nav.plannerOverview")}</span>
                            {plannerSummary.lateCount > 0 && (
                              <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-xs">
                                {plannerSummary.lateCount > 99 ? "99+" : plannerSummary.lateCount}
                              </Badge>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <div className="flex w-full items-center gap-1 rounded-md px-2 py-1.5">
                          <Link
                            href="/export-planner/izvoz"
                            onClick={() => isMobile && setOpenMobile(false)}
                            className={cn(
                              "flex flex-1 min-w-0 items-center gap-3 rounded-md py-0.5 pr-1 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                              pathname === "/export-planner/izvoz" && "bg-sidebar-accent text-sidebar-accent-foreground"
                            )}
                          >
                            <Truck className="h-5 w-5 shrink-0" />
                            <span className="truncate text-left">{t("nav.plannerExport")}</span>
                          </Link>
                          <button
                            type="button"
                            aria-label={exportPlannerOpen ? "Zatvori listu" : "Otvori listu planova"}
                            className="rounded p-1 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            onClick={(e) => { e.preventDefault(); setExportPlannerOpen((o) => !o); if (isMobile) setOpenMobile(false); }}
                          >
                            {exportPlannerOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </div>
                      </SidebarMenuItem>
                      {exportPlannerOpen && exportBatches.length > 0 && (
                        <div className="ml-6 mb-1 space-y-0.5 border-l border-sidebar-border pl-2">
                          {exportBatches.map((b) => (
                            <Link
                              key={b.id}
                              href={`/export-planner/${b.id}`}
                              onClick={() => isMobile && setOpenMobile(false)}
                              className={cn(
                                "block truncate rounded px-2 py-1 text-sm hover:bg-sidebar-accent/80",
                                currentBatchId === b.id && "bg-sidebar-accent font-medium"
                              )}
                            >
                              {b.customName || b.batchCode}
                            </Link>
                          ))}
                        </div>
                      )}
                      <SidebarMenuItem>
                        <div className="flex w-full items-center gap-1 rounded-md px-2 py-1.5">
                          <Link
                            href="/export-planner/general"
                            onClick={() => isMobile && setOpenMobile(false)}
                            className={cn(
                              "flex flex-1 min-w-0 items-center gap-3 rounded-md py-0.5 pr-1 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                              pathname === "/export-planner/general" && "bg-sidebar-accent text-sidebar-accent-foreground"
                            )}
                          >
                            <LayoutDashboard className="h-5 w-5 shrink-0" />
                            <span className="truncate text-left">{t("nav.plannerGeneral")}</span>
                          </Link>
                          <button
                            type="button"
                            aria-label={generalPlannerOpen ? "Zatvori listu" : "Otvori listu planova"}
                            className="rounded p-1 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            onClick={(e) => { e.preventDefault(); setGeneralPlannerOpen((o) => !o); if (isMobile) setOpenMobile(false); }}
                          >
                            {generalPlannerOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </div>
                      </SidebarMenuItem>
                      {generalPlannerOpen && generalBatches.length > 0 && (
                        <div className="ml-6 mb-1 space-y-0.5 border-l border-sidebar-border pl-2">
                          {generalBatches.map((b) => (
                            <Link
                              key={b.id}
                              href={`/export-planner/${b.id}`}
                              onClick={() => isMobile && setOpenMobile(false)}
                              className={cn(
                                "block truncate rounded px-2 py-1 text-sm hover:bg-sidebar-accent/80",
                                currentBatchId === b.id && "bg-sidebar-accent font-medium"
                              )}
                            >
                              {b.customName || b.batchCode}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {isCollapsed && (
                    <>
                      <SidebarMenuItem>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton asChild>
                              <Link href="/export-planner/pregled" className="relative flex items-center justify-center">
                                <LayoutList className="h-5 w-5" />
                                {plannerSummary.lateCount > 0 && (
                                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                                    {plannerSummary.lateCount > 99 ? "99+" : plannerSummary.lateCount}
                                  </span>
                                )}
                              </Link>
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            {t("nav.plannerOverview")}
                            {plannerSummary.lateCount > 0 && (
                              <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                                {plannerSummary.lateCount}
                              </Badge>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton asChild>
                              <Link href="/export-planner/izvoz"><Truck className="h-5 w-5" /></Link>
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          <TooltipContent side="right">{t("nav.plannerExport")}</TooltipContent>
                        </Tooltip>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton asChild>
                              <Link href="/export-planner/general"><LayoutDashboard className="h-5 w-5" /></Link>
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          <TooltipContent side="right">{t("nav.plannerGeneral")}</TooltipContent>
                        </Tooltip>
                      </SidebarMenuItem>
                    </>
                  )}
                </TooltipProvider>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t px-2 py-2">
        {user && (
          <SidebarMenu>
            <NotificationsDropdown isCollapsed={!!isCollapsed} isMobile={isMobile} inboxUnreadCount={plannerOnly ? 0 : unreadCount} />
            <SidebarMenuItem>
              <DropdownMenu>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                          size={isCollapsed ? "default" : "lg"}
                          className={cn(
                            "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
                            isCollapsed && "justify-center"
                          )}
                        >
                          {/* User Avatar */}
                          <div className="relative shrink-0 flex items-center justify-center">
                            <div className={cn(
                              "rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-sidebar-accent transition-all",
                              isCollapsed ? "h-8 w-8" : "h-8 w-8"
                            )}>
                              <User className={cn(
                                "text-primary shrink-0",
                                isCollapsed ? "h-5 w-5" : "h-4 w-4"
                              )} />
                            </div>
                            {/* Role Icon Badge */}
                            {userRole && !isCollapsed && (
                              <div className={cn(
                                "absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-background",
                                userRole === "SUPER_ADMIN" && "bg-amber-500 dark:bg-amber-600",
                                userRole === "ADMIN" && "bg-purple-500 dark:bg-purple-600",
                                userRole === "OPERATOR" && "bg-blue-500 dark:bg-blue-600",
                                userRole === "VIEWER" && "bg-gray-500 dark:bg-gray-600"
                              )}>
                                {userRole === "SUPER_ADMIN" && <Crown className="h-2.5 w-2.5 text-white" />}
                                {userRole === "ADMIN" && <UserRoundCog className="h-2.5 w-2.5 text-white" />}
                                {userRole === "OPERATOR" && <UserCheck className="h-2.5 w-2.5 text-white" />}
                                {userRole === "VIEWER" && <Eye className="h-2.5 w-2.5 text-white" />}
                              </div>
                            )}
                          </div>
                          {!isCollapsed && (
                            <>
                              <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">{auth0User?.name || "Korisnik"}</span>
                                {auth0User?.email && (
                                  <span className="truncate text-xs text-muted-foreground">{auth0User.email}</span>
                                )}
                              </div>
                              <ChevronUp className="ml-auto size-4 shrink-0" />
                            </>
                          )}
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent side="right">
                        <span>{auth0User?.name || t('nav.profile')}</span>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side={isCollapsed ? "right" : "top"}
                  align={isCollapsed ? "start" : "end"}
                  sideOffset={4}
                >
                  {/* Profile Link */}
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>{t('nav.profile')}</span>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Language Switcher in Dropdown */}
                  {locales.map((locale) => (
                    <DropdownMenuItem
                      key={locale}
                      onClick={() => {
                        document.cookie = `locale=${locale};path=/;max-age=${60 * 60 * 24 * 365}`;
                        startTransition(() => {
                          router.refresh();
                        });
                      }}
                      className="cursor-pointer"
                    >
                      <Globe className="mr-2 h-4 w-4" />
                      <span className="text-base mr-2">{localeFlags[locale]}</span>
                      <span>{localeNames[locale]}</span>
                      {currentLocale === locale && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                  ))}
                  
                  <DropdownMenuSeparator />
                  
                  {/* Theme Toggle in Dropdown */}
                  <DropdownMenuItem
                    onClick={() => {
                      const newTheme = theme === "light" ? "dark" : "light";
                      setTheme(newTheme);
                      localStorage.setItem("theme", newTheme);
                      if (newTheme === "dark") {
                        document.documentElement.classList.add("dark");
                      } else {
                        document.documentElement.classList.remove("dark");
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {theme === "light" ? (
                      <Moon className="mr-2 h-4 w-4" />
                    ) : (
                      <Sun className="mr-2 h-4 w-4" />
                    )}
                    <span>{t('common.theme')}</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Logout */}
                  <DropdownMenuItem asChild>
                    <a href="/auth/logout" className="cursor-pointer text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>{t('nav.logout')}</span>
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

