"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { SendHorizonal, Bot, User, Loader2, Sparkles, Orbit, BookOpen } from "lucide-react";
import { type BarangayData } from "@/context/BarangayContext";
import {
  type AssistantChatRequest,
  type AssistantChatResponse,
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
  mode?: "grounded" | "general";
  sources?: { studyTitle: string }[];
}

interface ChatTabProps {
  recommendation: UIRecommendation;
  selectedFeature: SelectedFeature;
  selectedBarangayData?: BarangayData | null;
  onHistoryChange?: (history: ChatHistoryMessage[]) => void;
}

/**
 * POST to /api/chat — swap this function body for any AI provider.
 * Expected response body: { reply: string }
 */
async function fetchAIReply(
  payload: AssistantChatRequest,
): Promise<AssistantChatResponse> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as AssistantChatResponse;
  } catch {
    return {
      reply:
        "I'm having trouble connecting right now. Please try again in a moment.",
      mode: "general",
      sources: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatTab({
  recommendation,
  selectedFeature,
  selectedBarangayData,
  onHistoryChange,
}: ChatTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi! I'm your GreenPoint assistant. I can guide you using local metrics and retrieved research for **${recommendation.solutionTitle}**, and I can also handle normal conversation if you want to ask more broadly.`,
      timestamp: new Date(),
      mode: "grounded",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const dispatchMessage = useCallback(async (text: string) => {
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const history = messages
      .filter((m) => m.id !== "welcome")
      .map(({ role, content }) => ({ role, content }));
    history.push({ role: "user", content: text });

    const reply = await fetchAIReply({
      messages: history,
      recommendation: {
        solutionTitle: recommendation.solutionTitle,
        solutionDescription: recommendation.solutionDescription,
        interventionType: recommendation.interventionType,
        efficiencyLevel: recommendation.efficiencyLevel,
        equityIndex: recommendation.equityIndex,
        cost: recommendation.cost,
        impact: recommendation.impact,
        rationale: recommendation.rationale,
        sourceStudy: recommendation.sourceStudy,
      },
      selectedFeature: {
        name: selectedFeature.name,
        address: selectedFeature.address,
        barangay: selectedFeature.barangay,
        hazards: selectedFeature.hazards,
      },
      selectedBarangayData,
    });

    setMessages((prev) => [
      ...prev,
      {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: reply.reply,
        timestamp: new Date(),
        mode: reply.mode,
        sources: reply.sources,
      },
    ]);
    setIsLoading(false);
  }, [isLoading, messages, recommendation, selectedBarangayData, selectedFeature]);

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
    if (!text) return;
    setInput("");
    await dispatchMessage(text);
  }, [input, dispatchMessage]);

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
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
          <div className="flex items-center gap-2 font-semibold text-neutral-800">
            <Orbit size={14} className="text-primary-green" />
            Assistant mode
          </div>
          <p className="mt-1 leading-relaxed">
            Research-grounded for site and intervention guidance, conversational for broader questions.
          </p>
        </div>

        {messages.map((msg) =>
          msg.id === "welcome" ? (
            <WelcomeBubble
              key={msg.id}
              msg={msg}
              recommendation={recommendation}
              onSuggest={dispatchMessage}
              disabled={isLoading}
            />
          ) : (
            <MessageBubble key={msg.id} msg={msg} />
          )
        )}

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

// Inline segment: plain text or bold span
type Segment = { bold: false; text: string } | { bold: true; text: string };

// Parse a single line's inline bold markers
function parseInline(line: string): Segment[] {
  const segments: Segment[] = [];
  const re = /\*\*(.*?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) segments.push({ bold: false, text: line.slice(last, m.index) });
    segments.push({ bold: true, text: m[1] });
    last = re.lastIndex;
  }
  if (last < line.length) segments.push({ bold: false, text: line.slice(last) });
  return segments;
}

function renderInline(line: string, key: number) {
  const segs = parseInline(line);
  return (
    <span key={key}>
      {segs.map((s, i) =>
        s.bold ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>
      )}
    </span>
  );
}

function MarkdownContent({ text, isUser }: { text: string; isUser: boolean }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Numbered list item: "1. ..."
    const listMatch = /^(\d+)\.\s+(.*)/.exec(line);
    if (listMatch) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length) {
        // Skip blank lines between items if the next non-blank line is still a list item
        if (lines[i].trim() === "") {
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === "") j++;
          if (j < lines.length && /^\d+\.\s+/.test(lines[j])) { i++; continue; }
          break;
        }
        const item = /^\d+\.\s+(.*)/.exec(lines[i]);
        if (!item) break;
        listItems.push(
          <li key={i} className="mb-1">
            {renderInline(item[1], i)}
          </li>
        );
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className={`list-decimal pl-5 space-y-0.5 my-2 ${isUser ? "text-white" : ""}`}>
          {listItems}
        </ol>
      );
      continue;
    }

    // Bullet list item: "- ..." or "* ..."
    const bulletMatch = /^[-*]\s+(.*)/.exec(line);
    if (bulletMatch) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length) {
        // Skip blank lines between items if the next non-blank line is still a bullet
        if (lines[i].trim() === "") {
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === "") j++;
          if (j < lines.length && /^[-*]\s+/.test(lines[j])) { i++; continue; }
          break;
        }
        const item = /^[-*]\s+(.*)/.exec(lines[i]);
        if (!item) break;
        listItems.push(
          <li key={i} className="mb-1">
            {renderInline(item[1], i)}
          </li>
        );
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className={`list-disc pl-5 space-y-0.5 my-2 ${isUser ? "text-white" : ""}`}>
          {listItems}
        </ul>
      );
      continue;
    }

    // Blank line — small spacer
    if (line.trim() === "") {
      nodes.push(<div key={`br-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // Normal paragraph line
    nodes.push(<p key={`p-${i}`} className="leading-relaxed">{renderInline(line, i)}</p>);
    i++;
  }

  return <>{nodes}</>;
}

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
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
          isAssistant
            ? "bg-neutral-50 border border-neutral-100 text-neutral-800 rounded-tl-sm"
            : "bg-primary-green text-white rounded-tr-sm"
        }`}
      >
        <MarkdownContent text={msg.content} isUser={!isAssistant} />

        {isAssistant && (msg.mode || msg.sources?.length) ? (
          <div className="mt-3 space-y-2 border-t border-neutral-200 pt-3 text-[11px] text-neutral-500">
            {msg.mode ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-semibold text-neutral-600 ring-1 ring-neutral-200">
                {msg.mode === "grounded" ? <BookOpen size={12} /> : <Sparkles size={12} />}
                {msg.mode === "grounded" ? "Grounded answer" : "General answer"}
              </div>
            ) : null}
            {msg.sources && msg.sources.length > 0 ? (
              <div>
                <div className="mb-1 font-semibold text-neutral-600">Sources used</div>
                <div className="flex flex-wrap gap-1.5">
                  {msg.sources.slice(0, 3).map((source) => (
                    <span
                      key={source.studyTitle}
                      className="rounded-full bg-primary-green/8 px-2.5 py-1 text-[10px] font-semibold text-primary-green"
                    >
                      {source.studyTitle}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Welcome bubble helpers
// ---------------------------------------------------------------------------

function parseBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

const QUICK_SUGGESTIONS = [
  "What's the expected impact?",
  "How should we phase implementation?",
  "What are the key cost considerations?",
];

function WelcomeBubble({
  msg,
  recommendation,
  onSuggest,
  disabled,
}: {
  msg: ChatMessage;
  recommendation: UIRecommendation;
  onSuggest: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-primary-green text-white ring-2 ring-primary-green/20 shadow-sm">
        <Sparkles size={15} />
      </div>

      <div className="flex-1 min-w-0 rounded-2xl rounded-tl-sm overflow-hidden border border-primary-green/25 shadow-sm">
        {/* Tinted header */}
        <div className="bg-gradient-to-r from-primary-green/10 to-green-50 px-4 py-2 flex items-center gap-2 border-b border-primary-green/10">
          <Orbit size={12} className="text-primary-green shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest text-primary-green">
            GreenPoint AI · {recommendation.solutionTitle}
          </span>
        </div>

        {/* Message body */}
        <div className="bg-white px-4 py-3">
          <p className="text-sm leading-relaxed text-neutral-800">
            {parseBold(msg.content)}
          </p>

          {/* Quick suggestion chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {QUICK_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onSuggest(s)}
                disabled={disabled}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-primary-green/30 text-primary-green bg-primary-green/5 hover:bg-primary-green/10 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Footer badge */}
        <div className="bg-neutral-50 px-4 py-2 border-t border-neutral-100">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-semibold text-[11px] text-neutral-600 ring-1 ring-neutral-200">
            <BookOpen size={11} />
            Grounded answer
          </div>
        </div>
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
