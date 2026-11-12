/** A hosted promo video with its captions, and its words as text beneath so nobody has to watch. No autoplay, no sound until asked. */
import { PROMO_VIDEOS, promoUrls } from './promoVideos';

export function PromoPlayer({ id, className = '' }: { id: string; className?: string }) {
  const v = PROMO_VIDEOS.find((x) => x.id === id);
  if (!v) return null;
  const u = promoUrls(v.id);
  const portrait = v.shape === 'portrait';
  return (
    <figure className={`m-0 ${className}`}>
      <div className={`overflow-hidden rounded-[10px] bg-ink ${portrait ? 'mx-auto aspect-[9/16] max-h-[70vh]' : 'aspect-video w-full'}`}>
        <video controls playsInline preload="none" poster={u.poster} aria-label={v.title} className="h-full w-full">
          <source src={u.video} type="video/mp4" />
          <track kind="captions" src={u.captions} srcLang="en" label="English" default />
          The video cannot play in this browser. The words are below.
        </video>
      </div>
      <figcaption className="mt-2 text-site-sm text-slate">
        <strong className="font-semibold text-ink">{v.title}</strong> ({v.seconds} s). {v.readIt}
      </figcaption>
    </figure>
  );
}
