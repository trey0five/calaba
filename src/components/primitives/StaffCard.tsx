import { CSSProperties, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * A team card composed at runtime instead of designed by hand.
 *
 *   headshot  →  `public/staff-frame.webp`  →  live name + title text
 *
 * The frame is the original card artwork with an elliptical TRANSPARENT hole
 * punched where the photo goes and the baked-in lettering painted out, so a new
 * hire only ever needs a plain head-and-shoulders photo.
 *
 * Every number below is a percentage of the 900 x 1100 frame, measured off the
 * original `public/eric-andrade.webp` design, so the composite is proportional
 * to it at any rendered size.
 */

/** Photo aperture, as percentages of the frame. Measured from the frame's
 *  alpha channel: x 202..704, y 380..890 of 900 x 1100. */
const HOLE = {
  left: '22.444%',
  top: '34.545%',
  width: '55.778%',
  height: '46.364%',
} as const;

const FRAME_W = 900;
const FRAME_H = 1100;

/**
 * The design was drawn around "Erick Andrade" / "Lead RBT". A longer name has
 * to shrink or it runs off the card — CSS alone can't see how long a string is,
 * so scale the type down in proportion to the character count past the length
 * the layout was tuned for. Result: the lettering keeps roughly the same width
 * on the card whoever gets hired.
 */
const fit = (text: string, tunedFor: number) =>
  Math.min(1, tunedFor / Math.max(text.trim().length, 1));

export interface StaffCardProps {
  /** Plain headshot — bundled path or absolute S3 URL. */
  photoUrl: string;
  name: string;
  title: string;
  className?: string;
  /** Above the fold: load eagerly instead of lazily. */
  priority?: boolean;
}

export default function StaffCard({
  photoUrl,
  name,
  title,
  className,
  priority = false,
}: StaffCardProps) {
  // A dead photo URL must degrade to the frame + logo, never to a broken image.
  // Remembering WHICH url failed (rather than a bare boolean) means the admin's
  // live preview recovers the moment a different photo is picked.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photoFailed = !!photoUrl && failedUrl === photoUrl;
  const base = import.meta.env.BASE_URL;

  return (
    <div
      className={cn(
        'staff-card relative aspect-[9/11] overflow-hidden rounded-3xl bg-bg-deep',
        className,
      )}
      data-staff-card
    >
      {/* 1 — the headshot, sitting in the frame's aperture */}
      <div className="absolute overflow-hidden rounded-full" style={HOLE}>
        {photoFailed || !photoUrl ? (
          <div className="absolute inset-0 grid place-items-center bg-bg-deep">
            <img
              src={`${base}calaba2.png`}
              alt=""
              width={512}
              height={512}
              loading="lazy"
              decoding="async"
              className="h-2/5 w-auto opacity-90"
            />
          </div>
        ) : (
          <img
            src={photoUrl}
            alt={title ? `${name}, ${title} at CAL-ABA` : `${name} at CAL-ABA`}
            width={800}
            height={800}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setFailedUrl(photoUrl)}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        )}
      </div>

      {/* 2 — the frame. Its transparent aperture reveals the photo and its ring
              overlaps the photo edge exactly as in the original design. */}
      <img
        src={`${base}staff-frame.webp`}
        alt=""
        aria-hidden="true"
        width={FRAME_W}
        height={FRAME_H}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />

      {/* 3 — the identity, as real text. Anchored to the BOTTOM so a long name
              wraps upward into the sparkle field instead of off the card. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[1.3%] px-[5%] text-center">
        <p
          className="staff-card-name"
          style={{ '--staff-name-fit': fit(name, 15) } as CSSProperties}
        >
          {name}
        </p>
        {title && (
          <div className="staff-card-rule-row">
            <span className="staff-card-rule" aria-hidden="true" />
            <p
              className="staff-card-title"
              style={{ '--staff-title-fit': fit(title, 20) } as CSSProperties}
            >
              {title}
            </p>
            <span className="staff-card-rule staff-card-rule--right" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  );
}
