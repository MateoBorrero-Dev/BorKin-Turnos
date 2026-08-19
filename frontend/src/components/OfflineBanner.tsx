import { useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const wentOffline = () => setOnline(false);
    const wentOnline = () => { setOnline(true); void queryClient.invalidateQueries({ refetchType: "active" }); };
    window.addEventListener("offline", wentOffline);
    window.addEventListener("online", wentOnline);
    return () => { window.removeEventListener("offline", wentOffline); window.removeEventListener("online", wentOnline); };
  }, [queryClient]);

  if (online) return null;
  return <div className="fixed inset-x-0 top-0 z-[70] flex min-h-11 items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950" role="status"><WifiOff size={17} />Sin conexión. Los datos pueden estar desactualizados y las operaciones requieren internet.</div>;
}
