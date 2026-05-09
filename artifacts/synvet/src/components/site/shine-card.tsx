import { useRef, type ReactNode, type MouseEvent } from "react";

export function ShineCard({
  children,
  className = "",
  glowColor = "rgba(122,92,255,0.18)",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  as?: "div" | "section" | "article";
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--mx", `${x}%`);
    el.style.setProperty("--my", `${y}%`);
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mx", `50%`);
    el.style.setProperty("--my", `-20%`);
  };

  const Comp = Tag as "div";
  return (
    <Comp
      ref={ref as never}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`group/shine relative overflow-hidden ${className}`}
      style={
        {
          "--mx": "50%",
          "--my": "-20%",
          backgroundImage: `radial-gradient(360px circle at var(--mx) var(--my), ${glowColor}, transparent 60%)`,
        } as React.CSSProperties
      }
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 group-hover/shine:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(220px circle at var(--mx) var(--my), rgba(255,255,255,0.06), transparent 65%)`,
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover/shine:opacity-100 transition-opacity duration-500"
        style={{
          padding: "1px",
          background:
            "linear-gradient(120deg, rgba(122,92,255,0.5), rgba(91,140,255,0.35), transparent 60%)",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      <div className="relative">{children}</div>
    </Comp>
  );
}
