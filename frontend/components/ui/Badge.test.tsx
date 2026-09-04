import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its children as text', () => {
    render(<Badge>Verified</Badge>);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('applies the tone-specific colour class', () => {
    render(<Badge tone="breach">Breach</Badge>);
    expect(screen.getByText('Breach')).toHaveClass('bg-rust-500/20', 'text-rust-400');
  });

  it('falls back to the "info" tone for an unrecognised tone value, rather than rendering with no colour class at all', () => {
    render(<Badge tone="not-a-real-tone">Mystery</Badge>);
    expect(screen.getByText('Mystery')).toHaveClass('bg-ink-700', 'text-ink-100');
  });

  it('defaults to "info" when no tone is passed', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toHaveClass('bg-ink-700', 'text-ink-100');
  });
});
