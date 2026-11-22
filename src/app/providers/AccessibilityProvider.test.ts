import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyAccessibilitySettings,
  defaultSettings,
  loadAccessibilitySettings,
  saveAccessibilitySettings,
  updateAccessibilitySettings,
  type AccessibilitySettings,
  type TextSize,
} from "./accessibility-settings";

const STORAGE_KEY = "bakit-kita-iboboto-accessibility";

function createStorage(stored?: string) {
  const values = new Map<string, string>();
  if (stored !== undefined) {
    values.set(STORAGE_KEY, stored);
  }
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  vi.stubGlobal("localStorage", storage);
  return storage;
}

function createRoot() {
  const classes = new Set<string>(["unrelated"]);
  const attributes = new Map<string, string>();
  const styles = new Map<string, string>();
  return {
    classes,
    attributes,
    styles,
    classList: {
      add: (...tokens: string[]) => tokens.forEach((token) => classes.add(token)),
      remove: (...tokens: string[]) => tokens.forEach((token) => classes.delete(token)),
    },
    style: {
      setProperty: (name: string, value: string | null) => styles.set(name, value ?? ""),
    },
    setAttribute: (name: string, value: string) => attributes.set(name, value),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Accessibility settings transitions and document effects", () => {
  it.each<[TextSize, string]>([
    ["small", "0.875"],
    ["medium", "1"],
    ["large", "1.125"],
    ["extra-large", "1.25"],
  ])(
    "applies the %s text scale and attribute without mutating previous settings",
    (size, scale) => {
      const original = { ...defaultSettings, highContrast: true, reducedMotion: true };
      const settings = updateAccessibilitySettings(original, { type: "text-size", size });
      const root = createRoot();

      applyAccessibilitySettings(root, settings);

      expect(root.styles.get("--accessibility-text-scale")).toBe(scale);
      expect(root.attributes.get("data-text-size")).toBe(size);
      expect(settings).toEqual({ textSize: size, highContrast: true, reducedMotion: true });
      expect(settings).not.toBe(original);
      expect(original).toEqual({ textSize: "medium", highContrast: true, reducedMotion: true });
    }
  );

  it("toggles high contrast on and off, preserving text size and reduced motion", () => {
    const original: AccessibilitySettings = {
      textSize: "large",
      highContrast: false,
      reducedMotion: true,
    };
    const root = createRoot();
    const enabled = updateAccessibilitySettings(original, { type: "high-contrast" });
    applyAccessibilitySettings(root, enabled);

    expect(enabled).toEqual({ textSize: "large", highContrast: true, reducedMotion: true });
    expect(root.classes).toEqual(new Set(["unrelated", "high-contrast", "reduced-motion"]));
    expect(root.attributes.get("data-high-contrast")).toBe("true");

    const disabled = updateAccessibilitySettings(enabled, { type: "high-contrast" });
    applyAccessibilitySettings(root, disabled);

    expect(disabled).toEqual({ textSize: "large", highContrast: false, reducedMotion: true });
    expect(root.classes).toEqual(new Set(["unrelated", "reduced-motion"]));
    expect(root.attributes.get("data-high-contrast")).toBe("false");
    expect(original.highContrast).toBe(false);
    expect(enabled.highContrast).toBe(true);
  });

  it("toggles reduced motion on and off without changing high contrast or text size", () => {
    const original: AccessibilitySettings = {
      textSize: "small",
      highContrast: true,
      reducedMotion: false,
    };
    const root = createRoot();
    const enabled = updateAccessibilitySettings(original, { type: "reduced-motion" });
    applyAccessibilitySettings(root, enabled);

    expect(enabled).toEqual({ textSize: "small", highContrast: true, reducedMotion: true });
    expect(root.classes).toEqual(new Set(["unrelated", "high-contrast", "reduced-motion"]));
    expect(root.attributes.get("data-reduced-motion")).toBe("true");

    const disabled = updateAccessibilitySettings(enabled, { type: "reduced-motion" });
    applyAccessibilitySettings(root, disabled);

    expect(disabled).toEqual({ textSize: "small", highContrast: true, reducedMotion: false });
    expect(root.classes).toEqual(new Set(["unrelated", "high-contrast"]));
    expect(root.attributes.get("data-reduced-motion")).toBe("false");
    expect(original.reducedMotion).toBe(false);
    expect(enabled.reducedMotion).toBe(true);
  });

  it("resets all settings and removes both accessibility classes", () => {
    const enabled: AccessibilitySettings = {
      textSize: "extra-large",
      highContrast: true,
      reducedMotion: true,
    };
    const root = createRoot();
    applyAccessibilitySettings(root, enabled);
    const reset = updateAccessibilitySettings(enabled, { type: "reset" });
    applyAccessibilitySettings(root, reset);

    expect(reset).toEqual({ textSize: "medium", highContrast: false, reducedMotion: false });
    expect(root.classes).toEqual(new Set(["unrelated"]));
    expect(Object.fromEntries(root.attributes)).toEqual({
      "data-text-size": "medium",
      "data-high-contrast": "false",
      "data-reduced-motion": "false",
    });
    expect(root.styles.get("--accessibility-text-scale")).toBe("1");
    expect(enabled).toEqual({ textSize: "extra-large", highContrast: true, reducedMotion: true });
  });
});

describe("Accessibility settings persistence", () => {
  it.each([undefined, ""])("keeps default settings when storage contains %s", (stored) => {
    createStorage(stored);
    expect(loadAccessibilitySettings()).toBeUndefined();
    const root = createRoot();
    applyAccessibilitySettings(root, defaultSettings);
    expect(root.styles.get("--accessibility-text-scale")).toBe("1");
    expect(root.classes).toEqual(new Set(["unrelated"]));
    expect(Object.fromEntries(root.attributes)).toEqual({
      "data-text-size": "medium",
      "data-high-contrast": "false",
      "data-reduced-motion": "false",
    });
  });

  it("merges partial stored settings without losing current values", () => {
    createStorage('{"textSize":"large"}');
    const original = { ...defaultSettings, highContrast: true };
    const settings = updateAccessibilitySettings(original, {
      type: "load",
      settings: loadAccessibilitySettings()!,
    });
    expect(settings).toEqual({ textSize: "large", highContrast: true, reducedMotion: false });
    expect(original).toEqual({ textSize: "medium", highContrast: true, reducedMotion: false });
  });

  it("persists all current settings under the existing key and loads them again", () => {
    const storage = createStorage();
    const settings: AccessibilitySettings = {
      textSize: "extra-large",
      highContrast: true,
      reducedMotion: true,
    };
    saveAccessibilitySettings(settings);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual({
      textSize: "extra-large",
      highContrast: true,
      reducedMotion: true,
    });
    expect(loadAccessibilitySettings()).toEqual(settings);
  });

  it("preserves the existing unchecked stored-value policy", () => {
    createStorage('{"textSize":"unknown","highContrast":"enabled","extra":42}');
    const settings = updateAccessibilitySettings(defaultSettings, {
      type: "load",
      settings: loadAccessibilitySettings()!,
    });
    expect(settings).toEqual({
      textSize: "unknown",
      highContrast: "enabled",
      reducedMotion: false,
      extra: 42,
    });
  });

  it("reports invalid JSON and retains the defaults", () => {
    createStorage("{invalid JSON");
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(loadAccessibilitySettings()).toBeUndefined();
    expect(report).toHaveBeenCalledWith(
      "Failed to load accessibility settings:",
      expect.any(SyntaxError)
    );
  });

  it("contains and reports storage read failures", () => {
    const failure = new Error("Storage blocked");
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw failure;
      },
    });
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(loadAccessibilitySettings()).toBeUndefined();
    expect(report).toHaveBeenCalledWith("Failed to load accessibility settings:", failure);
  });

  it("contains and reports storage write failures", () => {
    const failure = new Error("Storage full");
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw failure;
      },
    });
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => saveAccessibilitySettings(defaultSettings)).not.toThrow();
    expect(report).toHaveBeenCalledWith("Failed to save accessibility settings:", failure);
  });
});
