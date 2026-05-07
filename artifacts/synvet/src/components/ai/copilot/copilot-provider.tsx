import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface CopilotContextValue {
  petId: string;
  consultationId: string | null;
  label: string;
}

interface CopilotState {
  context: CopilotContextValue | null;
  open: boolean;
  setContext: (ctx: CopilotContextValue | null) => void;
  setOpen: (open: boolean) => void;
}

const CopilotCtx = createContext<CopilotState | null>(null);

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<CopilotContextValue | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <CopilotCtx.Provider value={{ context, open, setContext, setOpen }}>
      {children}
    </CopilotCtx.Provider>
  );
}

export function useCopilot(): CopilotState {
  const ctx = useContext(CopilotCtx);
  if (!ctx) throw new Error("useCopilot must be used within CopilotProvider");
  return ctx;
}

/**
 * Sets the Copilot context for the current page; clears on unmount.
 */
export function useSetCopilotContext(value: CopilotContextValue | null): void {
  const { setContext } = useCopilot();
  const stableValue = value ? JSON.stringify(value) : "";
  const apply = useCallback(() => {
    setContext(value);
    return () => setContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableValue, setContext]);
  useEffect(apply, [apply]);
}
