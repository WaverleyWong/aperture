interface ComponentCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function ComponentCard({ title, children, className = "" }: ComponentCardProps) {
  return (
    <div
      className={`rounded-2xl border border-forest/20 bg-white/60 backdrop-blur-sm p-5 flex flex-col ${className}`}
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-forest mb-4">
        {title}
      </h2>
      <div className="flex-1">{children}</div>
    </div>
  );
}
