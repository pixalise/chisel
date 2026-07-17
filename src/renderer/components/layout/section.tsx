import type { FC, ReactNode } from "react";
import PageHeader from "@/components/page-header";

export interface SectionProps {
  title: string;
  copy?: string;
  children: ReactNode;
}

export const Section: FC<SectionProps> = (props) => {
  return (
    <section className="min-w-0 space-y-3">
      <PageHeader title={props.title} description={props.copy ?? ""} />
      {props.children}
    </section>
  );
};

export default Section;
