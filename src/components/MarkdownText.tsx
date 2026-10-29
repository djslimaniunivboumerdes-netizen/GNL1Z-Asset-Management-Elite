import { Fragment, type ReactNode } from "react";

// Assistant/cache/note content is untrusted. Render formatting as React nodes,
// never inject HTML from a model response or a database record.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*.*?\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-amber-700 dark:text-amber-300">{part.slice(1, -1)}</code>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function MarkdownText({ text }: { text: string }) {
  return <div className="space-y-3 break-words">
    {text.split(/\n\s*\n/).map((paragraph, index) => {
      if (paragraph.startsWith("###")) return <h4 key={index} className="border-b border-border pb-1 text-sm font-semibold text-cyan-700 dark:text-cyan-400">{inline(paragraph.replace(/^###\s*/, ""))}</h4>;
      if (paragraph.trimStart().startsWith("*   ")) return <ul key={index} className="list-disc space-y-2 pl-4">{paragraph.split(/\n?\* {3}/).filter((part) => part.trim()).map((part, item) => <li key={item}>{inline(part.trim())}</li>)}</ul>;
      return <p key={index} className="whitespace-pre-wrap">{inline(paragraph)}</p>;
    })}
  </div>;
}
