import React, { useState, useRef } from 'react';
import { UploadCloud, RefreshCw, Download, Loader2, Sparkles, AlertCircle, Scissors, PlusCircle } from 'lucide-react';
import { ProcessingStatus, StickerSegment } from './types';
import { loadImage, processStickerSheet, extractStickerFromRect, Rect } from './services/imageProcessor';
import { generateStickerName } from './services/geminiService';
import StickerCard from './components/StickerCard';
import ManualCropModal from './components/ManualCropModal';
import CutePrinter2D from './components/CutePrinter2D';
import StickerStack from './components/StickerStack';
import JSZip from 'jszip';
import './shojo.css';

const App: React.FC = () => {
  const [status, setStatus] = useState<ProcessingStatus>({ stage: 'idle', progress: 0, message: '' });
  const [segments, setSegments] = useState<StickerSegment[]>([]);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [originalImageEl, setOriginalImageEl] = useState<HTMLImageElement | null>(null);
  const [isManualCropping, setIsManualCropping] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    try {
      setStatus({ stage: 'analyzing_layout', progress: 10, message: 'Loading image...' });
      setSegments([]);

      const img = await loadImage(file);
      setOriginalImage(img.src);
      setOriginalImageEl(img);

      setStatus({ stage: 'segmenting', progress: 30, message: 'Detecting boundaries...' });

      await new Promise(r => setTimeout(r, 500));

      const detectedSegments = await processStickerSheet(img, (msg) => {
        setStatus(prev => ({ ...prev, message: msg }));
      });

      if (detectedSegments.length === 0) {
        setStatus({ stage: 'idle', progress: 0, message: 'No stickers detected.' });
        alert("No stickers detected. Please ensure the image has a white background.");
        return;
      }

      setSegments(detectedSegments);
      runAiNaming(detectedSegments);

    } catch (error) {
      console.error(error);
      setStatus({ stage: 'idle', progress: 0, message: 'Error processing image.' });
    }
  };

  const runAiNaming = async (itemsToName: StickerSegment[]) => {
    setStatus({ stage: 'ai_naming', progress: 60, message: 'Asking Gemini...' });

    setSegments(prev => prev.map(p =>
      itemsToName.some(i => i.id === p.id) ? { ...p, isNaming: true } : p
    ));

    let completed = 0;
    const batchSize = 3;

    const processBatch = async (batch: StickerSegment[]) => {
      const promises = batch.map(async (seg) => {
        try {
          const name = await generateStickerName(seg.dataUrl);
          setSegments(prev => prev.map(p => p.id === seg.id ? { ...p, name, isNaming: false } : p));
        } catch (e) {
          console.error("Naming error", e);
        }
        completed++;
        if (itemsToName.length > 1) {
          setStatus(prev => ({
            ...prev,
            progress: 60 + (completed / itemsToName.length) * 40,
            message: `Naming ${completed}/${itemsToName.length}...`
          }));
        }
      });
      await Promise.all(promises);
    };

    for (let i = 0; i < itemsToName.length; i += batchSize) {
      await processBatch(itemsToName.slice(i, i + batchSize));
    }

    setStatus({ stage: 'complete', progress: 100, message: 'Done!' });
  };

  const handleManualCrop = (rect: Rect) => {
    if (!originalImageEl) return;

    const newSegment = extractStickerFromRect(
      originalImageEl,
      rect,
      `sticker_${segments.length + 1}`
    );

    if (newSegment) {
      setSegments(prev => [...prev, newSegment]);
      setIsManualCropping(false);
      runAiNaming([newSegment]);
    }
  };

  const handleRename = (id: string, newName: string) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  };

  const handleDownloadAll = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();

      segments.forEach((seg) => {
        let fileName = seg.name;
        let counter = 1;
        while (usedNames.has(fileName)) {
          fileName = `${seg.name}_${counter}`;
          counter++;
        }
        usedNames.add(fileName);

        const base64Data = seg.dataUrl.split(',')[1];
        zip.file(`${fileName}.png`, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: "blob" });

      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = "stickers.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error zipping:", error);
      alert("Failed to create zip file.");
    } finally {
      setIsZipping(false);
    }
  };

  const handleReset = () => {
    setSegments([]);
    setOriginalImage(null);
    setOriginalImageEl(null);
    setStatus({ stage: 'idle', progress: 0, message: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="shojo-container">

      <CutePrinter2D
        status={status.stage === 'idle' ? 'idle' : status.stage === 'complete' ? 'complete' : 'processing'}
        progress={status.progress}
        message={status.message}
        onUpload={processFile}
      />

      {/* Floating Controls for when stickers are present */}
      {segments.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
          <button onClick={handleReset} className="cute-btn flex items-center gap-2">
            <RefreshCw size={16} /> Reset
          </button>
          <button onClick={handleDownloadAll} className="cute-btn flex items-center gap-2" style={{ borderColor: '#81C784', color: '#2E7D32', background: '#E8F5E9' }}>
            {isZipping ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Save All
          </button>
          <button onClick={() => setIsManualCropping(true)} className="cute-btn flex items-center gap-2" style={{ borderColor: '#64B5F6', color: '#1565C0', background: '#E3F2FD' }}>
            <PlusCircle size={16} /> Add One
          </button>
        </div>
      )}

      {/* The output stack - Stickers spill out onto the "desk" */}
      <div className="sticker-desk pointer-events-none">
        <div className="w-full h-full relative pointer-events-auto">
          <StickerStack stickers={segments} visible={segments.length > 0} />
        </div>
      </div>

      {isManualCropping && originalImage && (
        <ManualCropModal
          imageUrl={originalImage}
          onClose={() => setIsManualCropping(false)}
          onConfirm={handleManualCrop}
        />
      )}
    </div>
  );
};

export default App;