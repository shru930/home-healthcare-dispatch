import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ArrayBuilder from '../components/ArrayBuilder.jsx';

const FIELDS = [
  { name: 'dayNumber', label: 'Day', type: 'number', min: 1, max: 7 },
  { name: 'focus', label: 'Focus' },
];

function Harness({ initial = [], onValue, ...rest }) {
  const [v, setV] = useState(initial);
  return (
    <ArrayBuilder
      label="Sessions"
      fields={FIELDS}
      value={v}
      onChange={(n) => {
        setV(n);
        onValue?.(n);
      }}
      newItem={{ dayNumber: 1, focus: '' }}
      addLabel="Add session"
      {...rest}
    />
  );
}

describe('ArrayBuilder', () => {
  it('shows an empty hint and adds rows from the template', () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    expect(screen.getByText(/No items/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add session/ }));
    fireEvent.click(screen.getByRole('button', { name: /Add session/ }));
    expect(screen.getAllByTestId('array-row')).toHaveLength(2);
    expect(onValue).toHaveBeenLastCalledWith([{ dayNumber: 1, focus: '' }, { dayNumber: 1, focus: '' }]);
  });

  it('removes the selected row and keeps the others', () => {
    const onValue = vi.fn();
    render(<Harness initial={[{ dayNumber: 1, focus: 'A' }, { dayNumber: 2, focus: 'B' }, { dayNumber: 3, focus: 'C' }]} onValue={onValue} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove item 2' }));
    expect(screen.getAllByTestId('array-row')).toHaveLength(2);
    expect(onValue).toHaveBeenLastCalledWith([{ dayNumber: 1, focus: 'A' }, { dayNumber: 3, focus: 'C' }]);
  });

  it('edits a field of one row and converts number inputs', () => {
    const onValue = vi.fn();
    render(<Harness initial={[{ dayNumber: 1, focus: '' }]} onValue={onValue} />);
    fireEvent.change(screen.getByLabelText('Focus'), { target: { value: 'Gait training' } });
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '5' } });
    expect(onValue).toHaveBeenLastCalledWith([{ dayNumber: 5, focus: 'Gait training' }]);
  });

  it('respects minItems and maxItems', () => {
    render(<Harness initial={[{ dayNumber: 1, focus: 'A' }]} minItems={1} maxItems={2} />);
    expect(screen.getByRole('button', { name: 'Remove item 1' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Add session/ }));
    expect(screen.getAllByTestId('array-row')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Add session/ })).toBeDisabled();
  });
});
