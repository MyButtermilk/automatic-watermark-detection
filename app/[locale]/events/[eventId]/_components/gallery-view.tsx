import type { GalleryItem } from "@prisma/client";
import Image from "next/image";

interface GalleryViewProps {
  items: GalleryItem[];
}

export function GalleryView({ items }: GalleryViewProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Für diesen Abend gibt es noch keine Bilder.</p>;
  }

  return (
    // Masonry grid using CSS columns
    <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
      {items.map((item) => (
        <div key={item.id} className="break-inside-avoid-column">
          <figure className="bg-card p-2 rounded-lg border">
            <Image
              src={item.url}
              alt={item.caption || "Galeriebild"}
              width={500}
              height={500}
              className="w-full h-auto rounded-md object-cover"
            />
            {item.caption &&
              <figcaption className="mt-2 text-sm text-center text-muted-foreground">
                {item.caption}
              </figcaption>
            }
          </figure>
        </div>
      ))}
    </div>
  );
}
