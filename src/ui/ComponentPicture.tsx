import type { CatalogItem } from '@/domain';
import { CategoryIcon } from './category-icon';
import { componentImage } from './component-image';
import { terminalBackground } from './terminal-style';

interface ComponentPictureProps {
  item: Pick<CatalogItem, 'category' | 'image' | 'terminals'>;
  className?: string;
}

/** Gambar komponen yang mengisi wadahnya; kotak berikon bila gambarnya belum ada. */
export function ComponentPicture({ item, className = '' }: ComponentPictureProps) {
  const image = componentImage(item.image);
  if (image)
    return (
      <img
        src={image.url}
        alt=""
        draggable={false}
        className={`size-full object-contain select-none ${className}`}
      />
    );

  const firstKind = item.terminals[0]?.kind;
  return (
    <div
      className={`border-control bg-card text-control flex size-full flex-col overflow-hidden rounded-lg border-2 ${className}`}
    >
      {firstKind && (
        <span className="h-2 shrink-0" style={{ background: terminalBackground(firstKind) }} />
      )}
      <span className="flex min-h-0 flex-1 items-center justify-center">
        <CategoryIcon aria-hidden category={item.category} className="size-2/5 max-h-12 max-w-12" />
      </span>
    </div>
  );
}
