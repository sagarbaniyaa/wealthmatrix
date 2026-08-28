export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-sm border border-hairline bg-ink-900 p-6 ${className}`}>
      {children}
    </div>
  );
}
