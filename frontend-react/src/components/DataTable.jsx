import { EmptyState } from './Feedback.jsx';

/**
 * Generic responsive table.
 * columns: [{ key, header, render?(row), className? }]
 */
export default function DataTable({ columns, rows, rowKey = 'id', empty = 'No records', emptyHint, onRowClick, selectedKey }) {
  if (!rows || rows.length === 0) return <EmptyState title={empty}>{emptyHint}</EmptyState>;
  const keyOf = (r, i) => (typeof rowKey === 'function' ? rowKey(r, i) : r[rowKey] ?? i);
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="min-w-full divide-y divide-stone-200 text-sm">
        <thead className=" ">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-stone-400 ${c.className || ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((r, i) => {
            const k = keyOf(r, i);
            return (
              <tr
                key={k}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`transition-colors hover:bg-stone-50 ${onRowClick ? 'cursor-pointer hover:bg-brand-50' : ''} ${selectedKey != null && selectedKey === k ? 'bg-brand-50 ' : ''}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-middle text-[13.5px] text-stone-700 ${c.className || ''}`}>
                    {c.render ? c.render(r) : r[c.key] ?? '-'}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
