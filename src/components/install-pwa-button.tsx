import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { safeGet, safeSet } from "@/lib/safe-storage";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "dc-install-dismissed-at";
const DISMISS_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function isStandalone() {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true
    );
  } catch {
    return false;
  }
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
}

export function InstallPWAButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissed && Date.now() - dismissed < DISMISS_MS) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS fallback (no beforeinstallprompt)
    if (isIOS()) setVisible(true);

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
    setShowIOSHint(false);
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted" || outcome === "dismissed") {
        setDeferred(null);
        setVisible(false);
      }
      return;
    }
    if (isIOS()) {
      setShowIOSHint(true);
      return;
    }
  };

  return (
    <>
      <div className="fixed bottom-24 right-3 z-40 sm:bottom-6 sm:right-6">
        <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary text-primary-foreground shadow-lg">
          <button
            onClick={install}
            className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold hover:opacity-90"
            aria-label="Install app"
          >
            <Download className="h-4 w-4" />
            Install app
          </button>
          <button
            onClick={dismiss}
            className="pr-3 pl-1 text-primary-foreground/80 hover:text-primary-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showIOSHint && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setShowIOSHint(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-5 text-card-foreground shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">Install on iPhone</h3>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>1. Tap the <b>Share</b> button in Safari.</li>
              <li>2. Scroll and tap <b>Add to Home Screen</b>.</li>
              <li>3. Tap <b>Add</b> — done!</li>
            </ol>
            <button
              onClick={dismiss}
              className="mt-4 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
