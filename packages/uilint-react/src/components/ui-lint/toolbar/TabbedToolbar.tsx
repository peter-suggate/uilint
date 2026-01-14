"use client";

import React, { useMemo } from "react";
import { useUILintStore } from "../store";
import ToolbarExpandable from "@/components/ui/toolbar-expandable";
import { ConfigureTab } from "./tabs/ConfigureTab";
import { ESLintTab } from "./tabs/ESLintTab";
import { VisionTab } from "./tabs/VisionTab";
import { Icons } from "./icons";
import { IssueCountBadge } from "@/components/ui/badge";

export function TabbedToolbar() {
  const activeTab = useUILintStore((s) => s.activeToolbarTab);
  const setActiveTab = useUILintStore((s) => s.setActiveToolbarTab);

  const elementIssuesCache = useUILintStore((s) => s.elementIssuesCache);
  const fileIssuesCache = useUILintStore((s) => s.fileIssuesCache);
  const visionIssuesCache = useUILintStore((s) => s.visionIssuesCache);

  const eslintIssueCount = useMemo(() => {
    let count = 0;
    elementIssuesCache.forEach((el) => (count += el.issues.length));
    fileIssuesCache.forEach((issues) => (count += issues.length));
    return count;
  }, [elementIssuesCache, fileIssuesCache]);

  const visionIssueCount = useMemo(() => {
    let count = 0;
    visionIssuesCache.forEach((issues) => (count += issues.length));
    return count;
  }, [visionIssuesCache]);

  const steps = [
    {
      id: "configure",
      title: "Configure",
      description: "Manage connection and scan settings",
      icon: Icons.Settings,
      content: <ConfigureTab />,
    },
    {
      id: "eslint",
      title: "ESLint",
      description: "View and filter code quality issues",
      icon: (props: any) => (
        <div className="relative">
          <Icons.Scan {...props} />
          {eslintIssueCount > 0 && (
            <div className="absolute -top-1.5 -right-2">
              <IssueCountBadge count={eslintIssueCount} />
            </div>
          )}
        </div>
      ),
      content: <ESLintTab />,
    },
    {
      id: "vision",
      title: "Vision",
      description: "AI-powered visual consistency analysis",
      icon: (props: any) => (
        <div className="relative">
          <Icons.Camera {...props} />
          {visionIssueCount > 0 && (
            <div className="absolute -top-1.5 -right-2">
              <IssueCountBadge count={visionIssueCount} />
            </div>
          )}
        </div>
      ),
      content: <VisionTab />,
    },
  ];

  return (
    <div className="flex items-center justify-center w-full">
      <ToolbarExpandable
        steps={steps}
        activeStep={activeTab}
        onActiveStepChange={(id) => id && setActiveTab(id as any)}
      />
    </div>
  );
}
