import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, Download, RefreshCw, AlertCircle, Scissors, Sparkles, PlusCircle, Loader2 } from 'lucide-react';
import { ProcessingStatus, StickerSegment } from './types';
import { loadImage, processStickerSheet, extractStickerFromRect, Rect } from './services/imageProcessor';
import { generateStickerName } from './services/geminiService';
import StickerCard from './components/StickerCard';
import ManualCropModal from './components/ManualCropModal';
import JSZip from 'jszip';

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

      setStatus({ stage: 'segmenting', progress: 30, message: 'Detecting sticker boundaries...' });
      
      await new Promise(r => setTimeout(r, 500));

      const detectedSegments = await processStickerSheet(img, (msg) => {
         setStatus(prev => ({ ...prev, message: msg }));
      });

      if (detectedSegments.length === 0) {
        setStatus({ stage: 'idle', progress: 0, message: 'No stickers detected. Try an image with a clearer white background.' });
        alert("No stickers detected. Please ensure the image has a white background.");
        return;
      }

      setSegments(detectedSegments);
      runAiNaming(detectedSegments);

    } catch (error) {
      console.error(error);
      setStatus({ stage: 'idle', progress: 0, message: 'Error processing image.' });
      alert("Failed to process image.");
    }
  };

  const runAiNaming = async (itemsToName: StickerSegment[]) => {
      setStatus({ stage: 'ai_naming', progress: 60, message: 'Using Gemini AI to name stickers...' });

      // Mark these specific segments as naming
      setSegments(prev => prev.map(p => 
          itemsToName.some(i => i.id === p.id) ? { ...p, isNaming: true } : p
      ));

      let completed = 0;
      const batchSize = 3;
      
      const processBatch = async (batch: StickerSegment[]) => {
         const promises = batch.map(async (seg) => {
             const name = await generateStickerName(seg.dataUrl);
             setSegments(prev => prev.map(p => p.id === seg.id ? { ...p, name, isNaming: false } : p));
             completed++;
             // Only update progress text if we are in a bulk flow
             if (itemsToName.length > 1) {
                setStatus(prev => ({ 
                    ...prev, 
                    progress: 60 + (completed / itemsToName.length) * 40,
                    message: `Identifying sticker ${completed}/${itemsToName.length}...`
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
        // Automatically run AI naming on the new sticker
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
        // Ensure unique filenames
        let fileName = seg.name;
        let counter = 1;
        while (usedNames.has(fileName)) {
          fileName = `${seg.name}_${counter}`;
          counter++;
        }
        usedNames.add(fileName);

        // Remove data:image/png;base64, prefix
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
      console.error("Error zipping files:", error);
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600">
            <Scissors className="w-6 h-6" />
            <h1 className="font-bold text-xl tracking-tight text-slate-900">EmojiCut <span className="text-blue-600">AI</span></h1>
          </div>
          <div className="flex items-center gap-4">
             {process.env.API_KEY ? (
               <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                 <Sparkles size={12} />
                 <span>Gemini Active</span>
               </div>
             ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
                 <AlertCircle size={12} />
                 <span>No API Key</span>
               </div>
             )}
            <a href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900">Docs</a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8">
        
        {/* Empty State / Upload Area */}
        {status.stage === 'idle' && !originalImage && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all group"
            >
              <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <UploadCloud size={40} />
              </div>
              <h2 className="text-2xl font-semibold text-slate-900 mb-2">Upload Sticker Sheet</h2>
              <p className="text-slate-500 text-center max-w-md mb-8">
                Upload a PNG or JPG of a sticker sheet. We'll automatically separate them into individual transparent files and name them using AI.
              </p>
              <button className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors">
                Select Image
              </button>
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
              />
            </div>
            
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-center max-w-4xl">
              <div className="p-4">
                <div className="bg-white p-3 rounded-xl shadow-sm inline-block mb-3"><Scissors className="text-blue-500" /></div>
                <h3 className="font-semibold text-slate-900">Auto-Crop</h3>
                <p className="text-sm text-slate-500 mt-1">Smart algorithms detect individual stickers and crop them perfectly.</p>
              </div>
              <div className="p-4">
                <div className="bg-white p-3 rounded-xl shadow-sm inline-block mb-3"><ImageIcon className="text-purple-500" /></div>
                <h3 className="font-semibold text-slate-900">Transparent PNG</h3>
                <p className="text-sm text-slate-500 mt-1">White backgrounds are automatically removed for instant usage.</p>
              </div>
              <div className="p-4">
                <div className="bg-white p-3 rounded-xl shadow-sm inline-block mb-3"><Sparkles className="text-amber-500" /></div>
                <h3 className="font-semibold text-slate-900">AI Naming</h3>
                <p className="text-sm text-slate-500 mt-1">Gemini Vision looks at your stickers and names the files for you.</p>
              </div>
            </div>
          </div>
        )}

        {/* Processing State */}
        {status.stage !== 'idle' && status.stage !== 'complete' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-md space-y-6 text-center">
              <div className="relative w-24 h-24 mx-auto">
                 <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                 <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                 <Scissors className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Processing your stickers...</h3>
                <p className="text-slate-500">{status.message}</p>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300 ease-out" 
                  style={{ width: `${status.progress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Results View */}
        {status.stage === 'complete' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Ready to download</h2>
                <p className="text-slate-500">Found {segments.length} stickers from your image.</p>
              </div>
              <div className="flex items-center gap-3">
                 <button 
                  onClick={() => setIsManualCropping(true)}
                  className="flex items-center gap-2 px-4 py-2 text-blue-700 bg-blue-50 border border-blue-200 font-medium rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <PlusCircle size={18} />
                  Add Manual
                </button>
                <button 
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-300 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw size={18} />
                  Start Over
                </button>
                <button 
                  onClick={handleDownloadAll}
                  disabled={isZipping}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-colors disabled:opacity-70 disabled:cursor-wait"
                >
                  {isZipping ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  {isZipping ? 'Zipping...' : 'Download All'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {segments.map((segment) => (
                <StickerCard 
                  key={segment.id} 
                  segment={segment} 
                  onRename={handleRename}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Manual Crop Modal */}
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