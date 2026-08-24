import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import * as cheerio from "cheerio";
import { improvePromptWithFreeChatbot } from "./free-chatbot";
import type { StoredExampleOutput, StoredImportCandidate } from "../db";

const MAX_HTML_BYTES = 1_500_000;
const MAX_EXCERPT_LENGTH = 12_000;
const MAX_CANDIDATES_PER_SOURCE = 2;
const USER_AGENT = "VerbixReviewImporter/1.0 (+https://verbix.example/import-policy)";

export class ImportBlockedError extends Error {
  constructor(message: string, readonly robotsState: "blocked" | "unavailable" = "blocked") {
    super(message);
    this.name = "ImportBlockedError";
  }
}

type Modality = StoredImportCandidate["modality"];

type SourceInspection = {
  canonicalUrl: string;
  pageTitle: string | null;
  displayedAuthor: string | null;
  licenseNotice: string | null;
  robotsState: "allowed" | "unavailable";
  contentHash: string;
  excerpt: string;
  promptBlocks: string[];
  exampleOutputs: StoredExampleOutput[];
};

function normalizeSpace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function validPublicUrl(input: string) {
  const url = new URL(input);
  if (!/^https?:$/.test(url.protocol)) throw new ImportBlockedError("Only public HTTP(S) URLs can be imported.");
  if (url.username || url.password) throw new ImportBlockedError("URLs containing credentials cannot be imported.");
  return url;
}

function isPrivateAddress(address: string) {
  const family = isIP(address);
  if (family === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168;
  }
  const normalized = address.toLowerCase();
  return family === 6 && (normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:"));
}

async function assertPublicHostname(url: URL) {
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(entry => isPrivateAddress(entry.address))) {
    throw new ImportBlockedError("The submitted URL does not resolve to a public address.");
  }
}

function pathBlockedByRobots(robotsText: string, pathname: string) {
  let applies = false;
  const rules: string[] = [];
  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const [field, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (field.toLowerCase() === "user-agent") {
      applies = value === "*" || value.toLowerCase().includes("verbix");
      continue;
    }
    if (applies && field.toLowerCase() === "disallow" && value) rules.push(value);
  }
  return rules.some(rule => pathname.startsWith(rule));
}

async function getRobotsState(url: URL) {
  try {
    const robotsUrl = new URL("/robots.txt", url.origin);
    const response = await fetch(robotsUrl, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(6_000) });
    if (!response.ok) return "unavailable" as const;
    const robotsText = await response.text();
    if (pathBlockedByRobots(robotsText, url.pathname)) throw new ImportBlockedError("The source’s robots policy does not permit this path.");
    return "allowed" as const;
  } catch (error) {
    if (error instanceof ImportBlockedError) throw error;
    return "unavailable" as const;
  }
}

async function fetchApprovedHtml(rawUrl: string) {
  let current = validPublicUrl(rawUrl);
  let robotsState: "allowed" | "unavailable" = "unavailable";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await assertPublicHostname(current);
    robotsState = await getRobotsState(current);
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(12_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The source redirected without a destination.");
      current = validPublicUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`The source returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) throw new ImportBlockedError("Only HTML pages can be imported in review-first mode.");
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_HTML_BYTES) throw new ImportBlockedError("The source page exceeds the importer’s safety limit.");
    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) throw new ImportBlockedError("The source page exceeds the importer’s safety limit.");
    return { html, url: current.toString(), httpStatus: response.status, robotsState };
  }
  throw new ImportBlockedError("The source redirected too many times.");
}

function absolutePublicUrl(value: string | undefined, baseUrl: string) {
  if (!value) return null;
  try {
    const url = new URL(value, baseUrl);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function detectModality(value: string): Modality {
  const lower = value.toLowerCase();
  if (/\b(blender|mesh|3d model|three[- ]dimensional|obj|glb)\b/.test(lower)) return "three_d";
  if (/\b(video|sora|veo|runway|camera shot|motion)\b/.test(lower)) return "video";
  if (/\b(image|midjourney|stable diffusion|dall[·-]?e|flux|illustration|photorealistic)\b/.test(lower)) return "image";
  if (/\b(audio|music|song|voiceover|sound effect|podcast)\b/.test(lower)) return "audio";
  if (/\b(code|typescript|javascript|python|sql|function|api endpoint)\b/.test(lower)) return "code";
  return "text";
}

function modelHints(value: string, modality: Modality) {
  const known = ["Midjourney", "Stable Diffusion", "DALL·E", "Flux", "Sora", "Veo", "Runway", "Blender", "ChatGPT", "Claude", "Gemini"];
  const matches = known.filter(name => value.toLowerCase().includes(name.toLowerCase()));
  if (matches.length) return matches;
  return modality === "image" ? ["Image generation model"] : modality === "video" ? ["Video generation model"] : modality === "audio" ? ["Audio generation model"] : modality === "three_d" ? ["3D generation model"] : modality === "code" ? ["Coding model"] : ["General AI model"];
}

function extractPromptBlocks($: cheerio.CheerioAPI, bodyText: string) {
  const candidates: string[] = [];
  $("pre, code, blockquote").each((_, element) => {
    const text = normalizeSpace($(element).text());
    if (text.length >= 40 && text.length <= 6_000) candidates.push(text);
  });
  $("h1, h2, h3, h4, strong, b").each((_, element) => {
    const label = normalizeSpace($(element).text()).toLowerCase();
    if (!/(prompt|negative prompt|example prompt|generation prompt|video prompt|image prompt)/.test(label)) return;
    const next = normalizeSpace($(element).nextAll("p, pre, code, blockquote").slice(0, 2).text());
    if (next.length >= 40 && next.length <= 6_000) candidates.push(next);
  });
  const inlineMatches = bodyText.matchAll(/(?:prompt|instruction)\s*[:—-]\s*([^\n]{40,1000})/gi);
  Array.from(inlineMatches).forEach(match => candidates.push(normalizeSpace(match[1])));
  if (!candidates.length && /\b(generate|create|write|act as|produce)\b/i.test(bodyText) && bodyText.length >= 120) {
    candidates.push(bodyText.slice(0, 4_000));
  }
  return Array.from(new Set(candidates.map(value => value.slice(0, 6_000)))).slice(0, MAX_CANDIDATES_PER_SOURCE);
}

function extractExampleOutputs($: cheerio.CheerioAPI, canonicalUrl: string): StoredExampleOutput[] {
  const outputs: StoredExampleOutput[] = [];
  $("article img, main img, figure img, article video, main video, figure video, article audio, main audio").each((_, element) => {
    const tag = element.tagName.toLowerCase();
    const source = tag === "img" ? $(element).attr("src") : $(element).attr("src") || $(element).find("source").first().attr("src");
    const mediaUrl = absolutePublicUrl(source, canonicalUrl);
    if (!mediaUrl) return;
    outputs.push({
      sourceUrl: canonicalUrl,
      mediaUrl,
      mediaType: tag === "img" ? "image" : tag === "video" ? "video" : "audio",
      altText: normalizeSpace($(element).attr("alt") ?? $(element).attr("title") ?? "").slice(0, 500) || undefined,
    });
  });
  return Array.from(new Map(outputs.map(output => [`${output.mediaType}:${output.mediaUrl}`, output])).values()).slice(0, 12);
}

export async function inspectApprovedSource(rawUrl: string): Promise<SourceInspection & { httpStatus: number }> {
  const { html, url, httpStatus, robotsState } = await fetchApprovedHtml(rawUrl);
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, header, aside, form").remove();
  const textRoot = $("main, article").first().length ? $("main, article").first() : $("body");
  const bodyText = normalizeSpace(textRoot.text());
  if (!bodyText) throw new Error("The source page did not contain readable text.");
  const canonicalUrl = absolutePublicUrl($("link[rel='canonical']").attr("href"), url) ?? url;
  const pageTitle = normalizeSpace($("meta[property='og:title']").attr("content") ?? $("title").text()).slice(0, 360) || null;
  const displayedAuthor = normalizeSpace($("meta[name='author']").attr("content") ?? $("[rel='author']").first().text()).slice(0, 240) || null;
  const licenseText = [$("[rel='license']").first().text(), $("footer").text(), $("body").text()].map(normalizeSpace).find(value => /(creative commons|cc by|license|copyright|all rights reserved)/i.test(value));
  return {
    canonicalUrl,
    pageTitle,
    displayedAuthor,
    licenseNotice: licenseText?.slice(0, 1000) ?? null,
    robotsState,
    contentHash: createHash("sha256").update(bodyText).digest("hex"),
    excerpt: bodyText.slice(0, MAX_EXCERPT_LENGTH),
    promptBlocks: extractPromptBlocks($, bodyText),
    exampleOutputs: extractExampleOutputs($, canonicalUrl),
    httpStatus,
  };
}

export async function normalizeSourcePrompts(input: { promptBlocks: string[]; identity: string }): Promise<StoredImportCandidate[]> {
  const candidates: StoredImportCandidate[] = [];
  for (const sourcePromptText of input.promptBlocks.slice(0, MAX_CANDIDATES_PER_SOURCE)) {
    const improvement = await improvePromptWithFreeChatbot({
      prompt: sourcePromptText,
      target: "a downstream AI generation agent",
      tone: "clear, attributable, and implementation-ready",
      outputStrictness: "detailed",
      identity: `${input.identity}:${createHash("sha256").update(sourcePromptText).digest("hex").slice(0, 12)}`,
    });
    const modality = detectModality(sourcePromptText);
    const titleBasis = sourcePromptText.split(/[.!?\n]/)[0]?.replace(/^(prompt|instruction)\s*[:—-]\s*/i, "").trim() || "Imported prompt";
    candidates.push({
      sourcePromptText,
      title: titleBasis.slice(0, 180),
      description: improvement.intentSummary.slice(0, 2_000),
      structuredPrompt: improvement.improvedPrompt,
      modality,
      modelHints: modelHints(sourcePromptText, modality),
      variables: improvement.variables,
      constraints: improvement.constraints,
      outputFormat: improvement.outputFormat,
      acceptanceCriteria: improvement.acceptanceCriteria,
      confidence: improvement.isFallback ? 55 : 84,
      normalizationProvider: improvement.provider,
    });
  }
  return candidates;
}

export function sourceUrlHash(url: string) {
  return createHash("sha256").update(validPublicUrl(url).toString()).digest("hex");
}

export function sourceDomain(url: string) {
  return validPublicUrl(url).hostname.toLowerCase();
}
