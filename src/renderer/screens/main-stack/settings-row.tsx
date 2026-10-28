import { type FC, type ReactNode } from "react";

export const SettingsRow: FC<{ children?: ReactNode; label: string; value: string }> = (props) => {
  const { children, label, value } = props;
  return (
    <div className="flex items-center gap-3 border-b border-border py-3 first:border-t">
      <span className="w-36 shrink-0 font-mono text-xs uppercase text-muted-foreground">{label}</span>
      <code className="min-w-0 flex-1 truncate text-xs">{value}</code>
      {children}
    </div>
  );
};
