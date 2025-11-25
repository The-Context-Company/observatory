import { createWidget } from "@/widget";
import styles from "@/styles.css";

let rootContainer: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;

export interface WidgetOptions {
  enabled?: boolean;
  onMount?: () => void;
}

export const initWidget = (options: WidgetOptions = {}) => {
  const { enabled = true, onMount } = options;

  if (!enabled) return;
  if (typeof window === "undefined") return;

  if (rootContainer && shadowRoot) {
    console.warn("Widget already initialized");
    return;
  }

  rootContainer = document.createElement("div");
  rootContainer.id = "tcc-widget-shadow-host";

  shadowRoot = rootContainer.attachShadow({ mode: "open" });

  // inject compiled tailwind
  const styleEl = document.createElement("style");
  styleEl.textContent = styles;
  shadowRoot.appendChild(styleEl);

  document.documentElement.appendChild(rootContainer);

  createWidget(shadowRoot);

  onMount?.();

  return cleanup;
};

export const cleanup = () => {
  if (rootContainer) {
    rootContainer.remove();
    rootContainer = null;
    shadowRoot = null;
  }
};

if (typeof window !== "undefined") {
  (window as any).TCCWidget = {
    init: initWidget,
    cleanup,
  };
}
