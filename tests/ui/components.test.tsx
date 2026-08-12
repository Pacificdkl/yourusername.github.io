// @vitest-environment jsdom
/**
 * UI component tests (CLAUDE.md §7.6). Rendered in jsdom.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

afterEach(cleanup);
import type { ContentItemRecord } from '@/db';
import { SafewordBar } from '@/ui/SafewordBar';
import { ResultCard } from '@/ui/ResultCard';
import { IntensitySlider } from '@/ui/IntensitySlider';
import { CategorySelector } from '@/ui/CategorySelector';
import { Wheel } from '@/ui/Wheel';

const bdsmItem: ContentItemRecord = {
  id: 'i1',
  title: 'Wrist restraint',
  category: 'bdsm',
  description: 'A plain description.',
  intensity: 3,
  difficulty: 3,
  tags: [],
  safetyNotes: 'Check circulation. Never leave a bound person alone. https://example.org/',
  source: 'Commissioned original prose',
  licence: '© Spin',
  reviewedBy: 'reviewer',
  reviewedAt: new Date(),
};

describe('SafewordBar', () => {
  it('is always present with the safeword and a stop button', () => {
    const onStop = vi.fn();
    render(<SafewordBar safeword="RED" onStop={onStop} />);
    expect(screen.getByText('RED')).toBeInTheDocument();
    const stop = screen.getByRole('button', { name: /stop the session now/i });
    fireEvent.click(stop);
    expect(onStop).toHaveBeenCalledOnce();
  });
});

describe('ResultCard', () => {
  it('shows a placeholder when there is no item', () => {
    render(<ResultCard item={null} />);
    expect(screen.getByText(/spin to begin/i)).toBeInTheDocument();
  });

  it('renders item fields, the safety section, and attribution', () => {
    render(<ResultCard item={bdsmItem} />);
    expect(screen.getByText('Wrist restraint')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /safety notes/i })).toBeInTheDocument();
    expect(screen.getByText(/never leave a bound person alone/i)).toBeInTheDocument();
    expect(screen.getByText(/commissioned original prose/i)).toBeInTheDocument();
  });

  it('omits the safety section when there are no safety notes', () => {
    render(<ResultCard item={{ ...bdsmItem, category: 'position', safetyNotes: '' }} />);
    expect(screen.queryByRole('region', { name: /safety notes/i })).not.toBeInTheDocument();
  });
});

describe('IntensitySlider', () => {
  it('shows the value and reports changes', () => {
    const onChange = vi.fn();
    render(<IntensitySlider value={2} onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: /intensity cap/i });
    fireEvent.change(slider, { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith(4);
  });
});

describe('CategorySelector', () => {
  it('toggles a category on', () => {
    const onChange = vi.fn();
    render(
      <CategorySelector categories={['position', 'bdsm']} selected={[]} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'bdsm' }));
    expect(onChange).toHaveBeenCalledWith(['bdsm']);
  });

  it('toggles a selected category off', () => {
    const onChange = vi.fn();
    render(
      <CategorySelector
        categories={['position', 'bdsm']}
        selected={['bdsm']}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'bdsm' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe('Wheel', () => {
  it('calls onSpin when pressed and shows busy state', () => {
    const onSpin = vi.fn();
    const { rerender } = render(<Wheel onSpin={onSpin} busy={false} />);
    fireEvent.click(screen.getByRole('button', { name: /spin/i }));
    expect(onSpin).toHaveBeenCalledOnce();

    rerender(<Wheel onSpin={onSpin} busy />);
    expect(screen.getByRole('button', { name: /spinning/i })).toBeDisabled();
  });
});
