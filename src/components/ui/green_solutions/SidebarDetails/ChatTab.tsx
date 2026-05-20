"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type ComponentPropsWithoutRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { SendHorizonal, Bot, User, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type BarangayData } from "@/context/BarangayContext";
import {
  CHATBOT_SYSTEM_PROMPT_STORAGE_KEY,
  normalizeSystemPromptOverride,
} from "@/lib/ai/chat-prompt";
import { type ChatHistoryMessage } from "@/types/green_solutions";
import {
  type ChatRequestPayload,
  type ChatResponsePayload,
} from "@/types/chat";
import { type UIRecommendation } from "@/lib/recommendations";
import { type SelectedFeature } from "@/types/metrics";

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
  isFullscreen?: boolean;
}

type ParagraphProps = ComponentPropsWithoutRef<"p">;
type StrongProps = ComponentPropsWithoutRef<"strong">;
type EmphasisProps = ComponentPropsWithoutRef<"em">;
type ListProps = ComponentPropsWithoutRef<"ul">;
type OrderedListProps = ComponentPropsWithoutRef<"ol">;
type ListItemProps = ComponentPropsWithoutRef<"li">;
type AnchorProps = ComponentPropsWithoutRef<"a">;
type CodeProps = ComponentPropsWithoutRef<"code">;
type PreformattedProps = ComponentPropsWithoutRef<"pre">;
type BlockquoteProps = ComponentPropsWithoutRef<"blockquote">;

function normalizeChatMarkdown(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/^\s*([-*])\s+$/gm, "")
    .replace(/\*\*\s*\*\*/g, "")
    .replace(/(^|\s)([*_]{1,3})(\s+)(?=[.,!?;:]?(\s|$))/g, "$1");
}

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

function buildChatPayload(
  messages: { role: "user" | "assistant"; content: string }[],
  recommendation: UIRecommendation,
  selectedFeature: SelectedFeature,
  selectedBarangayData: BarangayData | null,
  systemPromptOverride?: string | null,
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
      customSelectionAreaHectares: selectedFeature.customSelectionAreaHectares,
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
    systemPromptOverride: systemPromptOverride ?? null,
  };
}

function getStoredSystemPromptOverride() {
  try {
    return normalizeSystemPromptOverride(
      window.localStorage.getItem(CHATBOT_SYSTEM_PROMPT_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

function getMaxHazardLevel(levels: { level: number | null }[] | undefined) {
  const values =
    levels
      ?.map((item) => item.level)
      .filter((level): level is number => level !== null) ?? [];

  return values.length ? Math.max(...values) : null;
}

function buildSuggestionPrompts(
  recommendation: UIRecommendation,
  selectedFeature: SelectedFeature,
  selectedBarangayData: BarangayData | null,
  messages: ChatHistoryMessage[],
) {
  const prompts: string[] = [];
  const locationLabel =
    selectedFeature.barangay || selectedBarangayData?.name || selectedFeature.name;
  const siteLabel = selectedFeature.name || locationLabel;
  const floodLevel = getMaxHazardLevel(selectedFeature.hazards?.flood);
  const stormLevel = getMaxHazardLevel(selectedFeature.hazards?.storm);
  const hasAirQualityData = (selectedFeature.hazards?.air?.length ?? 0) > 0;
  const lastUserMessage =
    [...messages]
      .reverse()
      .find((message) => message.role === "user")
      ?.content.toLowerCase() ?? "";

  const addPrompt = (prompt: string) => {
    if (!prompts.includes(prompt)) {
      prompts.push(prompt);
    }
  };

  if (/cost|budget|fund|expense|price/.test(lastUserMessage)) {
    addPrompt(
      `What is a low-budget rollout plan for ${recommendation.solutionTitle} in ${locationLabel}?`,
    );
    addPrompt(
      `Which cost drivers and maintenance needs should we expect for ${recommendation.solutionTitle} at ${siteLabel}?`,
    );
  } else if (/flood|storm|heat|air|hazard|risk/.test(lastUserMessage)) {
    addPrompt(
      `How does ${recommendation.solutionTitle} help address site risks around ${siteLabel}?`,
    );
    addPrompt(
      `What design adjustments would make ${recommendation.solutionTitle} more resilient in ${locationLabel}?`,
    );
  } else if (/implement|step|phase|start|timeline/.test(lastUserMessage)) {
    addPrompt(
      `Can you turn ${recommendation.solutionTitle} into a phased action plan for ${locationLabel}?`,
    );
    addPrompt(
      `Who should lead the first implementation steps for ${recommendation.solutionTitle} in ${locationLabel}?`,
    );
  }

  addPrompt(
    `What are the first steps to implement ${recommendation.solutionTitle} near ${siteLabel}?`,
  );

  if (floodLevel !== null || stormLevel !== null) {
    addPrompt(
      `How should we adapt ${recommendation.solutionTitle} for the flood and storm exposure around ${siteLabel}?`,
    );
  } else if (hasAirQualityData) {
    addPrompt(
      `How could ${recommendation.solutionTitle} improve air quality conditions around ${siteLabel}?`,
    );
  }

  if (selectedBarangayData) {
    addPrompt(
      `How do the current greenery and heat conditions in ${selectedBarangayData.name} affect this recommendation?`,
    );
  }

  addPrompt(
    `What benefits, trade-offs, and maintenance needs should Barangay ${locationLabel} expect from ${recommendation.solutionTitle}?`,
  );

  return prompts.slice(0, 3);
}

function isFallbackAssistantReply(content: string) {
  const normalized = content.trim().toLowerCase();

  return /having trouble (connecting|responding) right now|not configured yet|empty chat response/.test(
    normalized,
  );
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
  isFullscreen = false,
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
    const customAreaLabel =
      selectedFeature.customSelectionGeometry &&
      selectedFeature.customSelectionAreaHectares !== undefined &&
      selectedFeature.customSelectionAreaHectares !== null
        ? ` (${selectedFeature.customSelectionAreaHectares.toFixed(2)} ha)`
        : "";

    const welcomeLocation = selectedFeature.customSelectionGeometry
      ? selectedFeature.barangay
        ? `Custom Area in Barangay ${selectedFeature.barangay}${customAreaLabel}`
        : `Custom Area${customAreaLabel}`
      : selectedFeature.barangay
        ? `Barangay ${selectedFeature.barangay}`
        : selectedFeature.name;

    const welcomeMessage: ChatMessage = {
      id: "welcome",
      role: "assistant",
      content: `Hi! I'm your GreenPoint assistant. Ask me anything about implementing **${recommendation.solutionTitle}** in ${welcomeLocation}.`,
      timestamp: new Date(),
    };

    const historyMessages = messages.map((message, index) => ({
      id: `${message.role}-${message.timestamp ?? index}-${index}`,
      role: message.role,
      content: message.content,
      timestamp: new Date(message.timestamp ?? Date.now()),
    }));

    return [welcomeMessage, ...historyMessages];
  }, [
    messages,
    recommendation.solutionTitle,
    selectedFeature.barangay,
    selectedFeature.customSelectionAreaHectares,
    selectedFeature.customSelectionGeometry,
    selectedFeature.name,
  ]);

  const suggestionPrompts = useMemo(
    () =>
      buildSuggestionPrompts(
        recommendation,
        selectedFeature,
        selectedBarangayData,
        messages,
      ),
    [messages, recommendation, selectedBarangayData, selectedFeature],
  );
  const visibleSuggestionPrompts = useMemo(
    () => (isFullscreen ? suggestionPrompts : suggestionPrompts.slice(0, 1)),
    [isFullscreen, suggestionPrompts],
  );
  const shouldShowInitialPrompts =
    !isLoading && visibleSuggestionPrompts.length > 0 && messages.length === 0;
  const lastAssistantMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const shouldShowFollowUps =
    !isLoading &&
    visibleSuggestionPrompts.length > 0 &&
    lastAssistantMessage?.role === "assistant" &&
    !isFallbackAssistantReply(lastAssistantMessage.content);

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

  const sendMessage = useCallback(async (rawText: string) => {
    const text = rawText.trim();
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
        getStoredSystemPromptOverride(),
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
    isLoading,
    messages,
    recommendation,
    selectedBarangayData,
    selectedFeature,
    setInput,
    setIsLoading,
    setMessages,
  ]);

  const handleSend = useCallback(() => {
    void sendMessage(input);
  }, [input, sendMessage]);

  const handleSuggestionSelect = useCallback((prompt: string) => {
    void sendMessage(prompt);
  }, [sendMessage]);

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
          {displayMessages.map((msg, index) => {
            const showInitialPromptsAfterWelcome = shouldShowInitialPrompts && index === 0;
            const showFollowUpsAfterLatestAssistant =
              shouldShowFollowUps && index === displayMessages.length - 1 && msg.role === "assistant";

            return (
              <div key={msg.id} className="contents">
                <MessageBubble msg={msg} />
                {showInitialPromptsAfterWelcome || showFollowUpsAfterLatestAssistant ? (
                  <SuggestionPromptGroup
                    prompts={visibleSuggestionPrompts}
                    isFollowUp={showFollowUpsAfterLatestAssistant}
                    onSelect={handleSuggestionSelect}
                    isFullscreen={isFullscreen}
                  />
                ) : null}
              </div>
            );
          })}

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
              className="flex self-center text-primary-green transition-all hover:text-green-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Send message"
            >
              <SendHorizonal size={16}/>
            </button>
          </div>
          <p className="mt-1.5 text-center text-xs text-neutral-300">
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
  const normalizedContent = useMemo(
    () => normalizeChatMarkdown(msg.content),
    [msg.content],
  );

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
        {isAssistant ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            skipHtml
            components={{
              p: ({ children }: ParagraphProps) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }: StrongProps) => <strong className="font-semibold text-neutral-900">{children}</strong>,
              em: ({ children }: EmphasisProps) => <em className="italic">{children}</em>,
              ul: ({ children }: ListProps) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
              ol: ({ children }: OrderedListProps) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
              li: ({ children }: ListItemProps) => (
                <li className="leading-relaxed [&>p]:mb-1 [&>p:last-child]:mb-0">{children}</li>
              ),
              a: ({ children, href }: AnchorProps) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary-green underline decoration-primary-green/30 underline-offset-2"
                >
                  {children}
                </a>
              ),
              code: ({ children, className }: CodeProps) => {
                const isBlock = Boolean(className);

                if (isBlock) {
                  return (
                    <code className="block overflow-x-auto rounded-lg bg-neutral-900/95 px-3 py-2 font-mono text-xs text-neutral-100">
                      {children}
                    </code>
                  );
                }

                return (
                  <code className="rounded bg-neutral-200/80 px-1 py-0.5 font-mono text-[0.85em] text-neutral-900">
                    {children}
                  </code>
                );
              },
              pre: ({ children }: PreformattedProps) => <pre className="mb-2 last:mb-0">{children}</pre>,
              blockquote: ({ children }: BlockquoteProps) => (
                <blockquote className="mb-2 border-l-2 border-primary-green/30 pl-3 text-neutral-600 last:mb-0">
                  {children}
                </blockquote>
              ),
            }}
          >
            {normalizedContent}
          </ReactMarkdown>
        ) : (
          msg.content
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-in fade-in duration-300">
      <div className="w-8 h-8 shrink-0 rounded-full bg-primary-green text-white flex items-center justify-center">
        <Sparkles size={15} />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-neutral-50 border border-neutral-100 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin text-neutral-400" />
        <span className="text-xs text-neutral-400">Thinking…</span>
      </div>
    </div>
  );
}

function SuggestionPromptGroup({
  prompts,
  isFollowUp,
  onSelect,
  isFullscreen,
}: {
  prompts: string[];
  isFollowUp: boolean;
  onSelect: (prompt: string) => void;
  isFullscreen: boolean;
}) {
  const label = isFollowUp ? "Suggested Follow-Ups" : "Suggested Prompt";

  if (!isFullscreen) {
    return (
      <div className="ml-11 -mt-1 flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="w-full max-w-[78%] rounded-2xl border border-neutral-200/80 bg-white/95 p-2.5 shadow-[0_14px_24px_-24px_rgba(0,0,0,0.55)] backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-neutral-400">
            <Sparkles size={11} className="text-primary-green/80" />
            {label}
          </div>
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSelect(prompt)}
              className="w-full rounded-[1.35rem] border border-primary-green/20 bg-[linear-gradient(180deg,rgba(246,251,247,0.98),rgba(255,255,255,0.98))] px-3.5 py-3 text-left text-sm font-medium leading-6 text-neutral-700 transition-all hover:border-primary-green/40 hover:text-primary-green"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ml-11 -mt-2 flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="relative w-fit max-w-[85%] pl-3">
        <div className="absolute left-0 top-4 h-7 w-px bg-gradient-to-b from-primary-green/45 to-emerald-200/10" />
        <div className="absolute left-[3px] top-[18px] h-3 w-3 rotate-45 rounded-[3px] border-l border-t border-emerald-100/80 bg-[linear-gradient(180deg,rgba(244,252,246,0.98),rgba(255,255,255,0.96))] shadow-sm" />
        <div className="w-fit max-w-full rounded-2xl rounded-tl-sm border border-emerald-100/80 bg-[linear-gradient(180deg,rgba(244,252,246,0.95),rgba(255,255,255,0.92))] p-3 shadow-[0_14px_34px_-26px_rgba(28,68,44,0.5)] backdrop-blur-sm ring-1 ring-white/70">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-700/80">
          <Sparkles size={12} />
          {label}
        </div>
        <div className="flex flex-wrap gap-2">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSelect(prompt)}
              className="rounded-full border border-emerald-200/80 bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-neutral-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-green hover:text-primary-green"
            >
              {prompt}
            </button>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}
