import type { FC, ReactNode } from "react";
import { isEmpty } from "lodash";

export interface SectionProps {
  title: string;
  copy?: string;
  actions?: ReactNode[];
  children: ReactNode;
}

export const Section: FC<SectionProps> = (props) => {
  const { actions, children, copy, title } = props;

  return (
    <section className="min-w-0 space-y-3">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end justify-between gap-4 border-b border-border pb-[0.85rem] max-[1120px]:grid-cols-1">
        <div>
          <p className="mb-1 mt-0 font-mono text-[0.68rem] font-black uppercase tracking-[0.12em] text-primary">{title}</p>
          {copy && <p className="mb-0 mt-[0.45rem] max-w-[72rem] text-[0.86rem] leading-normal text-muted-foreground">{copy}</p>}
        </div>
        {!isEmpty(actions) && <div className="flex flex-row items-center space-x-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
};

export default Section;
