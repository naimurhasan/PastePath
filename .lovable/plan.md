

## Problem: Canvas Resolution Loss

The root cause is on line 113 of `AnnotationCanvas.tsx`:

```
setCanvasSize({ width: img.width * scale, height: img.height * scale });
```

When `scale < 1` (which it is for any image larger than the viewport), the canvas's **internal pixel resolution** is reduced to the display size. A 2000x1200 image becomes a 800x480 canvas. The image is permanently downsampled via `drawImage(img, 0, 0, 800, 480)`.

## Solution: Full-Resolution Internal Canvas, CSS-Scaled Display

**Keep the canvas at the original image resolution** but use CSS `width`/`height` to display it smaller. This is how professional annotation tools work.

### Changes to `AnnotationCanvas.tsx`:

1. **Store two sizes**: `naturalSize` (original image dimensions for canvas `width`/`height` attributes) and `displaySize` (CSS dimensions for visual fit).

2. **Canvas element**: Set `width={naturalSize.width} height={naturalSize.height}` but apply `style={{ width: displaySize.width, height: displaySize.height }}`.

3. **`drawImage` at full res**: `ctx.drawImage(img, 0, 0, naturalSize.width, naturalSize.height)` -- no downsampling.

4. **`getPos` already handles this** -- it uses `canvas.width / rect.width` scaling, so annotation coordinates will automatically map to full-res space.

5. **Annotation sizes**: Scale `activeSize` by the ratio `naturalSize.width / displaySize.width` so strokes appear visually consistent regardless of image resolution.

6. **`toBlob`/`toDataURL`** will now export at full resolution automatically.

### Changes to `ImagePanel.tsx`:

- Pass a `displayScale` or nothing -- the canvas component handles it internally. No changes needed here.

### Summary of key edits in `AnnotationCanvas.tsx`:

- Replace `canvasSize` state with `naturalSize` + `displaySize`
- Image load: `naturalSize = { width: img.width, height: img.height }`, `displaySize = { width: img.width * scale, height: img.height * scale }`
- Canvas element: `width={naturalSize.width} height={naturalSize.height}` + CSS style for display size
- `drawImage(img, 0, 0, naturalSize.width, naturalSize.height)`
- Remove `max-w-full` class on canvas (CSS dimensions handle sizing)

