"use client";

import { useState, useEffect, useCallback } from "react";
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

type Tab = "personal" | "work";

function EmailRow({ email }: { email: EmailSummary }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5">
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
  );
}

function DigestContent({ data, loading, error }: {
  data: DigestData | null;
  loading: boolean;
  error: string | null;
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

  if (!data || (data.needsReply.length === 0 && data.fyi.length === 0)) {
    return (
      <p className="text-xs text-black/40 italic py-2">
        No notable emails from yesterday or today.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {data.needsReply.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-red-500/70 font-medium mb-1">
            Needs Reply
          </div>
          <div className="divide-y divide-forest/[0.06]">
            {data.needsReply.map((email, i) => (
              <EmailRow key={`reply-${i}`} email={email} />
            ))}
          </div>
        </div>
      )}

      {data.fyi.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-black/30 font-medium mb-1">
            FYI
          </div>
          <div className="divide-y divide-forest/[0.06]">
            {data.fyi.map((email, i) => (
              <EmailRow key={`fyi-${i}`} email={email} />
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

export default function Digest() {
  const [activeTab, setActiveTab] = useState<Tab>("personal");

  const [personalData, setPersonalData] = useState<DigestData | null>(null);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [personalFetched, setPersonalFetched] = useState(false);

  const [workData, setWorkData] = useState<DigestData | null>(null);
  const [workLoading, setWorkLoading] = useState(false);
  const [workError, setWorkError] = useState<string | null>(null);
  const [workFetched, setWorkFetched] = useState(false);

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

  // Fetch personal on mount (default tab)
  useEffect(() => {
    if (!personalFetched) fetchPersonal();
  }, [personalFetched, fetchPersonal]);

  // Lazy-fetch work tab on first switch
  useEffect(() => {
    if (activeTab === "work" && !workFetched) fetchWork();
  }, [activeTab, workFetched, fetchWork]);

  const handleRefresh = useCallback(async () => {
    if (activeTab === "personal") {
      await fetchPersonal();
    } else {
      await fetchWork();
    }
  }, [activeTab, fetchPersonal, fetchWork]);

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
        <DigestContent
          data={personalData}
          loading={personalLoading}
          error={personalError}
        />
      ) : (
        <DigestContent
          data={workData}
          loading={workLoading}
          error={workError}
        />
      )}
    </ComponentCard>
  );
}
