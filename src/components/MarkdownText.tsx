import { Fragment, type ReactNode } from "react";

// Assistant/cache/note content is untrusted. Render formatting as React nodes,
// never inject HTML from a model response or a database record. Only internal
// links are allowed; external URLs are rendered as plain text.
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(\/[^)\s]*\))/g;
const LINK = /^\[([^\]]+)\]\((\/[^)\s]*)\)$/;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-amber-700 dark:text-amber-300">{part.slice(1, -1)}</code>;
    const link = part.match(LINK);
    if (link && link[2].startsWith("/") && !link[2].startsWith("//")) {
      return <a key={index} href={link[2]} className="font-medium text-cyan-700 underline decoration-cyan-500/40 underline-offset-2 hover:decoration-cyan-500 dark:text-cyan-300">{link[1]}</a>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

const LIST_ITEM = /^\s*(?:[-*]|\d+\.)\s+/;
const isListItem = (line: string) => LIST_ITEM.test(line);

function renderLines(lines: string[], keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let paragraph: string[] = [];
  const flushList = () => {
    if (!list) return;
    const { ordered, items } = list;
    nodes.push(ordered
      ? <ol key={`${keyPrefix}-l${nodes.length}`} className="list-decimal space-y-1.5 pl-5">{items.map((item, index) => <li key={index}>{inline(item)}</li>)}</ol>
      : <ul key={`${keyPrefix}-l${nodes.length}`} className="list-disc space-y-1.5 pl-5">{items.map((item, index) => <li key={index}>{inline(item)}</li>)}</ul>);
    list = null;
  };
  const flushParagraph = () => {
    if (!paragraph.length) return;
    nodes.push(<p key={`${keyPrefix}-p${nodes.length}`} className="whitespace-pre-wrap">{inline(paragraph.join("\n"))}</p>);
    paragraph = [];
  };
  for (const line of lines) {
    if (isListItem(line)) {
      flushParagraph();
      const ordered = /^\s*\d+\./.test(line);
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      list.items.push(line.replace(LIST_ITEM, ""));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushList();
  flushParagraph();
  return nodes;
}

export function MarkdownText({ text }: { text: string }) {
  return <div className="space-y-3 break-words text-sm leading-relaxed">
    {text.split(/\n\s*\n/).map((paragraph, index) => {
      const lines = paragraph.split("\n").filter((line) => line.trim());
      const heading = lines[0]?.match(/^#{1,4}\s+(.+)$/);
      if (heading) {
        return <Fragment key={index}>
          <h4 className="border-b border-border pb-1 text-sm font-semibold text-cyan-700 dark:text-cyan-400">{inline(heading[1])}</h4>
          {renderLines(lines.slice(1), `b${index}`)}
        </Fragment>;
      }
      return <Fragment key={index}>{renderLines(lines, `b${index}`)}</Fragment>;
    })}
  </div>;
}
