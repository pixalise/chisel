import type { FC, ReactNode } from "react";
import PageHeader from "@/components/page-header";

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
      <PageHeader title={title} description={copy ?? ""} actions={actions} />
      {children}
    </section>
  );
};

export default Section;
