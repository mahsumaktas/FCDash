"use client";

import { useEffect, useRef } from "react";
import { Toaster } from "sonner";
import { useGatewayStore } from "@/stores/gateway";

export function Providers({ children }: { children: React.ReactNode }) {
  const init = useGatewayStore((s) => s.init);
  const connect = useGatewayStore((s) => s.connect);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const url = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL ?? `ws://${window.location.hostname}:28643`;
    const token = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN;
    init({ url, token });
    connect();
  }, [init, connect]);

  return (
    <>
      {children}
      <Toaster position="bottom-right" theme="dark" richColors />
    </>
  );
}
