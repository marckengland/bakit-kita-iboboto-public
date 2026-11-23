import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "../i18n/messages/en.json";
import { AccessibilityProvider } from "../app/providers/AccessibilityProvider";
import ContactPage from "../app/contact/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.unstubAllEnvs());

function renderContact() {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: "en",
      messages,
      timeZone: "UTC",
      children: createElement(AccessibilityProvider, {
        children: createElement(ContactPage),
      }),
    })
  );
}

it("lets a visitor read privacy and correction information while contact is disabled", () => {
  vi.stubEnv("PRIVATE_CONTACT_ENABLED", "false");
  const html = renderContact();
  expect(html).toContain('href="/privacy"');
  expect(html).toContain("Privacy and corrections");
  expect(html).toContain("Private delivery is unavailable for this pilot");
  expect(html).toContain("Reports cannot be sent yet");
  expect(html).toContain("<fieldset disabled=");
});
