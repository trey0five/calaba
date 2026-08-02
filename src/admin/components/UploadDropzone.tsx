import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/cn';
import { easeOutExpo, usePrefersReducedMotion } from '@/lib/motion';

export interface ProcessedPhoto {
  /** base64 WITHOUT the data: prefix — what the API expects */
  data: string;
  contentType: string;
  w: number;
  h: number;
  /** object URL for the live preview */
  preview: string;
}

const MAX_EDGE = 1200;

/** Decode with createImageBitmap where available, else an <img>. */
async function decode(file: File): Promise<{ source: CanvasImageSource; w: number; h: number }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, w: bitmap.width, h: bitmap.height };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read that image.'));
      el.src = url;
    });
    return { source: img, w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    // The canvas has already drawn from it by the time we revoke.
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

/**
 * Resize to <=1200px on the long edge and re-encode as WebP BEFORE upload:
 * a phone photo is 4-8MB, and the API caps the decoded payload at 2MB.
 */
export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const { source, w, h } = await decode(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process that image.');
  ctx.drawImage(source, 0, 0, outW, outH);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.85),
  );
  if (!blob) throw new Error('Could not convert that image.');

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the converted image.'));
    reader.readAsDataURL(blob);
  });

  return {
    data: dataUrl.split(',')[1] ?? '',
    contentType: blob.type || 'image/webp',
    w: outW,
    h: outH,
    preview: URL.createObjectURL(blob),
  };
}

export default function UploadDropzone({
  currentPhoto,
  onPicked,
  onError,
  busy,
  done,
}: {
  currentPhoto?: string | null;
  onPicked: (photo: ProcessedPhoto) => void;
  onError: (message: string) => void;
  /** true while the parent is uploading — draws the progress hairline */
  busy?: boolean;
  done?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);
  const reduced = usePrefersReducedMotion();

  const handle = async (file: File | null | undefined) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      onError('Please choose a JPG, PNG or WebP image.');
      return;
    }
    setWorking(true);
    try {
      onPicked(await processPhoto(file));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not read that image.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        // sr-only, not hidden — but it must stay out of the tab order, since the
        // visible dropzone button is the real control.
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <motion.button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handle(e.dataTransfer.files?.[0]);
        }}
        animate={reduced ? undefined : { scale: dragging ? 1.02 : 1 }}
        transition={{ duration: 0.2, ease: easeOutExpo }}
        className={cn(
          'relative block w-full overflow-hidden rounded-2xl border-2 border-dashed p-6 text-center transition',
          dragging
            ? 'border-teal-bright bg-teal-bright/10'
            : 'border-white/25 bg-white/[0.05] hover:border-teal-bright/50',
        )}
      >
        {currentPhoto && (
          <img
            src={currentPhoto}
            alt=""
            className="mx-auto mb-4 h-28 w-28 rounded-2xl object-cover ring-1 ring-white/15"
          />
        )}

        <span
          className={cn(
            'mx-auto grid h-12 w-12 place-items-center rounded-full transition',
            done
              ? 'bg-teal-bright/20 text-teal-bright shadow-glow-teal'
              : 'bg-white/10 text-teal-bright',
          )}
        >
          {done ? (
            <motion.span
              initial={reduced ? false : { scale: 0.4, opacity: 0 }}
              animate={reduced ? undefined : { scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: easeOutExpo }}
            >
              <Check size={22} strokeWidth={3} />
            </motion.span>
          ) : (
            <UploadCloud size={22} />
          )}
        </span>

        <span className="mt-3 block text-[15px] font-semibold text-text-light">
          <span className="hidden sm:inline">
            {working ? 'Preparing your photo…' : 'Drop a photo or click to choose'}
          </span>
          <span className="sm:hidden">
            {working ? 'Preparing your photo…' : 'Tap to choose a photo'}
          </span>
        </span>
        <span className="mt-1 block text-xs text-text-light/60">
          JPG/PNG/WebP · portrait works best (4:5) · converted to WebP on upload
        </span>

        {(busy || working) && (
          <span className="absolute inset-x-0 bottom-0 h-[1.5px] overflow-hidden">
            {/* An infinitely looping sweep is exactly what prefers-reduced-motion
                exists to stop; a static bar carries the same meaning. */}
            {reduced ? (
              <span
                className="block h-full w-full"
                style={{ background: 'linear-gradient(90deg, #2FE0D8, #FF6FB0)' }}
              />
            ) : (
              <motion.span
                className="block h-full w-1/3"
                style={{ background: 'linear-gradient(90deg, #2FE0D8, #FF6FB0)' }}
                initial={{ x: '-100%' }}
                animate={{ x: '300%' }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </span>
        )}
      </motion.button>
    </div>
  );
}
