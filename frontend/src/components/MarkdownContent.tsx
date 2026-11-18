import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Render model text as a document. Raw HTML is deliberately never executed. */
export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-content">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          table: ({ children }) => (
            <div className="markdown-table-wrap">
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
