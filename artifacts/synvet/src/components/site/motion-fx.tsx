import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

export function EcgLine({
  className = "",
  color = "#7A5CFF",
  duration = 4.2,
  strokeWidth = 1.25,
  opacity = 0.55,
}: {
  className?: string;
  color?: string;
  duration?: number;
  strokeWidth?: number;
  opacity?: number;
}) {
  const reduce = useReducedMotion();
  const d =
    "M0 50 L120 50 L150 50 L168 30 L182 70 L200 50 L240 50 L260 50 L275 35 L285 65 L300 50 L420 50 L450 50 L468 28 L482 72 L500 50 L640 50 L670 50 L685 38 L695 62 L710 50 L820 50";
  return (
    <svg
      aria-hidden
      viewBox="0 0 820 100"
      preserveAspectRatio="none"
      className={`pointer-events-none ${className}`}
    >
      <defs>
        <linearGradient id="ecg-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0" />
          <stop offset="0.18" stopColor={color} stopOpacity={opacity} />
          <stop offset="0.82" stopColor={color} stopOpacity={opacity} />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id="ecg-glow" x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>
      <motion.path
        d={d}
        fill="none"
        stroke="url(#ecg-fade)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#ecg-glow)"
        initial={reduce ? { pathLength: 1, opacity } : { pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: false, margin: "-40px" }}
        transition={{
          pathLength: { duration: reduce ? 0 : duration, ease: EASE },
          opacity: { duration: 0.8, ease: EASE },
        }}
      />
    </svg>
  );
}

export function PulseGlow({
  className = "",
  size = 420,
  color = "#7A5CFF",
  intensity = 0.18,
}: {
  className?: string;
  size?: number;
  color?: string;
  intensity?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
      style={{ width: size, height: size, background: color, opacity: intensity }}
      animate={
        reduce
          ? { opacity: intensity }
          : { opacity: [intensity * 0.7, intensity * 1.15, intensity * 0.7], scale: [1, 1.06, 1] }
      }
      transition={{ duration: 6.5, ease: "easeInOut", repeat: Infinity }}
    />
  );
}

function PawShape({ size = 28, color = "#B6A6FF", opacity = 1 }: { size?: number; color?: string; opacity?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden style={{ opacity }}>
      <g fill={color}>
        <ellipse cx="22" cy="20" rx="5" ry="7" />
        <ellipse cx="42" cy="20" rx="5" ry="7" />
        <ellipse cx="12" cy="34" rx="4.5" ry="6" />
        <ellipse cx="52" cy="34" rx="4.5" ry="6" />
        <path d="M32 30c-9 0-16 7-16 15 0 6 5 10 10 10 3 0 4-2 6-2s3 2 6 2c5 0 10-4 10-10 0-8-7-15-16-15z" />
      </g>
    </svg>
  );
}

interface PawSpec {
  x: number;
  y: number;
  rotate: number;
  size: number;
  delay: number;
  opacity: number;
}

export function PawTrail({
  className = "",
  count = 7,
  color = "#7A5CFF",
}: {
  className?: string;
  count?: number;
  color?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [paws, setPaws] = useState<PawSpec[]>([]);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const generated: PawSpec[] = [];
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      generated.push({
        x: 50 + side * (8 + (i % 3) * 6) + (Math.sin(i * 1.7) * 4),
        y: (i + 0.5) * (100 / count),
        rotate: side * (12 + (i % 4) * 5) + (i % 2 === 0 ? -90 : 90),
        size: 22 + (i % 3) * 6,
        delay: i * 0.35,
        opacity: 0.05 + ((i % 3) * 0.015),
      });
    }
    setPaws(generated);
  }, [count]);

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollY(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reduce]);

  return (
    <div
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {paws.map((p, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: `translate(-50%, -50%) translateY(${reduce ? 0 : scrollY * (-0.04 - (i % 3) * 0.02)}px) rotate(${p.rotate}deg)`,
          }}
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: p.opacity, scale: 1 }}
          viewport={{ once: false, margin: "-100px" }}
          transition={{ duration: 1.4, delay: p.delay, ease: EASE }}
        >
          <PawShape size={p.size} color={color} />
        </motion.div>
      ))}
    </div>
  );
}

export function StethoscopeConnection({
  className = "",
  color = "#5B8CFF",
  duration = 2.6,
  opacity = 0.4,
}: {
  className?: string;
  color?: string;
  duration?: number;
  opacity?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <svg
      aria-hidden
      viewBox="0 0 600 200"
      preserveAspectRatio="none"
      className={`pointer-events-none ${className}`}
    >
      <defs>
        <linearGradient id="steth-grad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0" />
          <stop offset="0.5" stopColor={color} stopOpacity={opacity} />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d="M40 100 C 160 20, 280 180, 400 100 S 560 60, 580 100"
        fill="none"
        stroke="url(#steth-grad)"
        strokeWidth="1"
        strokeLinecap="round"
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: false, margin: "-60px" }}
        transition={{ duration: reduce ? 0 : duration, ease: EASE }}
      />
      <motion.circle
        cx="40"
        cy="100"
        r="3"
        fill={color}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: opacity * 1.4 }}
        viewport={{ once: false }}
        transition={{ duration: 0.8, delay: 0.4, ease: EASE }}
      />
      <motion.circle
        cx="580"
        cy="100"
        r="3"
        fill={color}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: opacity * 1.4 }}
        viewport={{ once: false }}
        transition={{ duration: 0.8, delay: duration * 0.7, ease: EASE }}
      />
    </svg>
  );
}

export function HeartbeatDot({
  className = "",
  color = "#7A5CFF",
  size = 10,
}: {
  className?: string;
  color?: string;
  size?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <span
      aria-hidden
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: color }}
        animate={
          reduce
            ? { opacity: 0.35 }
            : { scale: [1, 2.4, 2.4], opacity: [0.55, 0, 0] }
        }
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", times: [0, 0.7, 1] }}
      />
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: color }}
        animate={reduce ? { opacity: 0.85 } : { opacity: [0.85, 1, 0.85], scale: [1, 1.08, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
    </span>
  );
}

export function GridFloor({
  className = "",
  opacity = 0.06,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(122,92,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(122,92,255,0.5) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
        opacity,
        maskImage:
          "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        WebkitMaskImage:
          "radial-gradient(ellipse at center, black 30%, transparent 75%)",
      }}
    />
  );
}

export function SectionDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`relative h-12 max-w-7xl mx-auto px-4 sm:px-6 ${className}`}>
      <EcgLine className="absolute inset-x-4 sm:inset-x-6 top-1/2 -translate-y-1/2 h-12 w-[calc(100%-2rem)] sm:w-[calc(100%-3rem)]" opacity={0.35} duration={3.2} />
    </div>
  );
}
