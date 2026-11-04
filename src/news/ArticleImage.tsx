/** Reserves the image's size so the page doesn't jump while it loads. */
import type { ArticleImage as Img } from "./types";

export function ArticleImage({ image, thumb = false, alt = "" }: { image: Img; thumb?: boolean; alt?: string }) {
  const src = thumb ? image.url_thumb : image.url ?? image.url_thumb;
  // spec 15 §7.5: full width on phones; 7rem thumbnails on wider screens, 720px article images
  const sizes = thumb ? "(max-width: 30rem) 100vw, 7rem" : "(max-width: 48rem) 100vw, 720px";
  return (
    <img
      src={src}
      srcSet={image.srcset ?? undefined}
      sizes={image.srcset ? sizes : undefined}
      alt={alt}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      loading="lazy"
      className={thumb ? "article-thumb" : "article-image"}
    />
  );
}
