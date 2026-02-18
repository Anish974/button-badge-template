import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";

// Badge size presets
const BADGE_SIZES = [
  { label: "70 / 58 mm", outerMm: 70, innerMm: 58 },
  { label: "54 / 44 mm", outerMm: 54, innerMm: 44 },
] as const;

// Canvas pixel size for drawing
const CANVAS_PX = 400;

interface ImageState {
  img: HTMLImageElement;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

const BadgeEditor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [sizeIndex, setSizeIndex] = useState(0);
  const [imageState, setImageState] = useState<ImageState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, imgX: 0, imgY: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const badgeSize = BADGE_SIZES[sizeIndex];
  const OUTER_PX = CANVAS_PX;
  const INNER_PX = useMemo(() => (badgeSize.innerMm / badgeSize.outerMm) * CANVAS_PX, [badgeSize]);

  // Re-fit image when badge size changes
  useEffect(() => {
    if (!imageState) return;
    const baseScale = Math.max(OUTER_PX / imageState.img.width, OUTER_PX / imageState.img.height);
    setImageState(prev => prev ? { ...prev, scale: baseScale * zoom } : prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeIndex]);

  // Draw everything
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const preview = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const cx = CANVAS_PX / 2;
    const cy = CANVAS_PX / 2;

    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    ctx.fillStyle = "hsl(0, 0%, 12%)"; // Dark canvas background
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);

    // Clip to outer circle and draw image
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, OUTER_PX / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    if (imageState) {
      ctx.save();
      ctx.translate(cx + imageState.x, cy + imageState.y);
      ctx.rotate((imageState.rotation * Math.PI) / 180);
      ctx.scale(imageState.scale, imageState.scale);
      ctx.drawImage(imageState.img, -imageState.img.width / 2, -imageState.img.height / 2);
      ctx.restore();
    }
    ctx.restore();

    // Outer circle (solid black)
    ctx.beginPath();
    ctx.arc(cx, cy, OUTER_PX / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "hsl(43, 74%, 49%)"; // Golden outer cut line
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner guide circle (dashed green)
    ctx.beginPath();
    ctx.arc(cx, cy, INNER_PX / 2, 0, Math.PI * 2);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "hsl(48, 100%, 50%)"; // Chrome Yellow guide
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // Inner preview canvas
    if (preview) {
      const pCtx = preview.getContext("2d")!;
      const pSize = preview.width;
      pCtx.clearRect(0, 0, pSize, pSize);
      pCtx.save();
      pCtx.beginPath();
      pCtx.arc(pSize / 2, pSize / 2, pSize / 2, 0, Math.PI * 2);
      pCtx.clip();
      pCtx.fillStyle = "#ffffff";
      pCtx.fill();

      if (imageState) {
        const previewScale = pSize / INNER_PX;
        pCtx.save();
        pCtx.translate(pSize / 2, pSize / 2);
        pCtx.scale(previewScale, previewScale);
        pCtx.translate(imageState.x, imageState.y);
        pCtx.rotate((imageState.rotation * Math.PI) / 180);
        pCtx.scale(imageState.scale, imageState.scale);
        pCtx.drawImage(imageState.img, -imageState.img.width / 2, -imageState.img.height / 2);
        pCtx.restore();
      }
      pCtx.restore();


    }
  }, [imageState, OUTER_PX, INNER_PX]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Load image
  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const fitScale = Math.max(OUTER_PX / img.width, OUTER_PX / img.height);
        setZoom(1);
        setRotation(0);
        setImageState({ img, x: 0, y: 0, scale: fitScale, rotation: 0 });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Pan handlers
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleRatio = CANVAS_PX / rect.width;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleRatio,
        y: (e.touches[0].clientY - rect.top) * scaleRatio,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleRatio,
      y: (e.clientY - rect.top) * scaleRatio,
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!imageState) return;
    const coords = getCanvasCoords(e);
    setIsDragging(true);
    dragStart.current = { x: coords.x, y: coords.y, imgX: imageState.x, imgY: imageState.y };
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !imageState) return;
    const coords = getCanvasCoords(e);
    const dx = coords.x - dragStart.current.x;
    const dy = coords.y - dragStart.current.y;
    setImageState((prev) =>
      prev ? { ...prev, x: dragStart.current.imgX + dx, y: dragStart.current.imgY + dy } : prev
    );
  };

  const handlePointerUp = () => setIsDragging(false);

  // Zoom
  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
    setImageState((prev) => {
      if (!prev) return prev;
      const baseScale = Math.max(OUTER_PX / prev.img.width, OUTER_PX / prev.img.height);
      return { ...prev, scale: baseScale * newZoom };
    });
  };

  // Rotation
  const handleRotationChange = (newRot: number) => {
    setRotation(newRot);
    setImageState((prev) => (prev ? { ...prev, rotation: newRot } : prev));
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const newZoom = Math.max(0.2, Math.min(5, zoom + delta));
    handleZoomChange(newZoom);
  };

  // Export helpers
  const getFullCircleBlob = (): Promise<Blob> => {
    return new Promise((resolve) => {
      const offCanvas = document.createElement("canvas");
      offCanvas.width = CANVAS_PX;
      offCanvas.height = CANVAS_PX;
      const ctx = offCanvas.getContext("2d")!;
      const cx = CANVAS_PX / 2;
      ctx.beginPath();
      ctx.arc(cx, cx, OUTER_PX / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      if (imageState) {
        ctx.save();
        ctx.translate(cx + imageState.x, cx + imageState.y);
        ctx.rotate((imageState.rotation * Math.PI) / 180);
        ctx.scale(imageState.scale, imageState.scale);
        ctx.drawImage(imageState.img, -imageState.img.width / 2, -imageState.img.height / 2);
        ctx.restore();
      }

      // Draw outer cut line
      ctx.beginPath();
      ctx.arc(cx, cx, OUTER_PX / 2, 0, Math.PI * 2);
      ctx.strokeStyle = "#000000"; // Black cut line for visibility
      ctx.lineWidth = 2;
      ctx.stroke();
      offCanvas.toBlob((blob) => resolve(blob!), "image/png");
    });
  };

  const getInnerCircleBlob = (): Promise<Blob> => {
    return new Promise((resolve) => {
      const size = Math.round(INNER_PX);
      const offCanvas = document.createElement("canvas");
      offCanvas.width = size;
      offCanvas.height = size;
      const ctx = offCanvas.getContext("2d")!;
      const cx = size / 2;
      ctx.beginPath();
      ctx.arc(cx, cx, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      if (imageState) {
        const previewScale = size / INNER_PX;
        ctx.save();
        ctx.translate(cx, cx);
        ctx.scale(previewScale, previewScale);
        ctx.translate(imageState.x, imageState.y);
        ctx.rotate((imageState.rotation * Math.PI) / 180);
        ctx.scale(imageState.scale, imageState.scale);
        ctx.drawImage(imageState.img, -imageState.img.width / 2, -imageState.img.height / 2);
        ctx.restore();
      }
      offCanvas.toBlob((blob) => resolve(blob!), "image/png");
    });
  };

  const generateDocx = async () => {
    const { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } = await import("docx");
    const { saveAs } = await import("file-saver");

    const [fullBlob, innerBlob] = await Promise.all([getFullCircleBlob(), getInnerCircleBlob()]);
    const fullBuf = await fullBlob.arrayBuffer();
    const innerBuf = await innerBlob.arrayBuffer();

    const outerMm = badgeSize.outerMm;
    const innerMm = badgeSize.innerMm;
    // Scale Word images proportionally to actual mm size (70mm → 265px baseline)
    const fullImgSize = Math.round(265 * (outerMm / 70));
    const innerImgSize = Math.round(220 * (innerMm / 58));

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: `Button Badge Artwork – ${outerMm} mm`, bold: true, size: 32 }),
              ],
            }),
            new Paragraph({ children: [] }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({ data: new Uint8Array(fullBuf), transformation: { width: fullImgSize, height: fullImgSize }, type: "png" }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200 },
              children: [
                new TextRun({ text: `Print this ${outerMm} mm circular image as button badge artwork.`, italics: true, size: 22 }),
              ],
            }),
            new Paragraph({ children: [] }),
            new Paragraph({ children: [] }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: `Visible Badge Area – ${innerMm} mm`, bold: true, size: 28 }),
              ],
            }),
            new Paragraph({ children: [] }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({ data: new Uint8Array(innerBuf), transformation: { width: innerImgSize, height: innerImgSize }, type: "png" }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200 },
              children: [
                new TextRun({ text: `This is the visible ${innerMm} mm area that will appear on the button badge.`, italics: true, size: 22 }),
              ],
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "button_badge_artwork.docx");
  };

  const downloadPreview = async () => {
    const { saveAs } = await import("file-saver");
    const blob = await getInnerCircleBlob();
    saveAs(blob, `button_badge_preview_${badgeSize.innerMm}mm.png`);
  };

  const downloadTemplate = async () => {
    const { saveAs } = await import("file-saver");
    const blob = await getFullCircleBlob();
    saveAs(blob, `button_badge_template_${badgeSize.outerMm}mm.png`);
  };

  return (
    <div className="bg-background min-h-[calc(100vh-3.5rem)]">
      {/* Size bar */}
      <div className="border-b bg-card/60 px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-foreground tracking-tight">Badge Image Cutter</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            <span className="font-mono font-medium">{badgeSize.outerMm}mm</span> outer · <span className="font-mono font-medium">{badgeSize.innerMm}mm</span> visible
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="section-label">Size</span>
          <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
            {BADGE_SIZES.map((s, i) => (
              <button
                key={i}
                onClick={() => setSizeIndex(i)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${i === sizeIndex
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                  }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left: Canvas */}
          <div className="flex-1 w-full space-y-4">
            {!imageState && (
              <div
                className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-12 cursor-pointer transition-all duration-300 hover:border-primary/40 hover:bg-primary/[0.03] card-hover"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-foreground">Drop an image or click to upload</p>
                <p className="mt-1 text-xs text-muted-foreground">JPG, PNG</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
            )}

            <div className="rounded-2xl border bg-card p-4 flex flex-col items-center">
              <p className="mb-3 section-label">
                {badgeSize.outerMm}mm Canvas
              </p>
              <canvas
                ref={canvasRef}
                width={CANVAS_PX}
                height={CANVAS_PX}
                className="max-w-full rounded-xl cursor-grab active:cursor-grabbing touch-none ring-1 ring-border/50"
                style={{ aspectRatio: "1/1", width: "100%", maxWidth: CANVAS_PX }}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
                onWheel={handleWheel}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              />
            </div>

            {imageState && (
              <div className="rounded-2xl border bg-card p-4 space-y-4">
                <div className="flex items-center gap-4">
                  <label className="input-label w-14">Zoom</label>
                  <input type="range" min="0.2" max="5" step="0.01" value={zoom} onChange={(e) => handleZoomChange(parseFloat(e.target.value))} className="flex-1" />
                  <span className="text-xs font-mono font-semibold text-foreground bg-muted px-2 py-1 rounded-md min-w-[48px] text-center">{(zoom * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-4">
                  <label className="input-label w-14">Rotate</label>
                  <input type="range" min="-180" max="180" step="1" value={rotation} onChange={(e) => handleRotationChange(parseInt(e.target.value))} className="flex-1" />
                  <span className="text-xs font-mono font-semibold text-foreground bg-muted px-2 py-1 rounded-md min-w-[48px] text-center">{rotation}°</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <button className="btn-ghost" onClick={() => fileInputRef.current?.click()}>Replace Image</button>
                  <button className="btn-ghost" onClick={() => { handleZoomChange(1); handleRotationChange(0); setImageState(prev => prev ? { ...prev, x: 0, y: 0 } : prev); }}>Reset</button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>
            )}
          </div>

          {/* Right: Preview + Actions */}
          <div className="w-full lg:w-72 space-y-4">
            <div className="rounded-2xl border bg-card p-4 flex flex-col items-center">
              <p className="mb-3 section-label">Preview · {badgeSize.innerMm}mm</p>
              <div className="p-2 rounded-full bg-muted/40">
                <canvas ref={previewCanvasRef} width={200} height={200} className="rounded-full ring-1 ring-border/50" style={{ width: 200, height: 200 }} />
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-4 space-y-2.5">
              <p className="section-label">Guide</p>
              <div className="flex items-center gap-3">
                <span className="inline-block h-0.5 w-5 rounded bg-primary" />
                <span className="text-xs text-muted-foreground">{badgeSize.outerMm}mm — Cut line</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-primary/50" />
                <span className="text-xs text-muted-foreground">{badgeSize.innerMm}mm — Visible</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <button onClick={generateDocx} disabled={!imageState} className="btn-primary w-full py-3">
                Generate Word Report
              </button>
              <div className="flex gap-2 w-full">
                <button onClick={downloadPreview} disabled={!imageState} className="btn-secondary flex-1 disabled:opacity-30 disabled:cursor-not-allowed">
                  Preview
                </button>
                <button onClick={downloadTemplate} disabled={!imageState} className="btn-secondary flex-1 disabled:opacity-30 disabled:cursor-not-allowed">
                  Template
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Exports as <span className="font-mono">button_badge_artwork.docx</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BadgeEditor;
