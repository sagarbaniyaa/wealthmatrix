export function Button({
  children, variant = 'primary', ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const base = 'rounded-sm px-4 py-2 text-sm font-medium transition disabled:opacity-50';
  const variants = {
    primary: 'bg-brass-500 text-ink-950 hover:bg-brass-400',
    ghost: 'border border-hairline text-ink-100 hover:border-brass-500',
    danger: 'border border-rust-500/50 text-rust-400 hover:bg-rust-500/10',
  };
  return (
    <button {...props} className={`${base} ${variants[variant]} ${props.className ?? ''}`}>
      {children}
    </button>
  );
}
