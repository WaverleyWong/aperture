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
  /** False when SLACK_MCP_TOKEN isn't set — the section is hidden entirely. */
  configured?: boolean;
};

/** Display label for the work account. Cosmetic only — nothing keys off it. */
const WORK_LABEL = "HOWL";
const PERSONAL_LABEL = "Personal";

/** An email plus which inbox it came from, for the merged list. */
type LabelledEmail = EmailSummary & { account: string };

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);

  const THRESHOLD = 80;

  const collapseAndDismiss = () => {
    const wrapper = wrapperRef.current;
    if (!wrapper) { onDismiss(id); return; }
    // Collapse height
    wrapper.style.height = `${wrapper.offsetHeight}px`;
    // Force reflow
    wrapper.offsetHeight;
    wrapper.style.transition = "height 200ms ease, margin 200ms ease, padding 200ms ease";
    wrapper.style.height = "0";
    wrapper.style.overflow = "hidden";
    setTimeout(() => onDismiss(id), 200);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = 0;
    swiping.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping.current || !rowRef.current) return;
    const dx = e.touches[0].clientX - startX.current;
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
      // Slide out, then collapse height, then dismiss
      rowRef.current.style.transition = "transform 150ms ease, opacity 150ms ease";
      rowRef.current.style.transform = "translateX(-100%)";
      rowRef.current.style.opacity = "0";
      setTimeout(collapseAndDismiss, 150);
    } else {
      rowRef.current.style.transition = "transform 150ms ease, opacity 150ms ease";
      rowRef.current.style.transform = "translateX(0)";
      rowRef.current.style.opacity = "1";
    }
  };

  const handleDesktopDismiss = () => {
    const row = rowRef.current;
    if (row) {
      row.style.transition = "opacity 150ms ease";
      row.style.opacity = "0";
    }
    setTimeout(collapseAndDismiss, 150);
  };

  return (
    <div ref={wrapperRef} className="relative overflow-hidden group">
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
        onClick={handleDesktopDismiss}
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

function AccountBadge({ account }: { account: string }) {
  return (
    <span className="shrink-0 text-[9px] uppercase tracking-[0.1em] font-semibold text-forest/50 border border-forest/15 rounded px-1 py-px">
      {account}
    </span>
  );
}

function EmailRow({
  email,
  onDismiss,
}: {
  email: LabelledEmail;
  onDismiss: (id: string) => void;
}) {
  return (
    <DismissableRow id={itemKey(email.sender, email.subject)} onDismiss={onDismiss}>
      <div className="flex flex-col gap-0.5 py-1.5 pr-6">
        <div className="flex items-baseline gap-2">
          <AccountBadge account={email.account} />
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

/** Tags each email with its account so both inboxes can share one list. */
function label(data: DigestData | null, account: string) {
  if (!data) return { needsReply: [], fyi: [], count: 0 };
  return {
    needsReply: data.needsReply.map((e) => ({ ...e, account })),
    fyi: data.fyi.map((e) => ({ ...e, account })),
    count: data.emailCount || 0,
  };
}

function DigestContent({
  personal,
  work,
  loading,
  personalError,
  workError,
  dismissed,
  onDismiss,
}: {
  personal: DigestData | null;
  work: DigestData | null;
  loading: boolean;
  personalError: string | null;
  workError: string | null;
  dismissed: Set<string>;
  onDismiss: (id: string) => void;
}) {
  const error = personalError || workError;
  const p = label(personal, PERSONAL_LABEL);
  const w = label(work, WORK_LABEL);

  const notDismissed = (e: LabelledEmail) =>
    !dismissed.has(itemKey(e.sender, e.subject));

  // Needs-reply from both accounts first, then FYI from both.
  const needsReply = [...p.needsReply, ...w.needsReply].filter(notDismissed);
  const fyi = [...p.fyi, ...w.fyi].filter(notDismissed);
  const emailCount = p.count + w.count;

  if (loading && needsReply.length === 0 && fyi.length === 0) {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="text-xs text-black/40">
          Scanning inboxes and generating summary…
        </span>
      </div>
    );
  }

  // Only surface an error when there's nothing at all to show — one failing
  // account shouldn't hide the other's email.
  if (error && !personal && !work) {
    return <p className="text-xs text-red-400 py-2">{error}</p>;
  }

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

      {/* An account that is configured but failing says so quietly, rather
          than looking identical to one that isn't set up at all. */}
      {personalError && (
        <p className="text-[10px] text-black/30 italic">
          {PERSONAL_LABEL} email unavailable right now.
        </p>
      )}
      {workError && (
        <p className="text-[10px] text-black/30 italic">
          {WORK_LABEL} email unavailable right now — check the work connection.
        </p>
      )}

      {emailCount > 0 && (
        <div className="text-[10px] text-black/25 text-right">
          Based on {emailCount} most recent emails
        </div>
      )}
    </div>
  );
}

// ── Main component ──

export default function Digest() {
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

  // One combined list, so both inboxes and Slack load together on mount.
  useEffect(() => {
    if (!personalFetched) fetchPersonal();
    if (!workFetched) fetchWork();
    if (!slackFetched) fetchSlack();
  }, [personalFetched, fetchPersonal, workFetched, fetchWork, slackFetched, fetchSlack]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchPersonal(), fetchWork(), fetchSlack()]);
  }, [fetchPersonal, fetchWork, fetchSlack]);

  // Hidden entirely until SLACK_MCP_TOKEN is set — the route reports that as
  // `configured: false` rather than an error, so there's no empty state. Stays
  // hidden while loading too, so an unconfigured Slack never flashes a
  // "Scanning…" line before disappearing. A real failure still shows, so a
  // configured-but-broken Slack isn't silently swallowed.
  const showSlack =
    (slackData != null && slackData.configured !== false) || slackError != null;

  return (
    <ComponentCard
      title="Digest"
      className="col-span-2"
      onRefresh={handleRefresh}
    >
      <div className="anim-fade flex flex-col">
        {/* Email — both accounts in one list, needs-reply first */}
        <DigestContent
          personal={personalData}
          work={workData}
          loading={personalLoading || workLoading}
          personalError={personalError}
          workError={workError}
          dismissed={dismissed}
          onDismiss={handleDismiss}
        />

        {/* Slack — only once a token is configured */}
        {showSlack && (
          <>
            <div className="border-t border-forest/[0.08] my-4" />
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
          </>
        )}
      </div>
    </ComponentCard>
  );
}
