import React, { useRef, useState } from 'react';
import { Upload, Sparkles, Wand2, ArrowRight, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { StickerStyle, STICKER_STYLES, generateStickerSheet } from '../services/geminiService';
import { GenerationState } from '../types';
import '../shojo.css';

interface StickerGeneratorPanelProps {
    onGenerated: (imageDataUrl: string) => void;
    onProceedToCut: () => void;
}

const StickerGeneratorPanel: React.FC<StickerGeneratorPanelProps> = ({ onGenerated, onProceedToCut }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [state, setState] = useState<GenerationState>({
        referenceImage: null,
        selectedStyleId: 'line_cute',
        customStyle: '',
        generatedImage: null,
        isGenerating: false,
        error: null
    });

    const selectedStyle = STICKER_STYLES.find(s => s.id === state.selectedStyleId) || STICKER_STYLES[0];

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                setState(prev => ({
                    ...prev,
                    referenceImage: event.target?.result as string,
                    generatedImage: null,
                    error: null
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!state.referenceImage) return;

        setState(prev => ({ ...prev, isGenerating: true, error: null }));

        try {
            const generatedImageUrl = await generateStickerSheet(
                state.referenceImage,
                selectedStyle,
                state.customStyle || undefined
            );

            setState(prev => ({
                ...prev,
                generatedImage: generatedImageUrl,
                isGenerating: false
            }));

            onGenerated(generatedImageUrl);
        } catch (error) {
            console.error('Generation failed:', error);
            setState(prev => ({
                ...prev,
                isGenerating: false,
                error: error instanceof Error ? error.message : '生成失败，请重试'
            }));
        }
    };

    const handleProceedToCut = () => {
        if (state.generatedImage) {
            onProceedToCut();
        }
    };

    return (
        <div className="generator-panel">
            <div className="generator-header">
                <Wand2 size={24} className="text-purple-500" />
                <h2>AI 贴纸生成器</h2>
            </div>

            {/* Reference Image Upload */}
            <div className="generator-section">
                <label className="section-label">
                    <ImageIcon size={16} />
                    上传角色参考图
                </label>
                <div
                    className={`upload-zone ${state.referenceImage ? 'has-image' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {state.referenceImage ? (
                        <img src={state.referenceImage} alt="Reference" className="preview-image" />
                    ) : (
                        <>
                            <Upload size={32} className="upload-icon" />
                            <span>点击上传图片</span>
                        </>
                    )}
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*"
                />
            </div>

            {/* Style Selector - Fallback when custom is empty */}
            <div className="generator-section">
                <label className="section-label">预设风格（备选）</label>
                <div className="style-grid">
                    {STICKER_STYLES.map(style => (
                        <button
                            key={style.id}
                            className={`style-btn ${state.selectedStyleId === style.id ? 'selected' : ''}`}
                            onClick={() => setState(prev => ({ ...prev, selectedStyleId: style.id }))}
                        >
                            <span className="style-name">{style.name}</span>
                            <span className="style-desc">{style.description}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom Style Input - Primary User Input */}
            <div className="generator-section">
                <label className="section-label">
                    ✨ 画面风格（自定义）
                </label>
                <textarea
                    className="custom-style-input"
                    placeholder="输入你想要的画面风格，例如：
• 赛博朋克霓虹灯风格
• 水彩手绘风，柔和配色  
• 日式复古昭和风
• 像素艺术8-bit风格
留空则使用下方预设风格"
                    value={state.customStyle}
                    onChange={(e) => setState(prev => ({ ...prev, customStyle: e.target.value }))}
                    rows={4}
                />
            </div>

            {/* Generate Button */}
            <button
                className="generate-btn"
                onClick={handleGenerate}
                disabled={!state.referenceImage || state.isGenerating}
            >
                {state.isGenerating ? (
                    <>
                        <Sparkles size={20} className="animate-spin" />
                        生成中...
                    </>
                ) : (
                    <>
                        <Sparkles size={20} />
                        生成贴纸表
                    </>
                )}
            </button>

            {/* Error Message */}
            {state.error && (
                <div className="error-message">
                    <AlertCircle size={16} />
                    {state.error}
                </div>
            )}

            {/* Generated Image Preview */}
            {state.generatedImage && (
                <div className="generator-section">
                    <label className="section-label">生成结果</label>
                    <div className="generated-preview">
                        <img src={state.generatedImage} alt="Generated Stickers" />
                    </div>
                    <button className="proceed-btn" onClick={handleProceedToCut}>
                        <span>进入切图</span>
                        <ArrowRight size={18} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default StickerGeneratorPanel;
