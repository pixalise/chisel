import type { FC, ReactNode } from "react";
import { isEmpty } from "lodash";

export interface PageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode[];
}

const PageHeader: FC<PageHeaderProps> = (props) => {
  const { description, actions = [], title } = props;
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end justify-between gap-4 border-b border-border pb-[0.85rem] max-[1120px]:grid-cols-1">
      <div>
        <p className="mb-1 mt-0 font-mono text-[0.68rem] font-black uppercase tracking-[0.12em] text-primary">{title}</p>
        <p className="mb-0 mt-[0.45rem] max-w-[72rem] text-[0.86rem] leading-normal text-muted-foreground">{description}</p>
      </div>
      {!isEmpty(actions) && <div className="flex flex-row items-center space-x-2">{actions}</div>}
    </header>
  );
};
export default PageHeader;
