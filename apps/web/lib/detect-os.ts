export type OsId = "unix" | "windows";

interface NavigatorWithUaData extends Navigator {
  userAgentData?: { platform?: string };
}

export function detectOs(): OsId | null {
  if (typeof navigator === "undefined") return null;

  const nav = navigator as NavigatorWithUaData;
  const platform = nav.userAgentData?.platform ?? nav.platform ?? nav.userAgent;
  if (!platform) return null;

  if (/win/i.test(platform)) return "windows";
  if (/mac|linux|x11/i.test(platform)) return "unix";
  return null;
}
