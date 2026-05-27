import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ColorSwatchGrid } from '../components/ui/ColorSwatchGrid';

const COLORS = [
  { name: 'rose',    hex: '#be123c' },
  { name: 'emerald', hex: '#047857' },
  { name: 'sky',     hex: '#0369a1' },
  { name: 'violet',  hex: '#6d28d9' },
  { name: 'pink',    hex: '#9d174d' },
  { name: 'fuchsia', hex: '#86198f' },
  { name: 'indigo',  hex: '#3730a3' },
  { name: 'teal',    hex: '#0f766e' },
  { name: 'amber',   hex: '#92400e' },
  { name: 'orange',  hex: '#c2410c' },
  { name: 'brown',   hex: '#78350f' },
  { name: 'slate',   hex: '#334155' },
];

describe('ColorSwatchGrid', () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders exactly 12 swatch buttons', () => {
    render(<ColorSwatchGrid selectedHex={null} onSelect={onSelect} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(12);
  });

  it('each swatch has an accessible aria-label containing the color name', () => {
    render(<ColorSwatchGrid selectedHex={null} onSelect={onSelect} />);

    for (const color of COLORS) {
      expect(screen.getByRole('button', { name: new RegExp(color.name, 'i') })).toBeInTheDocument();
    }
  });

  it('selected swatch has aria-pressed="true"; all others have aria-pressed="false"', () => {
    render(<ColorSwatchGrid selectedHex="#be123c" onSelect={onSelect} />);

    const roseButton = screen.getByRole('button', { name: /rose/i });
    expect(roseButton).toHaveAttribute('aria-pressed', 'true');

    for (const color of COLORS.filter((c) => c.hex !== '#be123c')) {
      const btn = screen.getByRole('button', { name: new RegExp(color.name, 'i') });
      expect(btn).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('clicking a swatch calls onSelect with the correct hex value', async () => {
    const user = userEvent.setup();
    render(<ColorSwatchGrid selectedHex={null} onSelect={onSelect} />);

    const emeraldButton = screen.getByRole('button', { name: /emerald/i });
    await user.click(emeraldButton);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('#047857');
  });

  it('pressing Space on a swatch calls onSelect with the correct hex value', async () => {
    const user = userEvent.setup();
    render(<ColorSwatchGrid selectedHex={null} onSelect={onSelect} />);

    const skyButton = screen.getByRole('button', { name: /sky/i });
    skyButton.focus();
    await user.keyboard(' ');

    expect(onSelect).toHaveBeenCalledWith('#0369a1');
  });

  it('pressing Enter on a swatch calls onSelect with the correct hex value', async () => {
    const user = userEvent.setup();
    render(<ColorSwatchGrid selectedHex={null} onSelect={onSelect} />);

    const slateButton = screen.getByRole('button', { name: /slate/i });
    slateButton.focus();
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith('#334155');
  });

  it('renders with no swatch selected when selectedHex is null', () => {
    render(<ColorSwatchGrid selectedHex={null} onSelect={onSelect} />);

    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn).toHaveAttribute('aria-pressed', 'false');
    }
  });
});
