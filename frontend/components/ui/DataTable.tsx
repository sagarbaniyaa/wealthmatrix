export interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  align?: 'left' | 'right';
}

export function DataTable<T>({ columns, rows, keyFn, emptyLabel = 'No records.' }: {
  columns: Column<T>[];
  rows: T[];
  keyFn: (row: T) => string;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-300">{emptyLabel}</p>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-ink-300">
          {columns.map((c) => (
            <th key={c.header} className={`pb-3 font-medium ${c.align === 'right' ? 'text-right' : ''}`}>{c.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={keyFn(row)} className="border-b border-hairline/50 last:border-0">
            {columns.map((c) => (
              <td key={c.header} className={`py-3 text-ink-100 ${c.align === 'right' ? 'text-right' : ''}`}>{c.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
