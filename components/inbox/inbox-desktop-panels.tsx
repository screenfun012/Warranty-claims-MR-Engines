"use client";

import type { ReactNode, RefObject } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type InboxFolderPanelApi = {
  folderPanelRef: RefObject<PanelImperativeHandle | null>;
  toggleFolder: () => void;
};

type Props = {
  /** Folder column: mail title + nav (use api.toggleFolder for collapse/expand) */
  folder: (api: InboxFolderPanelApi) => ReactNode;
  list: ReactNode;
  detail: ReactNode;
  className?: string;
  /** Optional: control folder panel size from parent (e.g. icon-only rail) */
  folderPanelRef?: RefObject<PanelImperativeHandle | null>;
};

/**
 * Desktop-only: 3 resizable columns with independent vertical scroll inside each panel.
 */
export function InboxDesktopPanels({ folder, list, detail, className, folderPanelRef: folderPanelRefProp }: Props) {
  const internalFolderRef = usePanelRef();
  const folderPanelRef = folderPanelRefProp ?? internalFolderRef;

  const toggleFolder = () => {
    const p = folderPanelRef.current;
    if (!p) return;
    if (p.isCollapsed()) p.expand();
    else p.collapse();
  };

  const api: InboxFolderPanelApi = { folderPanelRef, toggleFolder };

  return (
    <Group
      orientation="horizontal"
      id="mr-inbox-3col"
      className={cn("h-full min-h-0 w-full min-w-0 flex-1", className)}
    >
      <Panel
        id="folders"
        panelRef={folderPanelRef}
        defaultSize="14%"
        minSize="6%"
        maxSize="32%"
        collapsible
        collapsedSize="3%"
        className="flex min-h-0 min-w-0 overflow-hidden"
      >
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-muted/35">
          {folder(api)}
        </div>
      </Panel>
      <Separator className="w-2 shrink-0 bg-border hover:bg-primary/30 data-[separator]:transition-colors" />
      <Panel id="list" defaultSize="30%" minSize="16%" maxSize="52%" className="flex min-h-0 min-w-0 overflow-hidden">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border-r border-border bg-background">
          {list}
        </div>
      </Panel>
      <Separator className="w-2 shrink-0 bg-border hover:bg-primary/30" />
      <Panel id="detail" defaultSize="56%" minSize="28%" className="flex min-h-0 min-w-0 overflow-hidden">
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/10">{detail}</div>
      </Panel>
    </Group>
  );
}

/** Icon button to collapse/expand the folder panel (use inside folder render prop). */
export function InboxFolderToggleButton({
  api,
  label,
}: {
  api: InboxFolderPanelApi;
  label: string;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="h-8 w-8 shrink-0"
      title={label}
      aria-label={label}
      onClick={api.toggleFolder}
    >
      <ChevronLeft className="h-4 w-4" />
    </Button>
  );
}
