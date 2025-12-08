import React, { useState } from 'react';
import { StickerSegment } from '../types';
import { Download, Edit2, Check, Loader2, Sparkles } from 'lucide-react';

interface StickerCardProps {
  segment: StickerSegment;
  onRename: (id: string, newName: string) => void;
}

const StickerCard: React.FC<StickerCardProps> = ({ segment, onRename }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(segment.name);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = segment.dataUrl;
    link.download = `${segment.name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const saveName = () => {
    onRename(segment.id, tempName);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveName();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col items-center gap-3 transition-all hover:shadow-md group relative">
      <div className="w-full aspect-square flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')] bg-slate-100 rounded-lg overflow-hidden p-2">
        <img 
          src={segment.dataUrl} 
          alt={segment.name} 
          className="max-w-full max-h-full object-contain transition-transform group-hover:scale-110" 
        />
      </div>

      <div className="w-full flex items-center justify-between gap-2 h-9">
        {isEditing ? (
          <div className="flex items-center gap-1 w-full">
            <input 
              autoFocus
              type="text" 
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 text-xs border border-blue-300 rounded px-2 py-1 outline-none text-slate-700"
            />
            <button onClick={saveName} className="text-green-600 hover:bg-green-50 p-1 rounded">
              <Check size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 w-full overflow-hidden">
            {segment.isNaming ? (
               <div className="flex items-center gap-1.5 text-xs text-purple-600 font-medium animate-pulse">
                 <Sparkles size={12} />
                 <span>AI Naming...</span>
               </div>
            ) : (
              <>
                <span 
                  className="text-xs font-medium text-slate-700 truncate cursor-pointer hover:text-blue-600 flex-1"
                  onClick={() => setIsEditing(true)}
                  title={segment.name}
                >
                  {segment.name}
                </span>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit2 size={12} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <button 
        onClick={handleDownload}
        className="absolute top-2 right-2 bg-white/90 hover:bg-blue-600 hover:text-white text-slate-600 shadow-sm border border-slate-200 p-1.5 rounded-full transition-all opacity-0 group-hover:opacity-100 z-10"
        title="Download PNG"
      >
        <Download size={16} />
      </button>
    </div>
  );
};

export default StickerCard;