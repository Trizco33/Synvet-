import { motion, useReducedMotion } from "framer-motion";

export function LogoMarquee({
  items,
  speed = 38,
  className = "",
}: {
  items: string[];
  speed?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const loop = [...items, ...items, ...items];

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
      }}
    >
      <motion.div
        className="flex items-center gap-12 whitespace-nowrap"
        animate={reduce ? undefined : { x: ["0%", "-33.333%"] }}
        transition={{
          duration: speed,
          ease: "linear",
          repeat: Infinity,
        }}
        style={{ willChange: "transform" }}
      >
        {loop.map((label, i) => (
          <span
            key={`${label}-${i}`}
            className="text-base md:text-lg font-medium tracking-tight text-white/40 hover:text-white/80 transition-colors shrink-0"
          >
            {label}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
