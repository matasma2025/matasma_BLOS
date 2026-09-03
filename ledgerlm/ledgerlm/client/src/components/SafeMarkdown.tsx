import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface SafeMarkdownProps {
  children: string;
  components?: Components;
}

export function isAllowedApplicationLink(href: string): boolean {
  const value = href.trim();
  if (!value || value.startsWith("//")) {
    return false;
  }

  if (value.startsWith("#")) {
    return true;
  }

  if (typeof window === "undefined") {
    return value.startsWith("/") && !value.startsWith("//");
  }

  try {
    const parsed = new URL(value, window.location.origin);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.origin === window.location.origin
    );
  } catch {
    return false;
  }
}

const SafeLink: Components["a"] = ({ href, children, ...props }) => {
  if (!href || !isAllowedApplicationLink(href)) {
    return (
      <span
        className="break-all text-muted-foreground"
        title="External or unsafe link displayed as text"
      >
        {children}
        {href ? ` (${href})` : null}
      </span>
    );
  }

  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
};

export function SafeMarkdown({ children, components }: SafeMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{ ...components, a: SafeLink }}
    >
      {children}
    </ReactMarkdown>
  );
}