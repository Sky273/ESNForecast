import { assessSecurityContext } from "@esn-forecast/shared";

export function getSecurityContext() {
  return assessSecurityContext({
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    mode: import.meta.env.MODE
  });
}
