import React, { useRef, useState, useCallback, useEffect } from "react";

// Physical sizes in mm
const OUTER_MM = 70;
const INNER_MM = 58;

// Canvas pixel size for drawing
const CANVAS_PX = 400;
const OUTER_PX = CANVAS_PX;
const INNER_PX = (INNER_MM / OUTER_MM) * CANVAS_PX;

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
  const [imageState, setImageState] = useState<ImageState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, imgX: 0, imgY: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Draw everything
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const preview = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const cx = CANVAS_PX / 2;
    const cy = CANVAS_PX / 2;

    // Clear
    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);

    // Light gray background
    ctx.fillStyle = "hsl(210, 14%, 91%)";
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);

    // Clip to 70mm circle and draw image
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, OUTER_PX / 2, 0, Math.PI * 2);
    ctx.clip();

    // White circle background
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    if (imageState) {
      ctx.save();
      ctx.translate(cx + imageState.x, cy + imageState.y);
      ctx.rotate((imageState.rotation * Math.PI) / 180);
      ctx.scale(imageState.scale, imageState.scale);
      ctx.drawImage(
        imageState.img,
        -imageState.img.width / 2,
        -imageState.img.height / 2
      );
      ctx.restore();
    }
    ctx.restore();

    // Draw outer 70mm circle (solid black)
    ctx.beginPath();
    ctx.arc(cx, cy, OUTER_PX / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw inner 58mm guide circle (dashed green)
    ctx.beginPath();
    ctx.arc(cx, cy, INNER_PX / 2, 0, Math.PI * 2);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "hsl(145, 55%, 42%)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw 58mm preview
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
        pCtx.drawImage(
          imageState.img,
          -imageState.img.width / 2,
          -imageState.img.height / 2
        );
        pCtx.restore();
      }
      pCtx.restore();

      // Circle border
      pCtx.beginPath();
      pCtx.arc(pSize / 2, pSize / 2, pSize / 2 - 1, 0, Math.PI * 2);
      pCtx.strokeStyle = "hsl(145, 55%, 42%)";
      pCtx.lineWidth = 2;
      pCtx.stroke();
    }
  }, [imageState]);

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
        // Fit image to fill the 70mm circle
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
    dragStart.current = {
      x: coords.x,
      y: coords.y,
      imgX: imageState.x,
      imgY: imageState.y,
    };
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !imageState) return;
    const coords = getCanvasCoords(e);
    const dx = coords.x - dragStart.current.x;
    const dy = coords.y - dragStart.current.y;
    setImageState((prev) =>
      prev
        ? {
            ...prev,
            x: dragStart.current.imgX + dx,
            y: dragStart.current.imgY + dy,
          }
        : prev
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

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "Button Badge Artwork – 70 mm",
                  bold: true,
                  size: 32,
                }),
              ],
            }),
            new Paragraph({ children: [] }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: new Uint8Array(fullBuf),
                  transformation: { width: 265, height: 265 },
                  type: "png",
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200 },
              children: [
                new TextRun({
                  text: "Print this 70 mm circular image as button badge artwork.",
                  italics: true,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({ children: [] }),
            new Paragraph({ children: [] }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "Visible Badge Area – 58 mm",
                  bold: true,
                  size: 28,
                }),
              ],
            }),
            new Paragraph({ children: [] }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: new Uint8Array(innerBuf),
                  transformation: { width: 220, height: 220 },
                  type: "png",
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200 },
              children: [
                new TextRun({
                  text: "This is the visible 58 mm area that will appear on the button badge.",
                  italics: true,
                  size: 22,
                }),
              ],
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "button_badge_artwork.docx");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">
          Button Badge Image Cutter{" "}
          <span className="text-muted-foreground font-mono text-base">(70 mm – 58 mm)</span>
        </h1>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left: Main canvas area */}
          <div className="flex-1 w-full">
            {/* Upload zone (shown when no image) */}
            {!imageState && (
              <div
                className="mb-6 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card p-12 cursor-pointer transition-colors hover:border-primary hover:bg-muted/50"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="mb-4 h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm font-medium text-foreground">Drop an image here or click to upload</p>
                <p className="mt-1 text-xs text-muted-foreground">JPG, PNG supported</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
            )}

            {/* Canvas */}
            <div className="rounded-lg border border-tool-border bg-canvas p-4 flex flex-col items-center">
              <p className="mb-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                70 mm Artwork Canvas
              </p>
              <canvas
                ref={canvasRef}
                width={CANVAS_PX}
                height={CANVAS_PX}
                className="max-w-full rounded cursor-grab active:cursor-grabbing touch-none"
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

            {/* Controls */}
            {imageState && (
              <div className="mt-4 rounded-lg border border-tool-border bg-card p-4 space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider w-16">Zoom</label>
                  <input
                    type="range"
                    min="0.2"
                    max="5"
                    step="0.01"
                    value={zoom}
                    onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-xs font-mono text-foreground w-14 text-right">{(zoom * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-4">
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider w-16">Rotate</label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={rotation}
                    onChange={(e) => handleRotationChange(parseInt(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-xs font-mono text-foreground w-14 text-right">{rotation}°</span>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Replace Image
                  </button>
                  <button
                    className="rounded bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    onClick={() => { handleZoomChange(1); handleRotationChange(0); setImageState(prev => prev ? { ...prev, x: 0, y: 0 } : prev); }}
                  >
                    Reset Position
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
            )}
          </div>

          {/* Right: Preview + Download */}
          <div className="w-full lg:w-72 space-y-6">
            {/* 58mm preview */}
            <div className="rounded-lg border border-tool-border bg-card p-4 flex flex-col items-center">
              <p className="mb-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                Visible Badge Area (58 mm)
              </p>
              <canvas
                ref={previewCanvasRef}
                width={200}
                height={200}
                className="rounded-full"
                style={{ width: 200, height: 200 }}
              />
            </div>

            {/* Legend */}
            <div className="rounded-lg border border-tool-border bg-card p-4 space-y-2">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Guide</p>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-6 bg-foreground" />
                <span className="text-xs text-foreground">70 mm – Cut boundary</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-6 border-t-2 border-dashed border-accent" />
                <span className="text-xs text-foreground">58 mm – Visible area</span>
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={generateDocx}
              disabled={!imageState}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Generate Word Report
            </button>
            <p className="text-xs text-muted-foreground text-center -mt-4">
              Downloads as <span className="font-mono">button_badge_artwork.docx</span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BadgeEditor;
