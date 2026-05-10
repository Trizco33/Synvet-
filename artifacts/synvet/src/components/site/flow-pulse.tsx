import { motion, useReducedMotion } from "framer-motion";

export function FlowPulse({
  className = "",
  duration = 5.2,
}: {
  className?: string;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div
      aria-hidden
      className={`absolute pointer-events-none ${className}`}
      style={{ height: 2 }}
    >
      <motion.div
        className="absolute top-0 h-full w-[20%] rounded-full"
        style={{
          background:
            "linear-gradient(90deg, transparent, #B6A6FF, #ffffff, #B6A6FF, transparent)",
          filter: "drop-shadow(0 0 6px rgba(182,166,255,0.8))",
        }}
        animate={{ left: ["-20%", "100%"] }}
        transition={{
          duration,
          ease: [0.65, 0, 0.35, 1],
          repeat: Infinity,
          repeatDelay: 0.6,
        }}
      />
    </div>
  );
}
