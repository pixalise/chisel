import type { FC, ReactNode } from "react";

export interface TabGroupLabelProps {
  icon: ReactNode;
  label: string;
}

const TabGroupLabel: FC<TabGroupLabelProps> = (props) => {
  const { icon, label } = props;
  return (
    <div className="flex items-center gap-2 border-r border-border px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {icon}
      {label}
    </div>
  );
};

export default TabGroupLabel;
