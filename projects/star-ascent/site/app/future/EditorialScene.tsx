type EditorialSceneProps = Readonly<{
  eyebrow: string;
  title: string;
  body: string;
  image: string;
  imageAlt: string;
  video: string;
  caption: string;
  videoFallback: string;
}>;

export function EditorialScene({ eyebrow, title, body, image, imageAlt, video, caption, videoFallback }: EditorialSceneProps) {
  return (
    <section className="editorial-scene" aria-label={title}>
      <div className="editorial-scene-copy">
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        <span>{body}</span>
      </div>
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element -- original generated editorial master is a local static asset */}
        <img src={image} alt={imageAlt} />
        <figcaption>{caption}</figcaption>
      </figure>
      <video controls playsInline preload="metadata" poster={image}>
        <source src={video} type="video/mp4" />
        {videoFallback}
      </video>
    </section>
  );
}
