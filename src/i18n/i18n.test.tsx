/** Spec 21 — the translation layer. */
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import en from "./messages/en.json";
import { parse, MessageError, signature } from "./message";
import { pseudo } from "./pseudo";
import { clerkLocalization, format, getLanguage, resetLanguageForTests, setLanguage, t, T, useLanguage } from "./index";
import { InLanguage, LanguageFilter, WrittenIn } from "./ContentLanguage";
import { formatAge, formatDate, formatNaira } from "../lib/format";

afterEach(() => resetLanguageForTests());

describe("message syntax (§5.3)", () => {
  it("placeholders, plurals, selects and tags", () => {
    expect(signature(parse("Hi {name}, <link>see</link> {n, plural, one {# post} other {# posts}}"))).toEqual(new Set(["{name}", "<link>", "{n}"]));
    expect(() => parse("{n, plural, one {x}}")).toThrow(MessageError); // "other" is required
    expect(() => parse("Unclosed <b>tag")).toThrow(MessageError);
    expect(() => parse("{oops")).toThrow(MessageError);
    expect(parse("Use '{' and '}' and '<' literally")).toEqual([{ k: "text", v: "Use { and } and < literally" }]);
  });

  it("every English message parses", () => {
    for (const [k, v] of Object.entries(en as Record<string, string>)) {
      expect(() => parse(v), k).not.toThrow();
    }
  });

  it("formats English exactly as before", () => {
    expect(t("auth.wait.seconds", { n: 1 })).toBe("1 second");
    expect(t("auth.wait.minutes", { n: 3 })).toBe("3 minutes");
    expect(t("format.age.days", { n: 2 })).toBe("2 days");
    expect(formatAge(new Date(Date.now() - 5 * 60_000))).toBe("5 min");
    expect(formatNaira(20000)).toBe("₦20,000");
    expect(formatDate("2026-10-31T13:45:00Z", { withTime: true, showZone: true })).toBe("31 Oct 2026, 2:45 pm WAT");
    expect(t("no.such.key")).toBe("no.such.key"); // never in a shipped build: check:i18n fails first
  });

  it("rich text renders components for tags", () => {
    const { container } = render(<p>{t.rich("languages.how-to-enable", { link: (c) => <a href="/x">{c}</a>, version: "abc" })}</p>);
    expect(container.querySelector("a")?.textContent).toBe("Settings defaults");
    expect(container.textContent).toContain("version is abc");
  });
});

describe("switching language (§5.4)", () => {
  it("re-renders in place, sets <html lang>, and falls back to English (marked lang=en) for missing keys", async () => {
    function Probe() {
      const lang = useLanguage();
      return <p data-testid="p">{lang}: <T k="content.all-languages" /></p>;
    }
    render(<Probe />);
    expect(screen.getByTestId("p").textContent).toBe("en: All languages");
    await act(async () => setLanguage("yo")); // the Yoruba catalogue is still empty
    expect(getLanguage()).toBe("yo");
    expect(document.documentElement.lang).toBe("yo");
    expect(screen.getByTestId("p").textContent).toBe("yo: All languages");
    expect(screen.getByTestId("p").querySelector('span[lang="en"]')).toBeTruthy(); // WCAG 3.1.2 for the English fallback
    await act(async () => setLanguage("xx"));
    expect(getLanguage()).toBe("en");
  });

  it("pseudo-language: accented, longer, placeholders untouched", async () => {
    expect(pseudo("Hello {name}")).toMatch(/^\[Ĥéļļö \{name\} ~+\]$/);
    expect(pseudo("{n, plural, one {# post} other {# posts}}")).toContain("{n, plural, one {# þöšţ} other {# þöšţš}}");
    await act(async () => setLanguage("qps"));
    expect(t("content.in-language", { name: "Hausa" })).toMatch(/^\[Îñ Hausa/);
  });

  it("Clerk gets our strings only for a translated language", async () => {
    expect(clerkLocalization()).toBeUndefined();
    await act(async () => setLanguage("ha"));
    expect(clerkLocalization()).toBeUndefined(); // nothing translated yet: Clerk keeps its English
  });

  it("formatting falls back to the language's own month names when the browser can't format it", async () => {
    await act(async () => setLanguage("ha"));
    const s = format.date("2027-01-16T09:00:00Z");
    expect(s).toMatch(/16/);
    expect(s).toMatch(/2027/);
  });
});

describe("the language of what people write (§9)", () => {
  it("marks someone's words with their language and a label when it isn't the reader's", () => {
    const { container } = render(<InLanguage language="ha"><p>Sannu</p></InLanguage>);
    expect(container.querySelector('div[lang="ha"]')?.textContent).toBe("Sannu");
    expect(container.textContent).toContain("In Hausa");
    const same = render(<InLanguage language="en"><p>Hello</p></InLanguage>);
    expect(same.container.textContent).not.toContain("In English");
    const unsure = render(<InLanguage language="und"><p>?</p></InLanguage>);
    expect(unsure.container.querySelector("[lang]")).toBeNull();
  });

  it("the writing and filter controls list the five languages in their own names", () => {
    render(<><WrittenIn value="yo" onChange={() => {}} /><LanguageFilter value="" onChange={() => {}} /></>);
    expect(screen.getAllByRole("option", { name: "Yorùbá (Yoruba)" })).toHaveLength(2);
    expect(screen.getByRole("option", { name: "Not sure" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "All languages" })).toBeTruthy();
  });
});
