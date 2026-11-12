/**
 * Election Campaign OS — one video slot for any page. Looks the id up in the promo videos, then in the hosted
 * explainers, and renders nothing for an id that is neither (so a mistyped id cannot show an empty player).
 * No autoplay, nothing downloaded until played, captions on, and the words as text beneath.
 */
import { PromoPlayer } from './PromoPlayer';
import { EXPLAINERS, hostedUrls } from './explainerVideos';
import { PROMO_VIDEOS } from './promoVideos';

export function SiteVideo({ id, className = '' }: { id: string; className?: string }) {
  if (PROMO_VIDEOS.some((v) => v.id === id)) return <PromoPlayer id={id} className={className} />;
  const e = EXPLAINERS.find((x) => x.id === id && x.hosted);
  if (!e) return null;
  const u = hostedUrls(e.id);
  return (
    <figure className={`m-0 ${className}`}>
      <div className="aspect-video w-full overflow-hidden rounded-[10px] bg-ink">
        <video controls playsInline preload="none" poster={u.poster} aria-label={e.title} className="h-full w-full">
          <source src={u.video} type="video/mp4" />
          <track kind="captions" src={u.captions} srcLang="en" label="English" default />
          The video cannot play in this browser. The words are below.
        </video>
      </div>
      <figcaption className="mt-2 text-site-sm text-slate">
        <strong className="font-semibold text-ink">{e.title}</strong> ({e.seconds} s). {e.readIt}
      </figcaption>
    </figure>
  );
}
