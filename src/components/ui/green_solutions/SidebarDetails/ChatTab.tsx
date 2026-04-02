"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { SendHorizonal, Bot, User, Loader2, Sparkles } from "lucide-react";
import {
  type GreenRecommendation,
  type ChatHistoryMessage,
} from "@/types/green_solutions";
import { type UIRecommendation } from "@/lib/recommendations";
import { type SelectedFeature } from "@/types/metrics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatTabProps {
  recommendation: UIRecommendation;
  selectedFeature: SelectedFeature;
  onHistoryChange?: (history: ChatHistoryMessage[]) => void;
}

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

function buildSystemContext(
  rec: UIRecommendation,
  feature: SelectedFeature,
): string {
  return (
    `You are GreenPoint AI, an expert urban greening advisor for Mandaue City, Philippines. ` +
    `The user is asking about the "${rec.solutionTitle}" intervention for a location in ` +
    `Barangay ${feature.barangay || "unknown"} (${feature.address}). ` +
    `Intervention summary: ${rec.solutionDescription} ` +
    `Efficiency: ${rec.efficiencyLevel}. ` +
    `Equity Index: ${rec.equityIndex.toFixed(2)}. ` +
    `Cost Index: ${rec.cost.toFixed(2)}. ` +
    `Impact Score: ${rec.impact.toFixed(2)}. ` +
    `Answer concisely and practically. Focus on implementation, environmental co-benefits, and community impact.`
  );
}

/**
 * POST to /api/chat — swap this function body for any AI provider.
 * Expected response body: { reply: string }
 */
async function fetchAIReply(
  messages: { role: "user" | "assistant"; content: string }[],
  systemContext: string,
): Promise<string> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, systemContext }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { reply: string };
    return data.reply;
  } catch {
    return "I'm having trouble connecting right now. Please try again in a moment.";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatTab({
  recommendation,
  selectedFeature,
  onHistoryChange,
}: ChatTabProps) {
  const systemContext = buildSystemContext(recommendation, selectedFeature);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi! I'm your GreenPoint assistant. Ask me anything about implementing **${recommendation.solutionTitle}** in Barangay ${selectedFeature.barangay || selectedFeature.name}.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Lift chat history to parent so other tabs can use AI conversation context.
  useEffect(() => {
    if (!onHistoryChange) return;
    const timelineHistory: ChatHistoryMessage[] = messages
      .filter((message) => message.id !== "welcome")
      .map((message) => ({
        role: message.role,
        content: message.content,
        timestamp: message.timestamp.toISOString(),
      }));

    onHistoryChange(timelineHistory);
  }, [messages, onHistoryChange]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Build history (exclude the static welcome message)
    const history = messages
      .filter((m) => m.id !== "welcome")
      .map(({ role, content }) => ({ role, content }));
    history.push({ role: "user", content: text });

    const reply = await fetchAIReply(history, systemContext);

    setMessages((prev) => [
      ...prev,
      {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      },
    ]);
    setIsLoading(false);
  }, [input, isLoading, messages, systemContext]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className=" flex flex-col h-full">
      {/* ── Scrollable message thread ── */}
      <div className="flex-1 overflow-y-auto sm:px-2 lg:px-6 py-4 space-y-4 scrollbar-hide">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isLoading && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Fixed input area ── */}
      <div className="shrink-0 sm:px-2 lg:px-6 py-3 border-t border-neutral-100 bg-white/80 backdrop-blur-sm">
        <div className="flex items-end gap-3 bg-neutral-50 rounded-2xl border border-neutral-200 px-4 py-2.5 focus-within:border-primary-green/50 focus-within:ring-2 focus-within:ring-primary-green/10 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask about ${recommendation.solutionTitle}…`}
            className="flex-1 bg-transparent resize-none text-sm text-neutral-800 placeholder:text-neutral-400 outline-none leading-relaxed scrollbar-hide"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="shrink-0 p-2 rounded-xl bg-primary-green text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-green-700 active:scale-95 transition-all"
            aria-label="Send message"
          >
            <SendHorizonal size={16} />
          </button>
        </div>
        <p className="text-[10px] text-neutral-300 text-center mt-1.5">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isAssistant = msg.role === "assistant";
  return (
    <div
      className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
        isAssistant ? "flex-row" : "flex-row-reverse"
      }`}
    >
      <div
        className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
          isAssistant ? "bg-primary-green text-white" : "bg-neutral-900 text-white"
        }`}
      >
        {isAssistant ? <Sparkles size={15} /> : <User size={15} />}
      </div>

      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isAssistant
            ? "bg-neutral-50 border border-neutral-100 text-neutral-800 rounded-tl-sm"
            : "bg-primary-green text-white rounded-tr-sm"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-in fade-in duration-300">
      <div className="w-8 h-8 shrink-0 rounded-full bg-primary-green text-white flex items-center justify-center">
        <Bot size={15} />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-neutral-50 border border-neutral-100 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin text-neutral-400" />
        <span className="text-xs text-neutral-400">Thinking…</span>
      </div>
    </div>
  );
}
