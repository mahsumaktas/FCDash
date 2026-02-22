// ── Transition presets ──────────────────────────────────────────────────────

export const springTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 24,
};

export const easeOutTransition = {
  duration: 0.3,
  ease: "easeOut" as const,
};

export const quickTransition = {
  duration: 0.15,
  ease: "easeOut" as const,
};

// ── Page transition variants ────────────────────────────────────────────────

export const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -5 },
};

export const pageTransition = {
  duration: 0.3,
  ease: [0.4, 0, 0.2, 1],
};

// ── Stagger container ───────────────────────────────────────────────────────

export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
};

// ── Message animations ──────────────────────────────────────────────────────

export const messageVariants = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.15 },
  },
};

// ── Card hover ──────────────────────────────────────────────────────────────

export const cardHoverVariants = {
  rest: { y: 0, boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)" },
  hover: {
    y: -2,
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    transition: quickTransition,
  },
};

// ── Button press ────────────────────────────────────────────────────────────

export const buttonTapVariants = {
  rest: { scale: 1 },
  tap: { scale: 0.97 },
};

// ── Modal / Dialog ──────────────────────────────────────────────────────────

export const modalVariants = {
  initial: { opacity: 0, scale: 0.96, y: 10 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 10,
    transition: { duration: 0.15 },
  },
};

export const backdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

// ── Sidebar ─────────────────────────────────────────────────────────────────

export const sidebarVariants = {
  open: {
    x: 0,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
  },
  closed: {
    x: "-100%",
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
};

// ── Toast / notification ────────────────────────────────────────────────────

export const toastVariants = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.2, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: 20,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

// ── Number counter (for KPI cards) ──────────────────────────────────────────

export const numberCounterVariants = {
  initial: { opacity: 0, y: 5 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

// ── Pulse for connection status ─────────────────────────────────────────────

export const pulseVariants = {
  initial: { scale: 1, opacity: 1 },
  animate: {
    scale: [1, 1.3, 1],
    opacity: [1, 0.6, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// ── Collapse / expand ───────────────────────────────────────────────────────

export const collapseVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    overflow: "hidden" as const,
    transition: { duration: 0.2, ease: "easeInOut" },
  },
  expanded: {
    height: "auto",
    opacity: 1,
    overflow: "hidden" as const,
    transition: { duration: 0.2, ease: "easeInOut" },
  },
};

// ── List item stagger ───────────────────────────────────────────────────────

export const listStaggerContainer = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.04 },
  },
};

export const listStaggerItem = {
  initial: { opacity: 0, x: -8 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2, ease: "easeOut" },
  },
};
