'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { ArrowRight, Check, Eye, EyeOff, KeyRound, Loader2, Sparkles, Zap } from 'lucide-react'
import type { RightCard } from '@/lib/types'
import {
  type GenerateResult,
  type Provider,
  generateCards,
  strictToRightCard,
} from '@/lib/generate-card'
import { SwipeCard } from '@/components/swipe-card'

const SAMPLE = `NEW DELHI — A commuter has alleged that a traffic constable pulled the keys out of his scooter at a checkpoint near Connaught Place and demanded Rs 500 in cash to "settle" the matter without a challan. When the rider asked for a receipt, the officer refused and threatened to seize the vehicle. Legal experts point out that officers below Assistant Sub-Inspector rank cannot issue fines, that removing a vehicle's keys is not permitted, and that on-the-spot cash demands amount to bribery under the Prevention of Corruption Act.`

const INGEST_GRADIENT: [string, string] = ['#a3e635', '#4d7c0f']

const PROVIDERS: { id: Provider; label: string; hint: string }[] = [
  { id: 'fallback', label: 'Free fallback', hint: 'No key needed — uses the built-in gateway key.' },
  { id: 'gemini', label: 'Gemini', hint: 'Browser fetch to Google Generative Language API.' },
  { id: 'openai', label: 'OpenAI', hint: 'Browser fetch to api.openai.com chat completions.' },
]

const KEY_PLACEHOLDER: Record<Provider, string> = {
  fallback: 'No key required for the free fallback',
  gemini: 'AIza… (Google AI Studio key)',
  openai: 'sk-… (OpenAI secret key)',
}

export function AdminPanel({
  onAddCards,
  onPlay,
}: {
  onAddCards: (cards: RightCard[]) => void
  onPlay: () => void
}) {
  const [text, setText] = useState('')
  const [provider, setProvider] = useState<Provider>('fallback')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [added, setAdded] = useState(false)

  const previewCards = useMemo<RightCard[]>(
    () => (result ? result.cards.map(strictToRightCard) : []),
    [result],
  )

  async function run() {
    setLoading(true)
    setError(null)
    setResult(null)
    setAdded(false)
    try {
      const res = await generateCards(provider, text, apiKey)
      setResult(res)
    } catch (err) {
      setError((err as Error)?.message ?? 'Something went wrong generating the card.')
    } finally {
      setLoading(false)
    }
  }

  function addToStack() {
    if (previewCards.length === 0) return
    onAddCards(previewCards)
    setAdded(true)
    // Drop straight into the live deck so the new card is playable immediately.
    setTimeout(onPlay, 650)
  }

  return (
    <div className="mx-auto w-full max-w-5xl pb-10">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl border border-primary/40 bg-primary/10">
          <Sparkles className="size-5 text-primary" strokeWidth={2.5} />
        </span>
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wide text-foreground">AI Card Creator</h1>
          <p className="text-sm text-muted-foreground">
            Paste a news story. A live model turns it into a game-ready card and maps the exact law.
          </p>
        </div>
      </div>

      {/* PROVIDER + KEY */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Generative API</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PROVIDERS.map((p) => {
            const active = provider === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProvider(p.id)
                  setError(null)
                }}
                className="rounded-xl border px-4 py-2 text-sm font-semibold transition-colors"
                style={{
                  borderColor: active ? 'var(--primary)' : 'var(--border)',
                  backgroundColor: active ? 'color-mix(in oklab, var(--primary) 14%, transparent)' : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--muted-foreground)',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{PROVIDERS.find((p) => p.id === provider)?.hint}</p>

        <div className="mt-4">
          <label className="mb-1.5 flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">
            <KeyRound className="size-3.5" /> Your API key {provider !== 'fallback' && <span className="text-illegal">*</span>}
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 focus-within:border-primary/50">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={provider === 'fallback'}
              autoComplete="off"
              spellCheck={false}
              placeholder={KEY_PLACEHOLDER[provider]}
              className="min-w-0 flex-1 bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              disabled={provider === 'fallback'}
              className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
            >
              {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
            The key is used only for a direct browser request to the provider and never leaves this session.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* INPUT */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Raw news input</p>
            <button
              type="button"
              onClick={() => setText(SAMPLE)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Load sample
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a news article or type a real-life story about a citizen's rights being tested…"
            className="no-scrollbar mt-3 min-h-56 flex-1 resize-none rounded-xl border border-border bg-background p-4 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
          />
          <button
            type="button"
            onClick={run}
            disabled={loading || text.trim().length < 20}
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-display text-xl uppercase tracking-wide text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            {loading ? (
              <>
                <Loader2 className="size-5 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Zap className="size-5" strokeWidth={2.5} /> Generate card
              </>
            )}
          </button>
          {error && <p className="mt-3 text-sm text-illegal">{error}</p>}
        </div>

        {/* SANDBOX */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sandbox — live deck preview</p>
            {result && (
              <span className="rounded-full bg-legal/15 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-legal">
                {previewCards.length} card{previewCards.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div className="no-scrollbar mt-3 min-h-72 flex-1">
            {!result && !loading && (
              <div className="flex h-72 items-center justify-center text-center text-sm text-muted-foreground">
                Your generated card will render here exactly as it appears in the swipe deck.
              </div>
            )}
            {loading && (
              <div className="flex h-72 flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-primary" />
                <span className="text-sm">Model is drafting the card…</span>
              </div>
            )}
            {result && (
              <div className="no-scrollbar flex snap-x gap-5 overflow-x-auto pb-2">
                {previewCards.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="relative aspect-[3/4.15] w-[240px] shrink-0 snap-start"
                  >
                    <SwipeCard
                      card={c}
                      gradient={INGEST_GRADIENT}
                      packName="Fresh Ingest"
                      index={i}
                      total={previewCards.length}
                      answered={false}
                      userVerdict={null}
                      onCommit={() => {}}
                      onNext={() => {}}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {result && (
            <button
              type="button"
              onClick={addToStack}
              disabled={added}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-legal py-3.5 font-display text-lg uppercase tracking-wide text-legal-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {added ? (
                <>
                  <Check className="size-5" strokeWidth={3} /> Added — play it now <ArrowRight className="size-5" />
                </>
              ) : (
                <>
                  Add to Game Stack <ArrowRight className="size-5" />
                </>
              )}
            </button>
          )}
          {added && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Cards appended live to the Fresh Ingest deck. Loading the game…
            </p>
          )}
        </div>
      </div>

      {/* STRICT JSON */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Strict JSON response</p>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-primary">
                {result.providerLabel}
              </span>
              <span className="text-[0.7rem] text-muted-foreground">{result.latencyMs} ms</span>
            </div>
            {result.note && <p className="mt-2 text-xs text-muted-foreground">{result.note}</p>}
            <pre className="no-scrollbar mt-3 max-h-72 overflow-auto rounded-xl border border-border bg-background p-3 text-[0.7rem] leading-relaxed text-muted-foreground">
              {JSON.stringify({ cards: result.cards }, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  function onAddCards_unused() {
    void onPlay
  }
}
