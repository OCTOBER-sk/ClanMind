import React, { useState } from 'react';
import { FileText, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { IconButton } from '@/design-system/components/IconButton';

export interface PdfViewerProps {
  fileName: string;
  totalPages?: number;
}

export function PdfViewer({ fileName, totalPages = 48 }: PdfViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-950 text-xs overflow-hidden select-none">
      {/* PDF Toolbar (Â§92) */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-surface-raised)] border-b border-[var(--color-border)] shadow-2xs">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-red-500" />
          <span className="font-semibold text-[var(--color-text)] truncate max-w-xs">
            {fileName}
          </span>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-1 font-medium text-[var(--color-text-secondary)]">
          <IconButton
            aria-label="Previous page"
            size="xs"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </IconButton>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <IconButton
            aria-label="Next page"
            size="xs"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </IconButton>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <IconButton
            aria-label="Zoom out"
            size="xs"
            onClick={() => setZoom((z) => Math.max(z - 10, 50))}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </IconButton>
          <span className="text-[10px] font-mono text-gray-400 w-10 text-center">
            {zoom}%
          </span>
          <IconButton
            aria-label="Zoom in"
            size="xs"
            onClick={() => setZoom((z) => Math.min(z + 10, 200))}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      </div>

      {/* Rendered Document Page Mockup */}
      <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
        <div
          style={{ width: `${(595 * zoom) / 100}px`, minHeight: `${(842 * zoom) / 100}px` }}
          className="bg-white text-gray-900 shadow-xl rounded p-10 border border-gray-300 space-y-4 font-serif text-[13px] leading-relaxed transition-all"
        >
          <div className="border-b pb-3 text-center">
            <h1 className="text-base font-bold font-sans">ICM-42688-P High-Performance IMU</h1>
            <p className="text-[10px] text-gray-500 font-sans">
              Preliminary Datasheet Â· Revision 1.2 Â· Page {currentPage}
            </p>
          </div>

          <p>
            The ICM-42688-P is a 6-axis MotionTracking device that combines a 3-axis gyroscope and a 3-axis accelerometer in a small 2.5 mm Ã— 3 mm Ã— 0.91 mm package.
          </p>

          <h2 className="text-xs font-bold font-sans mt-4">1.1 SPI Interface Characteristics</h2>
          <p>
            The SPI interface operates in 4-wire mode with clock frequencies up to 24 MHz. All data transfers begin with the chip select (CS) line driven low.
          </p>
        </div>
      </div>
    </div>
  );
}
