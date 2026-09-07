export type FeedbackKind = "success" | "error" | "warning" | "info";

export interface FeedbackOptions {
  kind?: FeedbackKind;
  timeoutMs?: number;
}

export function showToast(message: string, options: FeedbackOptions = {}): void {
  const kind = options.kind ?? "success";
  const timeoutMs = options.timeoutMs ?? 2600;

  let region = document.getElementById("app-feedback-region");
  if (!region) {
    region = document.createElement("div");
    region.id = "app-feedback-region";
    region.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
    region.setAttribute("aria-atomic", "true");
    document.body.appendChild(region);
  }

  const toast = document.createElement("div");
  toast.className = `app-toast app-toast-${kind}`;
  toast.setAttribute("role", kind === "error" ? "alert" : "status");
  toast.textContent = message;
  region.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 180);
  }, timeoutMs);
}
