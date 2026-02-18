import React, { useRef, useState, useCallback, useEffect } from "react";

type Step = "upload" | "processing" | "edit" | "download";

const BORDER_MIN = 0;
const BORDER_MAX = 40;
const CANVAS_SIZE = 600;

const StickerMaker: React.FC = () => {
  const [step, setStep] = useState<Step>("upload");
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [removedBgBlob, setRemovedBgBlob] = useState<Blob | null>(null);
  const [processedImage, setProcessedImage] = useState<HTMLImageElement | null>(null);
  const [borderWidth, setBorderWidth] = useState(8);
  const [borderEnabled, setBorderEnabled] = useState(true);
  const [borderColor, setBorderColor] = useState("#ffffff");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setError(null);
    const img = new Image();
    img.onload = () => {
      setOriginalImage(img);
      setOriginalFile(file);
      setStep("processing");
    };
    img.src = URL.createObjectURL(file);
  }, []);

  // Drop handler
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // Remove background when step becomes "processing"
  useEffect(() => {
    if (step !== "processing" || !originalFile) return;
    let cancelled = false;

    const runRemoval = async () => {
      try {
        setProgress(0);

        // Dynamically import the heavy bg-removal library (code-split)
        const { removeBackground } = await import("@imgly/background-removal");

        // Track progress across multiple phases
        const phaseWeights: Record<string, number> = {
          "fetch:model": 0.5,           // model download is ~50% of wait
          "compute:inference": 0.4,     // inference ~40%
          "fetch:wasm": 0.05,
          "compute:postprocess": 0.05,
        };
        const phaseDone: Record<string, number> = {};

        const blob = await removeBackground(originalFile, {
          progress: (key: string, current: number, total: number) => {
            if (cancelled) return;
            const ratio = total > 0 ? current / total : 0;

            // Find matching phase weight
            let weight = 0.05; // default small weight for unknown phases
            for (const [phase, w] of Object.entries(phaseWeights)) {
              if (key.includes(phase) || key.startsWith(phase.split(":")[0])) {
                weight = w;
                break;
              }
            }
            phaseDone[key] = ratio * weight;

            const totalPct = Math.min(
              95,
              Math.round(
                Object.values(phaseDone).reduce((a, b) => a + b, 0) * 100
              )
            );
            setProgress(Math.max(totalPct, 5));
          },
        });
        if (cancelled) return;
        setProgress(100);
        setRemovedBgBlob(blob);

        const img = new Image();
        img.onload = () => {
          if (!cancelled) {
            setProcessedImage(img);
            setStep("edit");
          }
        };
        img.src = URL.createObjectURL(blob);
      } catch (err) {
        if (!cancelled) {
          console.error("Background removal failed:", err);
          setError("Background removal failed. Please try again with a different image.");
          setStep("upload");
        }
      }
    };

    runRemoval();
    return () => {
      cancelled = true;
    };
  }, [step, originalFile]);

  // Draw the sticker on canvas
  const drawSticker = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !processedImage) return;

    const ctx = canvas.getContext("2d")!;
    const imgW = processedImage.width;
    const imgH = processedImage.height;

    // Calculate dimensions with border
    const border = borderEnabled ? borderWidth : 0;
    const totalW = imgW + border * 2;
    const totalH = imgH + border * 2;

    // Scale to fit canvas
    const scale = Math.min(CANVAS_SIZE / totalW, CANVAS_SIZE / totalH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const borderPx = border * scale;

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    // Clear with checkerboard
    drawCheckerboard(ctx, CANVAS_SIZE, CANVAS_SIZE);

    // Center
    const ox = (CANVAS_SIZE - (drawW + borderPx * 2)) / 2;
    const oy = (CANVAS_SIZE - (drawH + borderPx * 2)) / 2;

    if (borderEnabled && borderWidth > 0) {
      // Draw white border by painting the image outline
      // We draw the image multiple times offset to create a stroke effect
      ctx.save();
      ctx.globalCompositeOperation = "source-over";

      // Create an offscreen canvas for the border
      const offscreen = document.createElement("canvas");
      offscreen.width = CANVAS_SIZE;
      offscreen.height = CANVAS_SIZE;
      const octx = offscreen.getContext("2d")!;

      // Draw the image at all border offsets to create a "dilated" shape
      const steps = Math.max(16, borderPx * 2);
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const dx = Math.cos(angle) * borderPx;
        const dy = Math.sin(angle) * borderPx;
        octx.drawImage(
          processedImage,
          ox + borderPx + dx,
          oy + borderPx + dy,
          drawW,
          drawH
        );
      }

      // Now color the whole thing with border color
      octx.globalCompositeOperation = "source-in";
      octx.fillStyle = borderColor;
      octx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      ctx.drawImage(offscreen, 0, 0);
      ctx.restore();
    }

    // Draw the actual image on top
    ctx.drawImage(processedImage, ox + (borderEnabled ? borderPx : 0), oy + (borderEnabled ? borderPx : 0), drawW, drawH);
  }, [processedImage, borderWidth, borderEnabled, borderColor]);

  useEffect(() => {
    drawSticker();
  }, [drawSticker]);

  // Download sticker
  const downloadSticker = useCallback(
    async (format: "png" | "jpeg" | "webp") => {
      const canvas = canvasRef.current;
      if (!canvas || !processedImage) return;

      // Create export canvas at full resolution
      const border = borderEnabled ? borderWidth : 0;
      const imgW = processedImage.width;
      const imgH = processedImage.height;
      const totalW = imgW + border * 2;
      const totalH = imgH + border * 2;

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = totalW;
      exportCanvas.height = totalH;
      const ctx = exportCanvas.getContext("2d")!;

      if (format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, totalW, totalH);
      }

      if (borderEnabled && borderWidth > 0) {
        const offscreen = document.createElement("canvas");
        offscreen.width = totalW;
        offscreen.height = totalH;
        const octx = offscreen.getContext("2d")!;

        const steps = Math.max(32, border * 4);
        for (let i = 0; i < steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          const dx = Math.cos(angle) * border;
          const dy = Math.sin(angle) * border;
          octx.drawImage(processedImage, border + dx, border + dy, imgW, imgH);
        }

        octx.globalCompositeOperation = "source-in";
        octx.fillStyle = borderColor;
        octx.fillRect(0, 0, totalW, totalH);

        ctx.drawImage(offscreen, 0, 0);
      }

      ctx.drawImage(processedImage, border, border, imgW, imgH);

      const mimeType = format === "png" ? "image/png" : format === "jpeg" ? "image/jpeg" : "image/webp";
      const ext = format;

      exportCanvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `sticker.${ext}`;
          a.click();
          URL.revokeObjectURL(url);
        },
        mimeType,
        format === "jpeg" ? 0.95 : undefined
      );
    },
    [processedImage, borderEnabled, borderWidth, borderColor]
  );

  // Download just the bg-removed image (no border)
  const downloadNoBorder = useCallback(() => {
    if (!removedBgBlob) return;
    const url = URL.createObjectURL(removedBgBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sticker-no-border.png";
    a.click();
    URL.revokeObjectURL(url);
  }, [removedBgBlob]);

  const reset = () => {
    setStep("upload");
    setOriginalImage(null);
    setOriginalFile(null);
    setRemovedBgBlob(null);
    setProcessedImage(null);
    setBorderWidth(8);
    setBorderEnabled(true);
    setBorderColor("#ffffff");
    setProgress(0);
    setError(null);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-extrabold text-foreground tracking-tight">Sticker Maker</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Upload · Remove background with AI · Add border · Download
        </p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-1.5 mb-6">
        {[
          { key: "upload", label: "Upload" },
          { key: "processing", label: "Remove BG" },
          { key: "edit", label: "Edit" },
          { key: "download", label: "Download" },
        ].map((s, i) => {
          const isActive = s.key === step;
          const isDone =
            (s.key === "upload" && step !== "upload") ||
            (s.key === "processing" && (step === "edit" || step === "download")) ||
            (s.key === "edit" && step === "download");
          return (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <div className={`flex-1 h-px ${isDone ? "bg-primary" : "bg-border"}`} />
              )}
              <div
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isDone
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {s.label}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-destructive flex items-center gap-2.5">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}

      {step === "upload" && (
        <div
          className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-12 cursor-pointer transition-all duration-300 hover:border-primary/40 hover:bg-primary/[0.03] card-hover"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
            <svg
              className="h-7 w-7 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-foreground">Drop an image or click to upload</p>
          <p className="mt-1 text-xs text-muted-foreground">JPG, PNG — AI will remove the background</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* Processing */}
      {step === "processing" && (
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card p-14">
          <div className="relative mb-6">
            {originalImage && (
              <img src={originalImage.src} alt="Original" className="w-44 h-44 object-cover rounded-2xl opacity-40 blur-[2px]" />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-primary border-t-transparent" />
            </div>
          </div>
          <p className="text-base font-bold text-foreground">Removing background...</p>
          <p className="text-xs text-muted-foreground mt-1">
            {progress < 50 ? "Loading AI model..." : progress < 90 ? "Processing image..." : "Almost done..."}
          </p>
          <div className="w-64 mt-4 bg-muted rounded-full h-2 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 font-mono tabular-nums">{progress}%</p>
        </div>
      )}

      {/* Edit */}
      {(step === "edit" || step === "download") && processedImage && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-1 w-full space-y-4">
            <div className="rounded-2xl border bg-card p-4 flex flex-col items-center">
              <p className="mb-3 section-label">Sticker Preview</p>
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className="max-w-full rounded-xl"
                style={{ aspectRatio: "1/1", width: "100%", maxWidth: CANVAS_SIZE }}
              />
            </div>

            {/* Border Controls */}
            <div className="rounded-2xl border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <label className="input-label">Border</label>
                <button
                  onClick={() => setBorderEnabled(!borderEnabled)}
                  className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${
                    borderEnabled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span className={`absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${borderEnabled ? "translate-x-[18px]" : ""}`} />
                </button>
              </div>

              {borderEnabled && (
                <>
                  <div className="flex items-center gap-4">
                    <label className="input-label w-16">Thickness</label>
                    <input type="range" min={BORDER_MIN} max={BORDER_MAX} step={1} value={borderWidth} onChange={(e) => setBorderWidth(parseInt(e.target.value))} className="flex-1" />
                    <span className="bg-muted px-2 py-1 rounded-md text-xs font-mono font-semibold text-foreground min-w-[42px] text-center">{borderWidth}px</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="input-label w-16">Color</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {["#ffffff", "#000000", "#ff0000", "#00ff00", "#0000ff", "#ffff00"].map(
                        (color) => (
                          <button
                            key={color}
                            onClick={() => setBorderColor(color)}
                            className={`w-7 h-7 rounded-lg border-2 transition-all duration-150 ${
                              borderColor === color
                                ? "border-primary scale-110 ring-2 ring-primary/25"
                                : "border-border hover:border-muted-foreground"
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        )
                      )}
                      <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="w-7 h-7 rounded-lg cursor-pointer border border-border" />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={reset} className="btn-ghost">Start Over</button>
              <button onClick={() => fileInputRef.current?.click()} className="btn-ghost">Try Another</button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    reset();
                    setTimeout(() => handleFile(e.target.files![0]), 50);
                  }
                }}
              />
            </div>
          </div>

          {/* Right panel */}
          <div className="w-full lg:w-72 space-y-4">
            <div className="rounded-2xl border bg-card p-4">
              <p className="section-label mb-3">Before & After</p>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1 text-center">Original</p>
                  {originalImage && (
                    <img src={originalImage.src} alt="Original" className="w-full aspect-square object-cover rounded-xl border" />
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1 text-center">Processed</p>
                  <div className="w-full aspect-square rounded-xl border overflow-hidden checkerboard-bg">
                    <img src={processedImage.src} alt="Processed" className="w-full h-full object-contain" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-4 space-y-2.5">
              <p className="section-label mb-1">Download</p>
              <button onClick={() => downloadSticker("png")} className="btn-primary w-full py-3">
                Download PNG
              </button>
              <div className="flex gap-2">
                <button onClick={() => downloadSticker("webp")} className="btn-secondary flex-1">WebP</button>
                <button onClick={() => downloadSticker("jpeg")} className="btn-secondary flex-1">JPEG</button>
              </div>
              <hr className="border-border" />
              <button onClick={downloadNoBorder} className="btn-ghost w-full">Without Border (PNG)</button>
              <p className="text-[10px] text-muted-foreground text-center">PNG preserves transparency</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** Draw a checkerboard pattern for transparency indication */
function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const size = 12;
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      ctx.fillStyle =
        (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0
          ? "#2a2a2a"
          : "#1a1a1a";
      ctx.fillRect(x, y, size, size);
    }
  }
}

export default StickerMaker;
