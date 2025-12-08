import React, { useRef, useState, useEffect } from 'react';
import { X, Check, Crop } from 'lucide-react';
import { Rect } from '../services/imageProcessor';

interface ManualCropModalProps {
  imageUrl: string;
  onClose: () => void;
  onConfirm: (rect: Rect) => void;
}

const ManualCropModal: React.FC<ManualCropModalProps> = ({ imageUrl, onClose, onConfirm }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<Rect | null>(null);

  const getImageCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!imgRef.current) return null;
    
    const img = imgRef.current;
    const rect = img.getBoundingClientRect();
    
    // Handle touch or mouse
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // Scale relative to natural image size
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;

    return {
      x: Math.max(0, Math.min(img.naturalWidth, x * scaleX)),
      y: Math.max(0, Math.min(img.naturalHeight, y * scaleY))
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const coords = getImageCoordinates(e);
    if (coords) {
      setIsDrawing(true);
      setStartPos(coords);
      setCurrentRect({ minX: coords.x, maxX: coords.x, minY: coords.y, maxY: coords.y });
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !startPos) return;
    e.preventDefault();
    
    const coords = getImageCoordinates(e);
    if (coords) {
      setCurrentRect({
        minX: Math.min(startPos.x, coords.x),
        maxX: Math.max(startPos.x, coords.x),
        minY: Math.min(startPos.y, coords.y),
        maxY: Math.max(startPos.y, coords.y)
      });
    }
  };

  const handleEnd = () => {
    setIsDrawing(false);
  };

  const handleConfirm = () => {
    if (currentRect && (currentRect.maxX - currentRect.minX > 5) && (currentRect.maxY - currentRect.minY > 5)) {
      onConfirm(currentRect);
    }
  };

  // Calculate overlay style for the selected box
  const getOverlayStyle = () => {
    if (!currentRect || !imgRef.current) return {};
    
    // Need to convert back to display percentages for CSS
    const nw = imgRef.current.naturalWidth;
    const nh = imgRef.current.naturalHeight;
    
    const left = (currentRect.minX / nw) * 100;
    const top = (currentRect.minY / nh) * 100;
    const width = ((currentRect.maxX - currentRect.minX) / nw) * 100;
    const height = ((currentRect.maxY - currentRect.minY) / nh) * 100;

    return {
      left: `${left}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`
    };
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl flex items-center justify-between mb-4 text-white">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Crop className="w-5 h-5" /> Manual Selection
          </h3>
          <p className="text-sm text-slate-300">Click and drag to select a sticker.</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X />
        </button>
      </div>

      <div 
        ref={containerRef}
        className="relative max-h-[70vh] overflow-hidden rounded-lg shadow-2xl border border-slate-700 bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')] bg-slate-800"
      >
        <img 
          ref={imgRef}
          src={imageUrl} 
          alt="Original" 
          className="max-w-full max-h-[70vh] object-contain select-none cursor-crosshair touch-none"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          draggable={false}
        />
        
        {/* Selection Overlay */}
        {currentRect && (
          <div 
            className="absolute border-2 border-blue-500 bg-blue-500/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-none"
            style={getOverlayStyle()}
          >
             <div className="absolute top-0 left-0 -mt-8 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                Selection
             </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <button 
          onClick={onClose}
          className="px-6 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={handleConfirm}
          disabled={!currentRect}
          className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Check size={18} />
          Add Sticker
        </button>
      </div>
    </div>
  );
};

export default ManualCropModal;