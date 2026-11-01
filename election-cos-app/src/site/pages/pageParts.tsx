/**
 * Shared page furniture for the public tools: the heading block, a cited
 * list of rules, and a source note. One spelling, so no page drifts.
 */
import type { ReactNode } from 'react';
import { Eyebrow, SiteSection } from '../SiteChrome';
import type { CodeLine } from '../codeOfConduct';

export function PageIntro({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  children?: ReactNode;
}) {
  return (
    <SiteSection className="pb-8 pt-[88px]">
      <div className="flex max-w-[760px] flex-col gap-4">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="m-0 font-site-display text-site-h3 md:text-site-h2">{title}</h1>
        <p className="m-0 text-site-lead">{lead}</p>
        {children}
      </div>
    </SiteSection>
  );
}

export function RuleList({ lines }: { lines: CodeLine[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {lines.map((l) => (
        <li key={l.ref + l.text} className="border-l-[3px] border-ink pl-4">
          <p className="m-0 text-site-base">{l.text}</p>
          <p className="mb-0 mt-1 font-mono text-site-micro text-slate">{l.ref}</p>
        </li>
      ))}
    </ul>
  );
}

export function SourceNote({ children }: { children: ReactNode }) {
  return (
    <SiteSection className="pb-[88px]">
      <p className="m-0 max-w-[48em] text-site-caption text-slate">{children}</p>
    </SiteSection>
  );
}
