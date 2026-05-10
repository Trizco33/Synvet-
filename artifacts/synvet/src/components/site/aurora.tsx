import { motion, useReducedMotion } from "framer-motion";

export function Aurora({
  className = "",
  intensity = 0.45,
}: {
  className?: string;
  intensity?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <motion.div
        className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-[140%] h-[140%] rounded-full blur-[120px]"
        style={{
          background:
            "conic-gradient(from 0deg at 50% 50%, rgba(122,92,255,0) 0deg, rgba(122,92,255,0.55) 90deg, rgba(91,140,255,0.45) 180deg, rgba(182,166,255,0.3) 270deg, rgba(122,92,255,0) 360deg)",
          opacity: intensity,
          willChange: "transform",
        }}
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 60, ease: "linear", repeat: Infinity }}
      />
      <div
        className="absolute inset-0"
        style={{
          maskImage:
            "radial-gradient(ellipse at center top, black 0%, black 30%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center top, black 0%, black 30%, transparent 70%)",
        }}
      />
    </div>
  );
}
