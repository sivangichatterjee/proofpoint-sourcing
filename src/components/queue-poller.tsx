"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function QueuePoller() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionStorage.getItem("scanRunning") === "true") {
        router.refresh();
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [router]);

  return null;
}
