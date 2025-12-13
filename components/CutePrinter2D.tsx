import React, { useRef, useState, useEffect } from 'react';
import '../shojo.css';
import { Sparkles, Heart, Star, CloudUpload } from 'lucide-react';

interface CutePrinterProps {
    status: 'idle' | 'processing' | 'complete' | 'error';
    progress?: number;
    message?: string;
    onUpload: (file: File) => void;
}

const CutePrinter2D: React.FC<CutePrinterProps> = ({ status, progress, message, onUpload }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePanelClick = () => {
        if (status === 'idle' || status === 'complete') {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onUpload(e.target.files[0]);
        }
    };

    return (
        <div className="cute-machine" className={`cute-machine ${status === 'processing' ? 'processing' : ''}`}>

            {/* Decorative Floating Icons */}
            <div className="deco deco-star" style={{ top: -20, left: -20 }}><Star fill="currentColor" /></div>
            <div className="deco deco-heart" style={{ top: 20, right: -30 }}><Heart fill="currentColor" /></div>
            <div className="deco deco-star" style={{ bottom: -10, left: -10, fontSize: '18px' }}><Star fill="currentColor" /></div>

            {/* Screen Area */}
            <div className="machine-screen" onClick={handlePanelClick}>
                {status === 'idle' && (
                    <>
                        <CloudUpload size={48} className="text-cyan-600 mb-2 opacity-70" />
                        <div className="screen-text">Tap to Upload<br />Your Sticker Sheet!</div>
                        <div className="text-xs text-cyan-600 mt-2 opacity-60">Supports PNG / JPG</div>
                    </>
                )}

                {status === 'processing' && (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                        <Sparkles size={32} className="text-pink-400 animate-spin mb-2" />
                        <div className="screen-text text-sm mb-2">{message || 'Magic happening...'}</div>
                        {/* Cute Progress Bar */}
                        <div className="w-full max-w-[150px] h-4 bg-white rounded-full border-2 border-pink-200 overflow-hidden relative">
                            <div
                                className="h-full bg-pink-300 transition-all duration-300"
                                style={{ width: `${progress || 0}%`, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.5) 5px, rgba(255,255,255,0.5) 10px)' }}
                            ></div>
                        </div>
                    </div>
                )}

                {status === 'complete' && (
                    <>
                        <Sparkles size={48} className="text-yellow-400 mb-2 animate-bounce" />
                        <div className="screen-text">All Done! <br /> Look below!</div>
                    </>
                )}

                {status === 'error' && (
                    <div className="text-red-400 font-bold">Oh no! Error!</div>
                )}
            </div>

            {/* Controls / Brand */}
            <div className="flex items-center gap-2 mt-4 mb-2">
                <div className="w-3 h-3 rounded-full bg-pink-300"></div>
                <div className="font-bold text-pink-400 text-lg tracking-widest">GEMINI CUT</div>
                <div className="w-3 h-3 rounded-full bg-pink-300"></div>
            </div>

            {/* Output Slot */}
            <div className="output-slot-2d"></div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
            />
        </div>
    );
};

export default CutePrinter2D;
