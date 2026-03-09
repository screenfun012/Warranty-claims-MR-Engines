"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Home, ChevronRight } from "lucide-react";
import { ApprovalGuard } from "@/components/approval-guard";
import { useRealtime } from "@/hooks/useRealtime";
import { useTranslations } from "next-intl";
import { ClaimBreadcrumbProvider, useClaimBreadcrumb } from "@/components/claim-breadcrumb-context";

function PageTitle({ pathname }: { pathname: string | null }) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const { label: claimBreadcrumbLabel } = useClaimBreadcrumb();

  if (!pathname) return null;

  const fromInbox = searchParams?.get("from") === "inbox";

  const getBreadcrumbs = (path: string): Array<{ label: string; href: string }> => {
    const parts = path.split("/").filter(Boolean);
    const breadcrumbs: Array<{ label: string; href: string }> = [{ label: t("nav.dashboard"), href: "/" }];

    if (parts.length === 0) return breadcrumbs;

    let currentPath = "";
    parts.forEach((part, index) => {
      currentPath += `/${part}`;

      if (part === "claims") {
        if (parts[index + 1] === "new") {
          breadcrumbs.push({ label: t("nav.claims"), href: "/claims" });
          breadcrumbs.push({ label: t("claims.new.createButton"), href: currentPath + "/new" });
          return;
        } else if (parts[index + 1]) {
          if (fromInbox) {
            breadcrumbs.push({ label: t("nav.inbox"), href: "/inbox" });
          }
          breadcrumbs.push({ label: t("nav.claims"), href: "/claims" });
          const segmentLabel =
            claimBreadcrumbLabel?.trim() ||
            `${t("nav.claims")} ${parts[index + 1].slice(0, 8)}...`;
          breadcrumbs.push({ label: segmentLabel, href: `${currentPath}/${parts[index + 1]}` });
          return;
        } else {
          breadcrumbs.push({ label: t("nav.claims"), href: "/claims" });
        }
      } else if (part === "inbox") {
        breadcrumbs.push({ label: t("nav.inbox"), href: "/inbox" });
      } else if (part === "settings") {
        breadcrumbs.push({ label: t("nav.settings"), href: "/settings" });
      } else if (part === "admin" && parts[index + 1] === "users") {
        breadcrumbs.push({ label: t("nav.admin"), href: "/admin" });
        breadcrumbs.push({ label: t("admin.users.title"), href: currentPath + "/users" });
        return;
      } else if (part === "work-orders") {
        if (parts[index + 1]) {
          breadcrumbs.push({ label: t("nav.workOrders"), href: "/work-orders" });
          breadcrumbs.push({ label: t("common.details"), href: currentPath + "/" + parts[index + 1] });
          return;
        } else {
          breadcrumbs.push({ label: t("nav.workOrders"), href: "/work-orders" });
        }
      } else {
        // Generic handling
        const label = part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, " ");
        breadcrumbs.push({ label, href: currentPath });
      }
    });
    
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      {breadcrumbs.length > 1 ? (
        <nav className="flex items-center gap-1.5 text-sm min-w-0">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.href}>
                {index > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                )}
                {index === 0 ? (
                  <a
                    href={crumb.href}
                    className="flex items-center gap-1.5 hover:text-foreground text-muted-foreground transition-colors duration-200"
                  >
                    <Home className="h-4 w-4 shrink-0" />
                    {crumb.label}
                  </a>
                ) : isLast ? (
                  <span className="font-semibold text-foreground truncate">{crumb.label}</span>
                ) : (
                  <a
                    href={crumb.href}
                    className="hover:text-foreground text-muted-foreground transition-colors duration-200 truncate"
                  >
                    {crumb.label}
                  </a>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      ) : (
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">{t("nav.dashboard")}</h1>
        </div>
      )}
    </div>
  );
}

function SidebarTriggerWithTooltip() {
  const { state, toggleSidebar } = useSidebar();
  const t = useTranslations();
  const isCollapsed = state === "collapsed";

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarTrigger 
            className={cn(
              "-ml-1 transition-all duration-200 hover:bg-accent/80",
              "hover:scale-105 active:scale-95"
            )}
          />
        </TooltipTrigger>
        <TooltipContent side="right">
          <span>{isCollapsed ? t("common.expand") : t("common.collapse")}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/auth" || !pathname;
  const isPendingApproval = pathname === "/pending-approval";

  // Hooks must be called unconditionally – useRealtime no-ops when not needed
  useRealtime();

  // Na login/register stranicama, ne prikazuj sidebar
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Na pending-approval stranici, ne prikazuj sidebar
  if (isPendingApproval) {
    return <>{children}</>;
  }

  return (
    <ApprovalGuard>
      <ClaimBreadcrumbProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-4 px-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-200">
              <SidebarTriggerWithTooltip />
              <Separator orientation="vertical" className="h-6 transition-opacity duration-200" />
              <PageTitle pathname={pathname} />
            </header>
            <main className="flex-1 overflow-auto bg-background/50">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </ClaimBreadcrumbProvider>
    </ApprovalGuard>
  );
}

