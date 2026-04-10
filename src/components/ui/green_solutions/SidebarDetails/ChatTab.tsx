"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react";
import { SendHorizonal, Bot, User, Loader2, Sparkles } from "lucide-react";
import { type BarangayData } from "@/context/BarangayContext";
import { type ChatHistoryMessage } from "@/types/green_solutions";
import {
  type ChatRequestPayload,
  type ChatResponsePayload,
} from "@/types/chat";
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
  selectedBarangayData: BarangayData | null;
  messages?: ChatHistoryMessage[];
  onMessagesChange?: Dispatch<SetStateAction<ChatHistoryMessage[]>>;
  inputValue?: string;
  onInputChange?: Dispatch<SetStateAction<string>>;
  isLoading?: boolean;
  onLoadingChange?: Dispatch<SetStateAction<boolean>>;
  onHistoryChange?: (history: ChatHistoryMessage[]) => void;
}

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

function buildChatPayload(
  messages: { role: "user" | "assistant"; content: string }[],
  recommendation: UIRecommendation,
  selectedFeature: SelectedFeature,
  selectedBarangayData: BarangayData | null,
): ChatRequestPayload {
  return {
    messages,
    recommendation: {
      id: recommendation.id,
      recommendationId: recommendation.recommendationID,
      title: recommendation.solutionTitle,
      description: recommendation.solutionDescription,
      interventionType: recommendation.interventionType,
      efficiencyLevel: recommendation.efficiencyLevel,
      efficiencyScore: recommendation.value,
      equityIndex: recommendation.equityIndex,
      costIndex: recommendation.cost,
      impactScore: recommendation.impact,
      estimatedCost:
        recommendation.costEstimate?.totalEstimate ?? recommendation.cost ?? null,
      costUnit:
        recommendation.costEstimate?.currencyUnit ?? recommendation.costUnit ?? null,
    },
    selectedFeature: {
      name: selectedFeature.name,
      address: selectedFeature.address,
      barangay: selectedFeature.barangay,
      coords: selectedFeature.coords,
      hazardSummary: {
        floodLevels:
          selectedFeature.hazards?.flood
            ?.map((item) => item.level)
            .filter((level): level is number => level !== null) ?? [],
        stormLevels:
          selectedFeature.hazards?.storm
            ?.map((item) => item.level)
            .filter((level): level is number => level !== null) ?? [],
        airQualityCount: selectedFeature.hazards?.air?.length ?? 0,
      },
    },
    selectedBarangayData: selectedBarangayData
      ? {
          name: selectedBarangayData.name,
          greeneryIndex: selectedBarangayData.greeneryIndex,
          ndvi: selectedBarangayData.ndvi,
          lst: selectedBarangayData.lst,
          treeCanopy: selectedBarangayData.treeCanopy,
          floodExposure: selectedBarangayData.floodExposure,
          currentIntervention: selectedBarangayData.currentIntervention,
        }
      : null,
  };
}

/**
 * POST to /api/chat.
 */
async function fetchAIReply(
  payload: ChatRequestPayload,
): Promise<string> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as Partial<ChatResponsePayload>;
    if (typeof data.reply === "string" && data.reply.trim().length > 0) {
      return data.reply;
    }

    if (typeof data.error === "string" && data.error.trim().length > 0) {
      throw new Error(data.error);
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    throw new Error("Empty chat response");
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
  selectedBarangayData,
  messages: controlledMessages,
  onMessagesChange,
  inputValue: controlledInputValue,
  onInputChange,
  isLoading: controlledIsLoading,
  onLoadingChange,
  onHistoryChange,
}: ChatTabProps) {
  const [localMessages, setLocalMessages] = useState<ChatHistoryMessage[]>([]);
  const [localInputValue, setLocalInputValue] = useState("");
  const [localIsLoading, setLocalIsLoading] = useState(false);

  const messages = controlledMessages ?? localMessages;
  const setMessages = onMessagesChange ?? setLocalMessages;
  const input = controlledInputValue ?? localInputValue;
  const setInput = onInputChange ?? setLocalInputValue;
  const isLoading = controlledIsLoading ?? localIsLoading;
  const setIsLoading = onLoadingChange ?? setLocalIsLoading;

  const displayMessages = useMemo<ChatMessage[]>(() => {
    const welcomeMessage: ChatMessage = {
      id: "welcome",
      role: "assistant",
      content: `Hi! I'm your GreenPoint assistant. Ask me anything about implementing **${recommendation.solutionTitle}** in Barangay ${selectedFeature.barangay || selectedFeature.name}.`,
      timestamp: new Date(),
    };

    const historyMessages = messages.map((message, index) => ({
      id: `${message.role}-${message.timestamp ?? index}-${index}`,
      role: message.role,
      content: message.content,
      timestamp: new Date(message.timestamp ?? Date.now()),
    }));

    return [welcomeMessage, ...historyMessages];
  }, [messages, recommendation.solutionTitle, selectedFeature.barangay, selectedFeature.name]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, isLoading]);

  // Lift chat history to parent so other tabs can use AI conversation context.
  useEffect(() => {
    if (!onHistoryChange) return;
    onHistoryChange(messages);
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

    const userMsg: ChatHistoryMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Build history (exclude the static welcome message)
    const history = messages
      .map(({ role, content }) => ({ role, content }));
    history.push({ role: "user", content: text });

    const reply = await fetchAIReply(
      buildChatPayload(
        history,
        recommendation,
        selectedFeature,
        selectedBarangayData,
      ),
    );

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: reply,
        timestamp: new Date().toISOString(),
      },
    ]);
    setIsLoading(false);
  }, [
    input,
    isLoading,
    messages,
    recommendation,
    selectedBarangayData,
    selectedFeature,
    setInput,
    setIsLoading,
    setMessages,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[radial-gradient(circle_at_top,_rgba(52,168,83,0.08),_transparent_32%),linear-gradient(to_bottom,_rgba(255,255,255,0.96),_rgba(248,250,248,0.98))]">
      {/* ── Scrollable message thread ── */}
      <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 sm:px-6 lg:px-8">
          {displayMessages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {isLoading && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Fixed input area ── */}
      <div className="shrink-0 border-t border-neutral-100/80 bg-white/85 py-3 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 shadow-[0_12px_30px_-24px_rgba(0,0,0,0.45)] transition-all focus-within:border-primary-green/50 focus-within:ring-2 focus-within:ring-primary-green/10">
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
              className="shrink-0 rounded-xl bg-primary-green p-2 text-white transition-all hover:bg-green-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Send message"
            >
              <SendHorizonal size={16} />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-neutral-300">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
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
          isAssistant
            ? "bg-primary-green text-white"
            : "bg-neutral-900 text-white"
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
