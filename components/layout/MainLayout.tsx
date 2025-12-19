"use client";

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

function SidebarTriggerWithTooltip() {
  const { state, toggleSidebar } = useSidebar();
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
          <span>{isCollapsed ? "Proširi sidebar" : "Sakrij sidebar"}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b transition-all duration-200">
          <SidebarTriggerWithTooltip />
          <Separator orientation="vertical" className="mr-2 h-4 transition-opacity duration-200" />
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

