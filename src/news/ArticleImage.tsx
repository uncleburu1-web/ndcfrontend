/** Reserves the image's size so the page doesn't jump while it loads. */
import type { ArticleImage as Img } from "./types";

export function ArticleImage({ image, thumb = false, alt = "" }: { image: Img; thumb?: boolean; alt?: string }) {
  const src = thumb ? image.url_thumb : image.url ?? image.url_thumb;
  return (
    <img
      src={src}
      alt={alt}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      loading="lazy"
      className={thumb ? "article-thumb" : "article-image"}
    />
  );
}
