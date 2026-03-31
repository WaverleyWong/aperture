"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ComponentCard from "./ComponentCard";

type EmailSummary = {
  sender: string;
  subject: string;
  summary: string;
};

type DigestData = {
  needsReply: EmailSummary[];
  fyi: EmailSummary[];
  emailCount: number;
};

type SlackItem = {
  sender: string;
  summary: string;
};

type SlackDigestData = {
  needsResponse: SlackItem[];
  fyi: SlackItem[];
  messageCount: number;
};

type Tab = "personal" | "work";

const DISMISSED_KEY = "digest-dismissed";

function itemKey(sender: string, subject: string): string {
  return `${sender}::${subject}`;
}

function slackItemKey(sender: string, summary: string): string {
  return `slack::${sender}::${summary}`;
}

// ── Swipe/dismiss wrapper ──

function DismissableRow({
  id,
  onDismiss,
  children,
}: {
  id: string;
  onDismiss: (id: string) => void;
  children: React.ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);

  const THRESHOLD = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = 0;
    swiping.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping.current || !rowRef.current) return;
    const dx = e.touches[0].clientX - startX.current;
    // Only allow left swipe
    if (dx < 0) {
      currentX.current = dx;
      rowRef.current.style.transform = `translateX(${dx}px)`;
      rowRef.current.style.opacity = `${Math.max(1 + dx / 200, 0.3)}`;
    }
  };

  const handleTouchEnd = () => {
    if (!rowRef.current) return;
    swiping.current = false;
    if (currentX.current < -THRESHOLD) {
      // Animate out then dismiss
      rowRef.current.style.transition = "transform 200ms ease, opacity 200ms ease";
      rowRef.current.style.transform = "translateX(-100%)";
      rowRef.current.style.opacity = "0";
      setTimeout(() => onDismiss(id), 200);
    } else {
      // Snap back
      rowRef.current.style.transition = "transform 150ms ease, opacity 150ms ease";
      rowRef.current.style.transform = "translateX(0)";
      rowRef.current.style.opacity = "1";
    }
  };

  return (
    <div className="relative overflow-hidden group">
      <div
        ref={rowRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ willChange: "transform" }}
      >
        {children}
      </div>
      {/* Desktop hover X */}
      <button
        onClick={() => onDismiss(id)}
        className="absolute right-0 top-1/2 -translate-y-1/2 hidden md:group-hover:flex items-center justify-center w-5 h-5 rounded-full text-black/20 hover:text-black/50 hover:bg-black/5 transition-colors"
        aria-label="Dismiss"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M1 1l6 6M7 1l-6 6" />
        </svg>
      </button>
    </div>
  );
}

// ── Row components ──

function EmailRow({
  email,
  onDismiss,
}: {
  email: EmailSummary;
  onDismiss: (id: string) => void;
}) {
  return (
    <DismissableRow id={itemKey(email.sender, email.subject)} onDismiss={onDismiss}>
      <div className="flex flex-col gap-0.5 py-1.5 pr-6">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-black/80 shrink-0">
            {email.sender}
          </span>
          <span className="text-[11px] text-black/40 truncate">
            {email.subject}
          </span>
        </div>
        <p className="text-[11px] text-black/55 leading-snug">{email.summary}</p>
      </div>
    </DismissableRow>
  );
}

function SlackIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0"
    >
      <path
        d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  );
}

function SlackRow({
  item,
  onDismiss,
}: {
  item: SlackItem;
  onDismiss: (id: string) => void;
}) {
  return (
    <DismissableRow id={slackItemKey(item.sender, item.summary)} onDismiss={onDismiss}>
      <div className="flex flex-col gap-0.5 py-1.5 pr-6">
        <span className="text-xs font-medium text-black/80">{item.sender}</span>
        <p className="text-[11px] text-black/55 leading-snug">{item.summary}</p>
      </div>
    </DismissableRow>
  );
}

// ── Section renderers ──

function SlackSection({
  data,
  loading,
  error,
  dismissed,
  onDismiss,
}: {
  data: SlackDigestData | null;
  loading: boolean;
  error: string | null;
  dismissed: Set<string>;
  onDismiss: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="text-xs text-black/40">
          Scanning Slack messages…
        </span>
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-red-400 py-2">{error}</p>;
  }

  if (!data) {
    return (
      <p className="text-xs text-black/40 italic py-2">
        No Slack messages needing attention.
      </p>
    );
  }

  const needsResponse = data.needsResponse.filter(
    (i) => !dismissed.has(slackItemKey(i.sender, i.summary))
  );
  const fyi = data.fyi.filter(
    (i) => !dismissed.has(slackItemKey(i.sender, i.summary))
  );

  if (needsResponse.length === 0 && fyi.length === 0) {
    return (
      <p className="text-xs text-black/40 italic py-2">
        No Slack messages needing attention.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {needsResponse.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-red-500/70 font-medium mb-1">
            Needs Reply
          </div>
          <div className="divide-y divide-forest/[0.06]">
            {needsResponse.map((item, i) => (
              <SlackRow key={`slack-reply-${i}`} item={item} onDismiss={onDismiss} />
            ))}
          </div>
        </div>
      )}

      {fyi.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-black/30 font-medium mb-1">
            FYI
          </div>
          <div className="divide-y divide-forest/[0.06]">
            {fyi.map((item, i) => (
              <SlackRow key={`slack-fyi-${i}`} item={item} onDismiss={onDismiss} />
            ))}
          </div>
        </div>
      )}

      <div className="text-[10px] text-black/25 text-right">
        Based on {data.messageCount} recent messages
      </div>
    </div>
  );
}

function DigestContent({
  data,
  loading,
  error,
  dismissed,
  onDismiss,
}: {
  data: DigestData | null;
  loading: boolean;
  error: string | null;
  dismissed: Set<string>;
  onDismiss: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="text-xs text-black/40">
          Scanning inbox and generating summary…
        </span>
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-red-400 py-2">{error}</p>;
  }

  if (!data) {
    return (
      <p className="text-xs text-black/40 italic py-2">
        No notable emails from yesterday or today.
      </p>
    );
  }

  const needsReply = data.needsReply.filter(
    (e) => !dismissed.has(itemKey(e.sender, e.subject))
  );
  const fyi = data.fyi.filter(
    (e) => !dismissed.has(itemKey(e.sender, e.subject))
  );

  if (needsReply.length === 0 && fyi.length === 0) {
    return (
      <p className="text-xs text-black/40 italic py-2">
        No notable emails from yesterday or today.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {needsReply.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-red-500/70 font-medium mb-1">
            Needs Reply
          </div>
          <div className="divide-y divide-forest/[0.06]">
            {needsReply.map((email, i) => (
              <EmailRow key={`reply-${i}`} email={email} onDismiss={onDismiss} />
            ))}
          </div>
        </div>
      )}

      {fyi.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-black/30 font-medium mb-1">
            FYI
          </div>
          <div className="divide-y divide-forest/[0.06]">
            {fyi.map((email, i) => (
              <EmailRow key={`fyi-${i}`} email={email} onDismiss={onDismiss} />
            ))}
          </div>
        </div>
      )}

      <div className="text-[10px] text-black/25 text-right">
        Based on {data.emailCount} most recent emails
      </div>
    </div>
  );
}

// ── Main component ──

export default function Digest() {
  const [activeTab, setActiveTab] = useState<Tab>("personal");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [dismissedLoaded, setDismissedLoaded] = useState(false);

  const [personalData, setPersonalData] = useState<DigestData | null>(null);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [personalFetched, setPersonalFetched] = useState(false);

  const [workData, setWorkData] = useState<DigestData | null>(null);
  const [workLoading, setWorkLoading] = useState(false);
  const [workError, setWorkError] = useState<string | null>(null);
  const [workFetched, setWorkFetched] = useState(false);

  const [slackData, setSlackData] = useState<SlackDigestData | null>(null);
  const [slackLoading, setSlackLoading] = useState(false);
  const [slackError, setSlackError] = useState<string | null>(null);
  const [slackFetched, setSlackFetched] = useState(false);

  // Load dismissed set from Turso on mount
  useEffect(() => {
    fetch(`/api/state?key=${DISMISSED_KEY}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.value) {
          try {
            const arr: string[] = JSON.parse(data.value);
            setDismissed(new Set(arr));
          } catch { /* corrupt, start fresh */ }
        }
      })
      .catch(() => {})
      .finally(() => setDismissedLoaded(true));
  }, []);

  // Persist dismissed set to Turso
  const saveDismissed = useCallback((next: Set<string>) => {
    fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: DISMISSED_KEY, value: JSON.stringify([...next]) }),
    }).catch(() => {});
  }, []);

  const handleDismiss = useCallback(
    (id: string) => {
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(id);
        saveDismissed(next);
        return next;
      });
    },
    [saveDismissed]
  );

  const fetchPersonal = useCallback(async () => {
    setPersonalLoading(true);
    setPersonalError(null);
    try {
      const res = await fetch(`/api/personal-digest?_t=${Date.now()}`);
      const json = await res.json();
      if (json.error) {
        setPersonalError(json.error);
      } else {
        setPersonalData(json);
      }
    } catch {
      setPersonalError("Failed to load personal digest");
    } finally {
      setPersonalLoading(false);
      setPersonalFetched(true);
    }
  }, []);

  const fetchWork = useCallback(async () => {
    setWorkLoading(true);
    setWorkError(null);
    try {
      const res = await fetch(`/api/work-digest?_t=${Date.now()}`);
      const json = await res.json();
      if (json.error) {
        setWorkError(json.error);
      } else {
        setWorkData(json);
      }
    } catch {
      setWorkError("Failed to load work digest");
    } finally {
      setWorkLoading(false);
      setWorkFetched(true);
    }
  }, []);

  const fetchSlack = useCallback(async () => {
    setSlackLoading(true);
    setSlackError(null);
    try {
      const res = await fetch(`/api/slack-digest?_t=${Date.now()}`);
      const json = await res.json();
      if (json.error) {
        setSlackError(json.error);
      } else {
        setSlackData(json);
      }
    } catch {
      setSlackError("Failed to load Slack digest");
    } finally {
      setSlackLoading(false);
      setSlackFetched(true);
    }
  }, []);

  // Fetch personal on mount (default tab)
  useEffect(() => {
    if (!personalFetched) fetchPersonal();
  }, [personalFetched, fetchPersonal]);

  // Lazy-fetch work tab + slack on first switch
  useEffect(() => {
    if (activeTab === "work") {
      if (!workFetched) fetchWork();
      if (!slackFetched) fetchSlack();
    }
  }, [activeTab, workFetched, fetchWork, slackFetched, fetchSlack]);

  const handleRefresh = useCallback(async () => {
    if (activeTab === "personal") {
      await fetchPersonal();
    } else {
      await Promise.all([fetchWork(), fetchSlack()]);
    }
  }, [activeTab, fetchPersonal, fetchWork, fetchSlack]);

  return (
    <ComponentCard
      title="Digest"
      className="col-span-2"
      onRefresh={handleRefresh}
    >
      {/* Tabs */}
      <div className="flex gap-1 mb-4 -mt-1">
        <button
          type="button"
          onClick={() => setActiveTab("personal")}
          className={`px-3 py-1 rounded-full text-[11px] font-medium tracking-wide transition-all ${
            activeTab === "personal"
              ? "bg-forest/10 text-forest"
              : "text-black/30 hover:text-black/50"
          }`}
        >
          Personal
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("work")}
          className={`px-3 py-1 rounded-full text-[11px] font-medium tracking-wide transition-all ${
            activeTab === "work"
              ? "bg-forest/10 text-forest"
              : "text-black/30 hover:text-black/50"
          }`}
        >
          Work
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "personal" ? (
        <div key="personal" className="anim-fade">
          <DigestContent
            data={personalData}
            loading={personalLoading}
            error={personalError}
            dismissed={dismissed}
            onDismiss={handleDismiss}
          />
        </div>
      ) : (
        <div key="work" className="anim-fade flex flex-col">
          {/* Slack section */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <SlackIcon />
              <span className="text-[11px] font-semibold text-black/50 uppercase tracking-[0.08em]">
                Slack
              </span>
            </div>
            <SlackSection
              data={slackData}
              loading={slackLoading}
              error={slackError}
              dismissed={dismissed}
              onDismiss={handleDismiss}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-forest/[0.08] my-4" />

          {/* Email section */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
                <path d="M2 7l10 7 10-7" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
              </svg>
              <span className="text-[11px] font-semibold text-black/50 uppercase tracking-[0.08em]">
                Email
              </span>
            </div>
            <DigestContent
              data={workData}
              loading={workLoading}
              error={workError}
              dismissed={dismissed}
              onDismiss={handleDismiss}
            />
          </div>
        </div>
      )}
    </ComponentCard>
  );
}
