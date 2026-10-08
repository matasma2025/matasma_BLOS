import type { ReactNode } from "react";

interface ReportDownloadFooterProps {
  children: ReactNode;
}

export function ReportDownloadFooter({ children }: ReportDownloadFooterProps) {
  return (
    <footer
      className="flex flex-wrap items-center justify-between gap-3 border-t border-teal-900/15 pt-4"
      aria-label="Report downloads"
    >
      <p className="text-xs font-medium text-muted-foreground">Downloads</p>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {children}
      </div>
    </footer>
  );
}
