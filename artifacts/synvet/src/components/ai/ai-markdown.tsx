interface AIMarkdownProps {
  content: string;
}

function renderInline(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,;:!?])/g, "$1<em>$2</em>");
}

export function AIMarkdown({ content }: AIMarkdownProps) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={`ul-${key++}`} className="list-disc pl-6 space-y-1 my-3 text-sm leading-relaxed text-foreground/90">
        {listBuffer.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) {
      flushList();
      blocks.push(
        <h4 key={`h-${key++}`} className="text-sm font-semibold text-foreground mt-4 mb-1">
          <span dangerouslySetInnerHTML={{ __html: renderInline(line.replace(/^###\s+/, "")) }} />
        </h4>,
      );
    } else if (/^##\s+/.test(line)) {
      flushList();
      blocks.push(
        <h3 key={`h-${key++}`} className="text-base font-semibold text-foreground mt-5 mb-2 border-l-2 border-primary pl-3">
          <span dangerouslySetInnerHTML={{ __html: renderInline(line.replace(/^##\s+/, "")) }} />
        </h3>,
      );
    } else if (/^#\s+/.test(line)) {
      flushList();
      blocks.push(
        <h2 key={`h-${key++}`} className="text-lg font-bold text-foreground mt-5 mb-2">
          <span dangerouslySetInnerHTML={{ __html: renderInline(line.replace(/^#\s+/, "")) }} />
        </h2>,
      );
    } else if (/^[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^[-*]\s+/, ""));
    } else if (/^\d+\.\s+/.test(line)) {
      listBuffer.push(line.replace(/^\d+\.\s+/, ""));
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      blocks.push(
        <p key={`p-${key++}`} className="text-sm leading-relaxed text-foreground/90 my-2">
          <span dangerouslySetInnerHTML={{ __html: renderInline(line) }} />
        </p>,
      );
    }
  }
  flushList();
  return <div className="ai-markdown">{blocks}</div>;
}
