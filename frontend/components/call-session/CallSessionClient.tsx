'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import type { ClientDocument } from '@/lib/types';

interface CallSuggestion { key: string; label: string; description: string; linkPath: string }

// Minimal shape of the browser's Web Speech API — not in lib.dom.d.ts by
// default, and vendor-prefixed on Chrome/Edge (the only browsers that
// reliably support it). Free, live, no API key: the browser itself does
// the speech-to-text, which is why this feature works with zero
// per-minute transcription cost — the trade-off is Chrome/Edge only.
interface SpeechRecognitionResultLike { isFinal: boolean; 0: { transcript: string } }
interface SpeechRecognitionEventLike { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string;
  start: () => void; stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function CallSessionClient({ householdId }: { householdId: string }) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [suggestions, setSuggestions] = useState<CallSuggestion[]>([]);
  const [micError, setMicError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [result, setResult] = useState<ClientDocument | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef('');
  const shownKeysRef = useRef<Set<string>>(new Set());
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSupported(!!getSpeechRecognition());
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [finalTranscript, interimText]);

  async function checkSuggestions(transcript: string) {
    try {
      const found = await api.post<CallSuggestion[]>(`households/${householdId}/call-session/suggestions`, {
        transcript, alreadyShown: Array.from(shownKeysRef.current),
      });
      if (found.length) {
        found.forEach((s) => shownKeysRef.current.add(s.key));
        setSuggestions((prev) => [...prev, ...found]);
      }
    } catch {
      // Live suggestions are a nice-to-have during the call — a failed
      // check here should never interrupt the call itself.
    }
  }

  function start() {
    const RecognitionCtor = getSpeechRecognition();
    if (!RecognitionCtor) { setSupported(false); return; }

    setMicError(null);
    setResult(null);
    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';

    recognition.onresult = (event) => {
      let interim = '';
      let addedFinal = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const speechResult = event.results[i];
        if (speechResult.isFinal) addedFinal += `${speechResult[0].transcript.trim()}. `;
        else interim += speechResult[0].transcript;
      }
      if (addedFinal) {
        transcriptRef.current += addedFinal;
        setFinalTranscript(transcriptRef.current);
        checkSuggestions(transcriptRef.current);
      }
      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone access was denied — allow it in your browser\'s address-bar permissions and try again.',
        'no-speech': 'No speech detected — check the right microphone is selected.',
        network: 'Speech recognition needs an internet connection.',
      };
      setMicError(messages[event.error] ?? `Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      // Chrome auto-stops continuous recognition periodically — restart
      // seamlessly while the call is still marked as recording.
      if (recognitionRef.current === recognition && recording) {
        try { recognition.start(); } catch { /* already starting */ }
      }
    };

    recognitionRef.current = recognition;
    transcriptRef.current = '';
    shownKeysRef.current = new Set();
    setFinalTranscript('');
    setInterimText('');
    setSuggestions([]);
    setRecording(true);
    recognition.start();
  }

  function stop() {
    setRecording(false);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }

  async function finishCall() {
    if (recording) stop();
    setFinishing(true);
    setFinishError(null);
    try {
      const saved = await api.post<ClientDocument>(`households/${householdId}/call-session/finish`, { transcript: transcriptRef.current });
      setResult(saved);
    } catch (err) {
      setFinishError(err instanceof Error ? err.message : 'Could not process this call.');
    } finally {
      setFinishing(false);
    }
  }

  if (!supported) {
    return (
      <Card>
        <p className="text-sm text-rust-400">
          Live transcription needs Chrome or Edge (it uses the browser&apos;s built-in speech recognition — free,
          no API key, but not supported in this browser). Open this page in Chrome or Edge to start a call.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_320px] gap-6">
      <div className="space-y-4">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-ink-300">Live transcript</p>
            {!recording ? (
              <Button onClick={start} className="px-4 py-2 text-xs">Start Client Call</Button>
            ) : (
              <div className="flex items-center gap-2">
                <Badge tone="breach">● Recording</Badge>
                <Button variant="ghost" onClick={stop} className="px-3 py-1 text-xs">Pause</Button>
              </div>
            )}
          </div>
          {micError && <p className="mb-2 text-xs text-rust-400">{micError}</p>}
          <div className="h-80 overflow-y-auto rounded-sm border border-hairline bg-ink-950 p-3 text-sm leading-relaxed text-ink-100">
            {finalTranscript || interimText ? (
              <>
                <span>{finalTranscript}</span>
                <span className="text-ink-500">{interimText}</span>
              </>
            ) : (
              <span className="text-ink-500">Transcript will appear here once the call starts — speak naturally.</span>
            )}
            <div ref={transcriptEndRef} />
          </div>
          <p className="mt-2 text-xs text-ink-500">
            This captures a live TEXT transcript via your browser&apos;s speech recognition — no audio file is
            recorded or stored, which keeps this free and avoids storing an actual voice recording of the client.
          </p>
        </Card>

        {(finalTranscript || result) && (
          <Card>
            <Button onClick={finishCall} disabled={finishing || (!finalTranscript && !recording)} className="w-full px-4 py-2 text-xs">
              {finishing ? 'Updating Fact Find…' : 'End Call & Update Fact Find'}
            </Button>
            {finishError && <p className="mt-2 text-xs text-rust-400">{finishError}</p>}
            {result && (
              <div className="mt-4 space-y-2 border-t border-hairline pt-4">
                <div className="flex items-center gap-2">
                  <Badge tone={result.extractionStatus === 'done' ? 'positive' : 'warning'}>{result.extractionStatus}</Badge>
                  <span className="text-xs text-ink-300">Transcript saved and processed</span>
                </div>
                {result.appliedSummary && <p className="text-sm text-ink-100">{result.appliedSummary}</p>}
                {result.extractionError && <p className="text-sm text-rust-400">{result.extractionError}</p>}
              </div>
            )}
          </Card>
        )}
      </div>

      <Card>
        <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Live suggestions</p>
        {suggestions.length === 0 ? (
          <p className="text-sm text-ink-400">Suggestions appear here as topics come up in the conversation.</p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <a key={i} href={s.linkPath} target="_blank" rel="noreferrer"
                className="block rounded-sm border border-brass-500/40 bg-brass-500/10 p-3 hover:border-brass-500">
                <p className="text-sm font-medium text-brass-400">{s.label}</p>
                <p className="mt-1 text-xs text-ink-300">{s.description}</p>
              </a>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
