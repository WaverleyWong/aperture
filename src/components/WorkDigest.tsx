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

export default function WorkDigest() {
  const [data, setData] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDigest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/work-digest?_t=${Date.now()}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch work digest:", err);
      setError("Failed to load digest");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  return (
    <ComponentCard
      title="Work Digest"
      className="col-span-2"
      onRefresh={fetchDigest}
    >
      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <span className="text-xs text-black/40">
            Scanning inbox and generating summary…
          </span>
        </div>
      ) : error ? (
        <p className="text-xs text-red-400 py-2">{error}</p>
      ) : !data ||
        (data.needsReply.length === 0 && data.fyi.length === 0) ? (
        <p className="text-xs text-black/40 italic py-2">
          No notable emails from yesterday or today.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Needs Reply */}
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

          {/* FYI */}
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

          {/* Email count */}
          <div className="text-[10px] text-black/25 text-right">
            Based on {data.emailCount} most recent emails
          </div>
        </div>
      )}
    </ComponentCard>
  );
}
