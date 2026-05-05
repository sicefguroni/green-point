"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ListCheck, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/ui/general/layout/navbar";
import {
  CHATBOT_SYSTEM_PROMPT_STORAGE_KEY,
  DEFAULT_CHATBOT_SYSTEM_PROMPT,
  MAX_CHATBOT_SYSTEM_PROMPT_LENGTH,
  normalizeSystemPromptOverride,
} from "@/lib/ai/chat-prompt";

export default function ChatbotPromptSettingsPage() {
  const [prompt, setPrompt] = useState(DEFAULT_CHATBOT_SYSTEM_PROMPT);
  const [savedPrompt, setSavedPrompt] = useState(DEFAULT_CHATBOT_SYSTEM_PROMPT);
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false);

  useEffect(() => {
    try {
      const storedPrompt = normalizeSystemPromptOverride(
        window.localStorage.getItem(CHATBOT_SYSTEM_PROMPT_STORAGE_KEY),
      );

      if (storedPrompt) {
        setPrompt(storedPrompt);
        setSavedPrompt(storedPrompt);
        setHasCustomPrompt(true);
        return;
      }
    } catch {
      // Ignore storage errors and fall back to the default prompt.
    }

    setPrompt(DEFAULT_CHATBOT_SYSTEM_PROMPT);
    setSavedPrompt(DEFAULT_CHATBOT_SYSTEM_PROMPT);
    setHasCustomPrompt(false);
  }, []);

  const characterCount = prompt.length;
  const isDirty = useMemo(
    () => prompt !== savedPrompt,
    [prompt, savedPrompt],
  );

  const handleSave = () => {
    const normalized = normalizeSystemPromptOverride(prompt);

    try {
      if (!normalized || normalized === DEFAULT_CHATBOT_SYSTEM_PROMPT) {
        window.localStorage.removeItem(CHATBOT_SYSTEM_PROMPT_STORAGE_KEY);
        setPrompt(DEFAULT_CHATBOT_SYSTEM_PROMPT);
        setSavedPrompt(DEFAULT_CHATBOT_SYSTEM_PROMPT);
        setHasCustomPrompt(false);
        toast.success("Using the default chatbot prompt.");
        return;
      }

      window.localStorage.setItem(
        CHATBOT_SYSTEM_PROMPT_STORAGE_KEY,
        normalized,
      );
      setPrompt(normalized);
      setSavedPrompt(normalized);
      setHasCustomPrompt(true);
      toast.success("Chatbot system prompt saved.");
    } catch {
      toast.error("Could not save the chatbot prompt in this browser.");
    }
  };

  const handleReset = () => {
    try {
      window.localStorage.removeItem(CHATBOT_SYSTEM_PROMPT_STORAGE_KEY);
      setPrompt(DEFAULT_CHATBOT_SYSTEM_PROMPT);
      setSavedPrompt(DEFAULT_CHATBOT_SYSTEM_PROMPT);
      setHasCustomPrompt(false);
      toast.success("Chatbot prompt reset to default.");
    } catch {
      toast.error("Could not reset the chatbot prompt.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 transition-colors pl-0 sm:pl-16">
      <Navbar />

      <div className="pt-12 sm:pt-16 px-4 sm:px-6 md:px-8 lg:px-10 pb-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Settings
              </Link>
              <div className="mt-4 flex items-center gap-3">
                <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-lime-100 p-3 dark:from-emerald-900/40 dark:to-lime-800/30">
                  <ListCheck className="h-7 w-7 text-primary-green dark:text-lime-300" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-white">
                    Chatbot Instructions
                  </h1>
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base mt-1">
                    Adjust the assistant tone and instructions for this browser.
                  </p>
                </div>
              </div>
            </div>

            <span className="rounded-full bg-white/80 px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:ring-neutral-700">
              {hasCustomPrompt ? "Custom prompt active" : "Default prompt active"}
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
            <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                    Prompt Editor
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                    This override is attached to future chat requests from this browser only.
                  </p>
                </div>
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {characterCount}/{MAX_CHATBOT_SYSTEM_PROMPT_LENGTH}
                </span>
              </div>

              <textarea
                value={prompt}
                onChange={(event) =>
                  setPrompt(event.target.value.slice(0, MAX_CHATBOT_SYSTEM_PROMPT_LENGTH))
                }
                rows={16}
                spellCheck={false}
                className="min-h-[360px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-800 outline-none transition focus:border-primary-green focus:ring-2 focus:ring-primary-green/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />

              <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-700/40"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset to Default
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!isDirty}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-green px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  Save Prompt
                </button>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  How It Works
                </h2>
                <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                  GreenPoint still sends the selected recommendation, place details, and barangay metrics as structured context.
                  Your custom prompt changes how the assistant interprets and responds to that context.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">
                  Suggested Uses
                </h2>
                <p className="mt-3 text-sm leading-6 text-emerald-800 dark:text-emerald-300">
                  Ask for shorter answers, more implementation detail, policy-focused guidance, or a stricter planning format.
                  If you want the stock behavior again, reset the prompt to default.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}