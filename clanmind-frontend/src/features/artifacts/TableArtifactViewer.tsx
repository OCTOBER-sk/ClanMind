import React, { useState } from 'react';
import { Search, Copy, Check } from 'lucide-react';

export interface TableArtifactViewerProps {
  content: string; // JSON with headers and rows
}

export function TableArtifactViewer({ content }: TableArtifactViewerProps) {
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  let data: { headers: string[]; rows: string[][] } = { headers: [], rows: [] };
  try {
    data = JSON.parse(content);
  } catch {
    data = {
      headers: ['Signal', 'Pin', 'Mode', 'Clock / Max Frequency'],
      rows: [
        ['SPI1_SCK', 'PA5', 'Alternate Function 5', '24 MHz'],
        ['SPI1_MISO', 'PA6', 'Alternate Function 5', '24 MHz'],
        ['SPI1_MOSI', 'PB5', 'Alternate Function 5', '24 MHz'],
        ['IMU_CS', 'PC4', 'GPIO Output Push-Pull', 'High-Speed'],
        ['IMU_INT', 'PB1', 'EXTI Line 1 (Falling Edge)', 'Realtime IRQ'],
      ],
    };
  }

  const filteredRows = data.rows.filter((row) =>
    row.some((cell) => cell.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCopy = () => {
    const csv = [data.headers.join(','), ...data.rows.map((r) => r.join(','))].join('\n');
    navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-raised)] overflow-hidden text-xs">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)] bg-gray-50/50 dark:bg-gray-800/40">
        <div className="relative w-60">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rowsâ€¦"
            className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-[var(--color-surface-raised)] outline-none"
          />
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-[var(--color-surface-raised)] font-medium hover:bg-gray-50 cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied CSV' : 'Copy CSV'}</span>
        </button>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto p-4">
        <table className="w-full text-left border-collapse border border-[var(--color-border)] rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-[var(--color-surface-hover)] text-[var(--color-text)] font-semibold border-b border-gray-200 dark:border-gray-700">
              {data.headers.map((h, i) => (
                <th key={i} className="p-2.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredRows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className="hover:bg-[var(--color-surface-hover)] transition-colors font-mono text-[11px]"
              >
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="p-2.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
