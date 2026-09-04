import { render, screen } from '@testing-library/react';
import { StatTile } from './StatTile';

describe('StatTile', () => {
  it('renders the label and value', () => {
    render(<StatTile label="Net unrealised gain" value="£12,000" />);
    expect(screen.getByText('Net unrealised gain')).toBeInTheDocument();
    expect(screen.getByText('£12,000')).toBeInTheDocument();
  });

  it('uses the neutral colour by default', () => {
    render(<StatTile label="Total" value="£1,000" />);
    expect(screen.getByText('£1,000')).toHaveClass('text-ink-100');
  });

  it('colours the value green for a positive tone', () => {
    render(<StatTile label="Gain" value="+£500" tone="positive" />);
    expect(screen.getByText('+£500')).toHaveClass('text-verdigris-400');
  });

  it('colours the value red for a negative tone', () => {
    render(<StatTile label="Loss" value="-£500" tone="negative" />);
    expect(screen.getByText('-£500')).toHaveClass('text-rust-400');
  });
});
