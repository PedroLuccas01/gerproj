const TAB_KEY = "pdef-tab-session";
const HEARTBEAT_KEY = "pdef-session-heartbeat";
const CHANNEL = "pdef-auth-session";
/** Chrome can restore session cookies after reboot; a stale heartbeat means the process died. */
const STALE_MS = 60_000;

function writeHeartbeat() {
  try {
    localStorage.setItem(HEARTBEAT_KEY, String(Date.now()));
  } catch {
    /* private mode / blocked storage */
  }
}

export function markBrowserSessionLive() {
  try {
    sessionStorage.setItem(TAB_KEY, "1");
  } catch {
    /* ignore */
  }
  writeHeartbeat();
}

export function clearBrowserSession() {
  try {
    sessionStorage.removeItem(TAB_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(HEARTBEAT_KEY);
  } catch {
    /* ignore */
  }
}

function pingPeers(): Promise<boolean> {
  if (typeof BroadcastChannel === "undefined") return Promise.resolve(false);

  return new Promise((resolve) => {
    const channel = new BroadcastChannel(CHANNEL);
    const timer = window.setTimeout(() => {
      channel.close();
      resolve(false);
    }, 250);
    channel.onmessage = (event) => {
      if (event.data === "pong") {
        window.clearTimeout(timer);
        channel.close();
        resolve(true);
      }
    };
    channel.postMessage("ping");
  });
}

/** True if this tab is a continuation of an open session (refresh / extra tab). */
export async function isBrowserSessionLive(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    if (sessionStorage.getItem(TAB_KEY)) {
      const heartbeat = Number(localStorage.getItem(HEARTBEAT_KEY) || 0);
      if (heartbeat > 0 && Date.now() - heartbeat > STALE_MS) return false;
      return true;
    }
  } catch {
    return false;
  }

  if (await pingPeers()) {
    markBrowserSessionLive();
    return true;
  }

  return false;
}

export function startBrowserSessionHeartbeat() {
  writeHeartbeat();
  const interval = window.setInterval(writeHeartbeat, 4000);

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event) => {
      if (event.data !== "ping") return;
      try {
        if (sessionStorage.getItem(TAB_KEY)) channel?.postMessage("pong");
      } catch {
        /* ignore */
      }
    };
  }

  const persistHeartbeat = () => writeHeartbeat();
  window.addEventListener("pagehide", persistHeartbeat);

  return () => {
    window.clearInterval(interval);
    window.removeEventListener("pagehide", persistHeartbeat);
    channel?.close();
  };
}
