import { render, screen } from '@testing-library/react';
import StatusBadge, { badgeTone } from '../components/StatusBadge.jsx';

describe('StatusBadge', () => {
  it.each([
    ['SCHEDULED', 'blue'],
    ['COMPLETED', 'green'],
    ['INCOMPLETE', 'amber'],
    ['MISSED', 'red'],
    ['SENT', 'green'],
    ['FAILED', 'red'],
    ['DISPATCHED', 'blue'],
    ['DELIVERED', 'green'],
    ['CRITICAL', 'red'],
    ['ELEVATED', 'orange'],
    ['NORMAL', 'green'],
    ['DELIVERY_FAILED', 'red'],
    ['RESOLVED_READMITTED', 'green'],
    ['something-else', 'gray'],
    [null, 'gray'],
  ])('maps %p to %p', (value, tone) => {
    expect(badgeTone(value)).toBe(tone);
  });

  it('is case-insensitive', () => {
    expect(badgeTone('completed')).toBe('green');
  });

  it('renders the value with underscores replaced and exposes the tone', () => {
    render(<StatusBadge value="PATIENT_DECLINED" />);
    const el = screen.getByText('PATIENT DECLINED');
    expect(el).toHaveAttribute('data-tone', 'amber');
  });

  it('renders a dash for empty values and honours a custom label', () => {
    const { rerender } = render(<StatusBadge value={null} />);
    expect(screen.getByText('-')).toBeInTheDocument();
    rerender(<StatusBadge value="FAILED" label="SMS failed" />);
    expect(screen.getByText('SMS failed')).toHaveAttribute('data-tone', 'red');
  });
});
