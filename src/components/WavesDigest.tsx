import ComponentCard from "./ComponentCard";

export default function WavesDigest() {
  return (
    <ComponentCard title="Waves Digest">
      <button
        disabled
        className="w-full py-3 rounded-xl border border-forest/15 text-sm text-black/30 cursor-not-allowed"
      >
        Open Digest
      </button>
      <p className="text-[10px] text-black/25 mt-3 italic">
        Coming in Phase 3
      </p>
    </ComponentCard>
  );
}
