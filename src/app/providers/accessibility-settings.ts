export type TextSize = "small" | "medium" | "large" | "extra-large";

export interface AccessibilitySettings {
  textSize: TextSize;
  highContrast: boolean;
  reducedMotion: boolean;
}

export const defaultSettings: AccessibilitySettings = {
  textSize: "medium",
  highContrast: false,
  reducedMotion: false,
};

type AccessibilityAction =
  | { type: "text-size"; size: TextSize }
  | { type: "high-contrast" }
  | { type: "reduced-motion" }
  | { type: "reset" }
  | { type: "load"; settings: Partial<AccessibilitySettings> };

interface AccessibilityRoot {
  style: Pick<CSSStyleDeclaration, "setProperty">;
  classList: Pick<DOMTokenList, "add" | "remove">;
  setAttribute: HTMLElement["setAttribute"];
}

const STORAGE_KEY = "bakit-kita-iboboto-accessibility";

const textSizeScales: Record<TextSize, number> = {
  small: 0.875,
  medium: 1,
  large: 1.125,
  "extra-large": 1.25,
};

export function updateAccessibilitySettings(
  settings: AccessibilitySettings,
  action: AccessibilityAction
): AccessibilitySettings {
  switch (action.type) {
    case "text-size":
      return { ...settings, textSize: action.size };
    case "high-contrast":
      return { ...settings, highContrast: !settings.highContrast };
    case "reduced-motion":
      return { ...settings, reducedMotion: !settings.reducedMotion };
    case "reset":
      return defaultSettings;
    case "load":
      return { ...settings, ...action.settings };
  }
}

export function loadAccessibilitySettings(): Partial<AccessibilitySettings> | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as Partial<AccessibilitySettings>;
    }
  } catch (error) {
    console.error("Failed to load accessibility settings:", error);
  }
  return undefined;
}

export function saveAccessibilitySettings(settings: AccessibilitySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save accessibility settings:", error);
  }
}

export function applyAccessibilitySettings(
  root: AccessibilityRoot,
  settings: AccessibilitySettings
): void {
  root.style.setProperty("--accessibility-text-scale", String(textSizeScales[settings.textSize]));

  if (settings.highContrast) {
    root.classList.add("high-contrast");
  } else {
    root.classList.remove("high-contrast");
  }

  if (settings.reducedMotion) {
    root.classList.add("reduced-motion");
  } else {
    root.classList.remove("reduced-motion");
  }

  root.setAttribute("data-text-size", settings.textSize);
  root.setAttribute("data-high-contrast", String(settings.highContrast));
  root.setAttribute("data-reduced-motion", String(settings.reducedMotion));
}
