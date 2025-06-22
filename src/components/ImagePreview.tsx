'use client';

import { useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface ImagePreviewProps {
  src: string;
  alt: string;
  fileName: string;
  downloadUrl?: string;
  onClose: () => void;
}

export default function ImagePreview({ src, alt, fileName, downloadUrl, onClose }: ImagePreviewProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.click();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="relative max-w-full max-h-full p-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Toolbar */}
        <div className="absolute top-2 left-2 z-10 flex items-center space-x-2 bg-black bg-opacity-50 rounded-lg p-2">
          <button
            onClick={handleZoomIn}
            className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={handleRotate}
            className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded transition-colors"
            title="Rotate"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1 text-white text-sm hover:bg-white hover:bg-opacity-20 rounded transition-colors"
            title="Reset"
          >
            Reset
          </button>
          {downloadUrl && (
            <button
              onClick={handleDownload}
              className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded transition-colors"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Image */}
        <div className="flex items-center justify-center">
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain"
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              transition: 'transform 0.2s ease-in-out',
            }}
          />
        </div>

        {/* File name */}
        <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-50 text-white text-sm p-2 rounded text-center">
          {fileName}
        </div>
      </div>
    </div>
  );
} 