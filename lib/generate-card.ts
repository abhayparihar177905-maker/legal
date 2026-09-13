import type { RightCard } from './types'

export type Provider = 'fallback' | 'gemini' | 'openai'

/** The exact strict shape the model is asked to return, one entry per card. */
export interface StrictCard {
  /** 1-sentence situation/question. */
  scenario_title: string
  /** true = the described action is legal/compliant, false = illegal. */
  is_legal: boolean
  /** Draft of the precise legal provision. */
  law_cited: string
  /** Simple 2-line explanation. */
  explanation: string
}

export interface GenerateResult {
  provider: Provider
  /** Human label for the provider actually used. */
  providerLabel: string
  cards: StrictCard[]
  /** Raw JSON text the model returned, shown in the sandbox for transparency. */
  raw: string
  latencyMs: number
  note?: string
}

const SYSTEM = `You are the "Swipe Rights" card creator for an Indian legal-literacy game.
Turn a messy news story or real-life situation about everyday Indian citizen rights into swipe cards.
Each card is a yes/no judgement: is the described action LEGAL (compliant) or ILLEGAL?
Base every verdict and citation on Indian law (Constitution, CrPC/BNSS, Motor Vehicles Act,
Consumer Protection Act, Model Tenancy Act, Legal Metrology Act, Prevention of Corruption Act, etc.).
Be accurate, punchy and citizen-friendly.`

const FORMAT_INSTRUCTION = `Return STRICT, minified JSON only — no markdown, no commentary — of exactly this shape:
{"cards":[{"scenario_title":"1-sentence situation/question","is_legal":false,"law_cited":"Draft of the precise legal provision","explanation":"Simple 2-line explanation"}]}
Produce between 1 and 4 cards. "is_legal" MUST be a boolean.`

function buildPrompt(text: string) {
  return `${FORMAT_INSTRUCTION}\n\nSource story:\n"""${text.trim()}"""`
}

/** Pull the first valid JSON object out of a model response (handles code fences / stray prose). */
function extractJson(raw: string): { cards: StrictCard[] } {
  let s = raw.trim()
  // strip ```json ... ``` fences if present
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  // narrow to the outermost object
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first !== -1 && last !== -1) s = s.slice(first, last + 1)

  const parsed = JSON.parse(s)
  const rawCards = Array.isArray(parsed) ? parsed : parsed.cards ?? [parsed]
  const cards: StrictCard[] = rawCards
    .map((c: Record<string, unknown>) => ({
      scenario_title: String(c.scenario_title ?? c.scenario ?? '').trim(),
      is_legal: typeof c.is_legal === 'boolean' ? c.is_legal : String(c.is_legal).toLowerCase() === 'true',
      law_cited: String(c.law_cited ?? c.law ?? '').trim(),
      explanation: String(c.explanation ?? c.rule ?? '').trim(),
    }))
    .filter((c: StrictCard) => c.scenario_title.length > 0)

  if (cards.length === 0) throw new Error('No cards found in the model response.')
  return { cards }
}

async function callGemini(text: string, apiKey: string): Promise<{ cards: StrictCard[]; raw: string }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: buildPrompt(text) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
    },
  )
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Gemini request failed (${res.status}).`)
  }
  const raw: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  return { cards: extractJson(raw).cards, raw }
}

async function callOpenAI(text: string, apiKey: string): Promise<{ cards: StrictCard[]; raw: string }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildPrompt(text) },
      ],
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `OpenAI request failed (${res.status}).`)
  }
  const raw: string = data?.choices?.[0]?.message?.content ?? ''
  return { cards: extractJson(raw).cards, raw }
}

/** Free fallback: hit the project's own server route (AI Gateway, zero config) and map to the strict shape. */
async function callFallback(text: string): Promise<{ cards: StrictCard[]; raw: string; note?: string }> {
  const res = await fetch('/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error ?? 'Fallback request failed.')

  const cards: StrictCard[] = (data.response?.cards ?? []).map(
    (c: { scenario: string; verdict: string; law: string; rule: string }) => ({
      scenario_title: c.scenario,
      is_legal: c.verdict === 'legal',
      law_cited: c.law,
      explanation: c.rule,
    }),
  )
  return {
    cards,
    raw: JSON.stringify({ cards }, null, 2),
    note:
      data.mode === 'live'
        ? 'Generated with the built-in free key (Vercel AI Gateway) — no API key required.'
        : 'Live model unavailable; showing a deterministic simulated parse so the flow still demos end-to-end.',
  }
}

export async function generateCards(
  provider: Provider,
  text: string,
  apiKey: string,
): Promise<GenerateResult> {
  const startedAt = Date.now()

  if (provider !== 'fallback' && !apiKey.trim()) {
    throw new Error('Enter your API key above, or switch to the free fallback key.')
  }

  let out: { cards: StrictCard[]; raw: string; note?: string }
  let providerLabel: string

  if (provider === 'gemini') {
    out = await callGemini(text, apiKey.trim())
    providerLabel = 'Google Gemini (gemini-2.0-flash)'
  } else if (provider === 'openai') {
    out = await callOpenAI(text, apiKey.trim())
    providerLabel = 'OpenAI (gpt-4o-mini)'
  } else {
    out = await callFallback(text)
    providerLabel = 'Free fallback (Vercel AI Gateway)'
  }

  return {
    provider,
    providerLabel,
    cards: out.cards,
    raw: out.raw,
    note: out.note,
    latencyMs: Date.now() - startedAt,
  }
}

/** Map a strict card into the game's RightCard shape. */
export function strictToRightCard(c: StrictCard, i: number): RightCard {
  return {
    id: `ingested-${Date.now()}-${i}`,
    scenario: c.scenario_title,
    verdict: c.is_legal ? 'legal' : 'illegal',
    law: c.law_cited,
    rule: c.explanation,
    generated: true,
  }
}
