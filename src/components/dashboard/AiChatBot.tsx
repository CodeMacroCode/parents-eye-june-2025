"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  HARDCODED_QUESTIONS,
  ChatQuestion,
  ChatbotExecutionResult,
  executeChatbotFunction,
} from "@/services/api/aiChatBotService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useExport } from "@/hooks/useExport";
import {
  Bot,
  X,
  Send,
  Sparkles,
  Maximize2,
  Minimize2,
  Trash2,
  ArrowRight,
  RefreshCw,
  Car,
  Compass,
  MapPin,
  Shield,
  Activity,
  PauseCircle,
  Clock,
  Route,
  Timer,
  BarChart3,
  Calendar,
  Building2,
  Layers,
  Users,
  CreditCard,
  Ticket,
  Laptop,
  Search,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  Download,
} from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text?: string;
  timestamp: string;
  question?: ChatQuestion;
  pendingFields?: {
    question: ChatQuestion;
    values: Record<string, string>;
  };
  result?: ChatbotExecutionResult;
  isLoading?: boolean;
}

const getQuestionIcon = (funcName: string) => {
  if (funcName.includes("distance") || funcName.includes("km")) return Compass;
  if (funcName.includes("last_position")) return MapPin;
  if (funcName.includes("geofence")) return Shield;
  if (funcName.includes("active")) return Activity;
  if (funcName.includes("stopped")) return PauseCircle;
  if (funcName.includes("status")) return Clock;
  if (funcName.includes("trip")) return Route;
  if (funcName.includes("idle")) return Timer;
  if (funcName.includes("travel_summary")) return BarChart3;
  if (funcName.includes("vehicle") || funcName.includes("device")) return Car;
  if (funcName.includes("school")) return Building2;
  if (funcName.includes("branch_group")) return Layers;
  if (funcName.includes("branch")) return Users;
  if (funcName.includes("route")) return Route;
  if (funcName.includes("subscription")) return CreditCard;
  if (funcName.includes("ticket")) return Ticket;
  if (funcName.includes("session")) return Laptop;
  return Sparkles;
};

export const AiChatBot: React.FC = () => {
  const { exportToPDF, exportToExcel } = useExport();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [pendingFormValues, setPendingFormValues] = useState<Record<string, string>>({});
  const [exportingId, setExportingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          sender: "bot",
          text: "👋 Hello! I am your AI Fleet Assistant. You can ask me anything about vehicle statuses, live KM reports, trip history, drivers, routes, schools, or subscriptions. Choose from the quick questions below or type your query!",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Autocomplete matching questions for input
  const inputMatches = useMemo(() => {
    if (!inputVal.trim()) return [];
    const lower = inputVal.toLowerCase().trim();
    const words = lower
      .split(/\s+/)
      .filter((w) => w.length > 1 && !["add", "the", "of"].includes(w));
    return HARDCODED_QUESTIONS.filter(
      (q) =>
        q.question.toLowerCase().includes(lower) ||
        (q.intent && q.intent.toLowerCase().includes(lower)) ||
        (words.length > 0 &&
          words.every((word) => q.question.toLowerCase().includes(word)))
    ).slice(0, 5);
  }, [inputVal]);

  // Handle Question selection
  const handleSelectQuestion = async (q: ChatQuestion, providedFields?: Record<string, string>) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // If question has fields and values are not yet provided, show interactive inline form
    if (q.fields && q.fields.length > 0 && !providedFields) {
      const initialFields: Record<string, string> = {};
      q.fields.forEach((f) => {
        initialFields[f.name] = "";
      });
      setPendingFormValues(initialFields);

      // Add user message indicating selection
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: "user",
          text: q.question,
          timestamp,
        },
        {
          id: `bot-prompt-${Date.now()}`,
          sender: "bot",
          text: `Please provide details for "${q.question.trim()}":`,
          question: q,
          pendingFields: {
            question: q,
            values: initialFields,
          },
          timestamp,
        },
      ]);
      return;
    }

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: "user",
        text: q.question,
        timestamp,
      },
    ]);

    // Add loading message from bot
    const botMsgId = `bot-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: botMsgId,
        sender: "bot",
        isLoading: true,
        text: "Fetching live report data...",
        timestamp,
      },
    ]);

    // Execute the function
    const result = await executeChatbotFunction(q.function, providedFields || {});

    // Replace loading message with result
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === botMsgId
          ? {
              ...msg,
              isLoading: false,
              text: result.summary,
              result,
            }
          : msg
      )
    );
  };

  // Submit inline field form
  const handleFieldSubmit = (q: ChatQuestion) => {
    handleSelectQuestion(q, pendingFormValues);
    setPendingFormValues({});
  };

  // Handle free-form input submit
  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    // Check if there is an exact or best matching question
    const lower = inputVal.toLowerCase().trim();
    let match =
      HARDCODED_QUESTIONS.find((q) => q.question.toLowerCase().trim() === lower) ||
      HARDCODED_QUESTIONS.find((q) => q.question.toLowerCase().includes(lower)) ||
      HARDCODED_QUESTIONS.find((q) => lower.includes(q.question.toLowerCase().trim()));

    if (!match) {
      if (
        (lower.includes("distance") || lower.includes("km")) &&
        (lower.includes("all") || lower.includes("every") || lower.includes("fleet"))
      ) {
        match = HARDCODED_QUESTIONS.find(
          (q) => q.function === "get_all_vehicles_distance_report"
        );
      }
    }

    if (match) {
      handleSelectQuestion(match);
    } else {
      // Fallback: respond with guidance
      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: "user",
          text: inputVal,
          timestamp,
        },
        {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: `I couldn't find a direct report for "${inputVal}". Please select one of the available questions below or filter by category.`,
          timestamp,
        },
      ]);
    }

    setInputVal("");
    setShowSuggestions(false);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: "welcome",
        sender: "bot",
        text: "Chat cleared! How can I assist you with your fleet and reports today?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const handleExportResult = async (
    msgId: string,
    result: ChatbotExecutionResult,
    format: "pdf" | "excel"
  ) => {
    // Always export the full unpaginated dataset if available
    const sourceData = (result.allData && result.allData.length > 0)
      ? result.allData
      : result.data;

    if (!sourceData || sourceData.length === 0) return;

    try {
      setExportingId(`${msgId}-${format}`);

      // Extract columns
      let columns: { key: string; header: string }[] = [];
      if (result.columns && result.columns.length > 0) {
        columns = result.columns.map((c) => ({
          key: c.key,
          header: c.label || c.key,
        }));
      } else {
        const sample = sourceData[0];
        columns = Object.keys(sample).map((key) => ({
          key,
          header: key
            .replace(/([A-Z])/g, " $1")
            .replace(/_/g, " ")
            .replace(/^\w/, (c) => c.toUpperCase())
            .trim(),
        }));
      }

      // Format all unpaginated data rows cleanly
      const formattedData = sourceData.map((item) => {
        const row: Record<string, any> = {};
        columns.forEach((col) => {
          const raw = item[col.key];
          if (raw === null || raw === undefined) {
            row[col.key] = "--";
          } else if (typeof raw === "object") {
            row[col.key] = JSON.stringify(raw);
          } else {
            row[col.key] = String(raw);
          }
        });
        return row;
      });

      const title = result.title || "Fleet Data Report";
      const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, "_");
      const dateStr = new Date().toISOString().split("T")[0];

      const metadata: Record<string, string> = {};
      if (result.badges && result.badges.length > 0) {
        result.badges.forEach((b) => {
          metadata[b.label] = String(b.value);
        });
      }
      metadata["Total Records Exported"] = String(formattedData.length);

      if (format === "excel") {
        await exportToExcel(formattedData, columns, {
          title,
          filename: `${cleanTitle}_All_${formattedData.length}_${dateStr}.xlsx`,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        });
      } else {
        await exportToPDF(formattedData, columns, {
          title,
          filename: `${cleanTitle}_All_${formattedData.length}_${dateStr}.pdf`,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        });
      }
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExportingId(null);
    }
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
          <div className="hidden md:flex items-center bg-white dark:bg-zinc-800 text-xs px-3 py-1.5 rounded-full shadow-md border border-zinc-200 dark:border-zinc-700 animate-pulse font-medium text-zinc-700 dark:text-zinc-300">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            AI Fleet Assistant
          </div>
          <Button
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center p-0"
            title="Open AI Assistant"
          >
            <Bot className="w-7 h-7" />
          </Button>
        </div>
      )}

      {/* Floating Chatbot Window */}
      {isOpen && (
        <div
          className={`fixed z-50 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 ${
            isExpanded
              ? "bottom-4 right-4 w-[92vw] md:w-[750px] h-[88vh]"
              : "bottom-6 right-6 w-[94vw] sm:w-[460px] h-[640px] max-h-[85vh]"
          }`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white px-4 py-3 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm leading-tight">AI Fleet Assistant</h3>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
                <p className="text-[11px] text-blue-100 font-normal">Reports & Fleet Intelligence</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearChat}
                className="w-8 h-8 text-white/80 hover:text-white hover:bg-white/10 rounded-full"
                title="Clear conversation"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-8 h-8 text-white/80 hover:text-white hover:bg-white/10 rounded-full hidden sm:flex"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 text-white/80 hover:text-white hover:bg-white/10 rounded-full"
                title="Close chat"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-900/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                {/* Message Header */}
                <div className="flex items-center gap-1.5 mb-1 text-[11px] text-zinc-400 px-1">
                  {msg.sender === "bot" ? (
                    <>
                      <Bot className="w-3.5 h-3.5 text-blue-600" />
                      <span className="font-semibold text-zinc-600 dark:text-zinc-300">Fleet AI</span>
                    </>
                  ) : (
                    <span>You</span>
                  )}
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[92%] rounded-2xl p-3.5 text-sm shadow-xs ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white rounded-tr-xs"
                      : "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-tl-xs"
                  }`}
                >
                  {/* Loading Spinner */}
                  {msg.isLoading && (
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 py-1">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span className="text-xs italic">{msg.text}</span>
                    </div>
                  )}

                  {/* Regular Text */}
                  {!msg.isLoading && msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

                  {/* Cards Grid inside Welcome Message */}
                  {msg.id === "welcome" && (
                    <div className="mt-3.5 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-center justify-between mb-2.5 px-0.5">
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                          <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
                          Choose a query to begin:
                        </span>
                        <Badge variant="outline" className="text-[10px] text-zinc-500 font-medium">
                          {HARDCODED_QUESTIONS.length} Queries
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1">
                        {HARDCODED_QUESTIONS.map((q) => {
                          const Icon = getQuestionIcon(q.function);
                          return (
                            <button
                              key={q.id}
                              type="button"
                              onClick={() => handleSelectQuestion(q)}
                              className="group text-left p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 border border-zinc-200/90 dark:border-zinc-700/80 hover:border-blue-400 dark:hover:border-blue-500 shadow-xs hover:shadow-sm transition-all flex items-start gap-2.5 cursor-pointer"
                            >
                              <div className="p-1.5 rounded-lg bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0 shadow-xs border border-zinc-200/50 dark:border-zinc-700/50">
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 leading-snug line-clamp-2">
                                    {q.question.trim()}
                                  </span>
                                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                                </div>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium capitalize truncate">
                                    {q.intent?.replace(/_/g, " ") || "Report"}
                                  </span>
                                  {q.fields && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium shrink-0">
                                      Input
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Interactive Inline Input Form for Questions with Fields */}
                  {msg.pendingFields && (
                    <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-900/80 rounded-xl border border-zinc-200 dark:border-zinc-700">
                      <h4 className="text-xs font-semibold mb-2 text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        Parameters Required
                      </h4>
                      <div className="space-y-2">
                        {msg.pendingFields.question.fields?.map((f) => (
                          <div key={f.name}>
                            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                              {f.label || f.name}
                            </label>
                            <Input
                              type={f.type || "text"}
                              placeholder={f.placeholder || `Enter ${f.name}`}
                              value={pendingFormValues[f.name] || ""}
                              onChange={(e) =>
                                setPendingFormValues((prev) => ({
                                  ...prev,
                                  [f.name]: e.target.value,
                                }))
                              }
                              className="h-8 text-xs bg-white dark:bg-zinc-800"
                            />
                          </div>
                        ))}
                        <Button
                          size="sm"
                          onClick={() => handleFieldSubmit(msg.pendingFields!.question)}
                          className="w-full mt-2 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
                        >
                          Submit & Fetch Report
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Structured Result Display */}
                  {msg.result && (
                    <div className="mt-3 space-y-2.5">
                      {/* Result Header, Badges & Export Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                        <div className="flex flex-col gap-1 min-w-0 max-w-[65%]">
                          <span className="font-semibold text-xs text-blue-600 dark:text-blue-400 truncate">
                            {msg.result.title}
                          </span>
                          {msg.result.badges && (
                            <div className="flex flex-wrap gap-1">
                              {msg.result.badges.map((b, idx) => (
                                <Badge
                                  key={idx}
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {b.label}: <strong className="ml-1">{b.value}</strong>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Export in PDF or Excel */}
                        {msg.result.data && msg.result.data.length > 0 && (
                          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            <button
                              type="button"
                              disabled={exportingId !== null}
                              onClick={() => handleExportResult(msg.id, msg.result!, "excel")}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-md transition-all shadow-2xs hover:shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              title={`Export all ${msg.result.allData?.length || msg.result.data.length} records to Excel (.xlsx)`}
                            >
                              {exportingId === `${msg.id}-excel` ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                              ) : (
                                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              )}
                              <span>Excel</span>
                              {msg.result.allData && msg.result.allData.length > (msg.result.data?.length ?? 0) && (
                                <span className="text-[9px] px-1 py-0.2 bg-emerald-200/60 dark:bg-emerald-800/60 rounded font-bold">
                                  All ({msg.result.allData.length})
                                </span>
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={exportingId !== null}
                              onClick={() => handleExportResult(msg.id, msg.result!, "pdf")}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-800 rounded-md transition-all shadow-2xs hover:shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              title={`Export all ${msg.result.allData?.length || msg.result.data.length} records to PDF (.pdf)`}
                            >
                              {exportingId === `${msg.id}-pdf` ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-600" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                              )}
                              <span>PDF</span>
                              {msg.result.allData && msg.result.allData.length > (msg.result.data?.length ?? 0) && (
                                <span className="text-[9px] px-1 py-0.2 bg-red-200/60 dark:bg-red-800/60 rounded font-bold">
                                  All ({msg.result.allData.length})
                                </span>
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Cards View */}
                      {msg.result.type === "cards" && msg.result.data && (
                        <div className="space-y-2">
                          {msg.result.data.map((item, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-700 text-xs space-y-1"
                            >
                              {Object.entries(item).map(([key, val]) => (
                                <div
                                  key={key}
                                  className="flex items-center justify-between py-0.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                                >
                                  <span className="text-zinc-500 dark:text-zinc-400">{key}:</span>
                                  <span className="font-medium text-zinc-900 dark:text-zinc-100 text-right">
                                    {String(val ?? "--")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Table View */}
                      {msg.result.type === "table" && msg.result.data && (
                        <div className="space-y-1">
                          <div className="overflow-x-auto max-h-60 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 uppercase text-[10px] sticky top-0">
                                <tr>
                                  {msg.result.columns?.map((c) => (
                                    <th key={c.key} className="px-2.5 py-1.5">
                                      {c.label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                {msg.result.data.map((row, rIdx) => (
                                  <tr
                                    key={rIdx}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                                  >
                                    {msg.result?.columns?.map((c) => (
                                      <td
                                        key={c.key}
                                        className="px-2.5 py-1.5 text-zinc-800 dark:text-zinc-200 whitespace-nowrap"
                                      >
                                        {String(row[c.key] ?? "--")}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {msg.result.allData && msg.result.allData.length > (msg.result.data?.length ?? 0) && (
                            <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 px-1 pt-0.5">
                              <span>Showing preview of {msg.result.data?.length} of {msg.result.allData.length} records</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Export includes all {msg.result.allData.length} records</span>
                            </div>
                          )}
                        </div>
                      )}


                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Autocomplete suggestions popup above input */}
          {showSuggestions && inputMatches.length > 0 && (
            <div className="bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 p-2 shadow-lg max-h-48 overflow-y-auto">
              <span className="text-[10px] font-semibold text-zinc-400 px-2 uppercase tracking-wider block mb-1">
                Suggested Matches:
              </span>
              {inputMatches.map((q) => (
                <button
                  key={q.id}
                  onClick={() => {
                    handleSelectQuestion(q);
                    setInputVal("");
                    setShowSuggestions(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 rounded-md transition-colors flex items-center justify-between"
                >
                  <span className="truncate">{q.question}</span>
                  <Badge variant="outline" className="text-[9px] py-0 px-1">
                    {q.intent || "query"}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {/* Toggle Query Cards tray for ongoing chat */}
          {messages.length > 1 && (
            <div className="border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowCards(!showCards)}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1.5 font-medium transition-colors"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{showCards ? "Hide Query Cards" : `Show All Query Cards (${HARDCODED_QUESTIONS.length})`}</span>
                  {showCards ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showCards && (
                <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 max-h-60 overflow-y-auto bg-white dark:bg-zinc-900">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {HARDCODED_QUESTIONS.map((q) => {
                      const Icon = getQuestionIcon(q.function);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            handleSelectQuestion(q);
                            setShowCards(false);
                          }}
                          className="group text-left p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-zinc-200 dark:border-zinc-700 hover:border-blue-400 flex items-start gap-2 cursor-pointer transition-colors"
                        >
                          <Icon className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-zinc-800 dark:text-zinc-200 font-semibold line-clamp-2 group-hover:text-blue-600">
                              {q.question.trim()}
                            </span>
                            {q.fields && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium inline-block mt-0.5">
                                Input
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Chat Input Form */}
          <form
            onSubmit={handleInputSubmit}
            className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                type="text"
                placeholder="Ask about vehicles, reports, users..."
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="pr-8 text-xs h-10 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 focus-visible:ring-blue-500"
              />
              {inputVal && (
                <button
                  type="button"
                  onClick={() => {
                    setInputVal("");
                    setShowSuggestions(false);
                  }}
                  className="absolute right-2.5 top-3 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Button
              type="submit"
              disabled={!inputVal.trim()}
              className="h-10 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
};

export default AiChatBot;
