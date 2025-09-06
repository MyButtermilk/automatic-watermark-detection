"use client";

import { useTransition } from "react";
import type { Recipe, GalleryItem } from "@prisma/client";
import { deleteRecipe, deleteGalleryItem } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Image from "next/image";
import { useToast } from "@/components/ui/use-toast";

interface ContentModerationProps {
  recipes: Recipe[];
  galleryItems: GalleryItem[];
}

export function ContentModeration({ recipes, galleryItems }: ContentModerationProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDeleteRecipe = (id: string) => {
    if (confirm("Soll dieses Rezept wirklich endgültig gelöscht werden?")) {
      startTransition(async () => {
        const result = await deleteRecipe(id);
        if (result.error) {
          toast({ variant: "destructive", title: "Fehler", description: result.error });
        } else {
          toast({ title: "Erfolg", description: "Rezept wurde gelöscht." });
        }
      });
    }
  };

  const handleDeleteGalleryItem = (id: string) => {
    if (confirm("Soll dieses Bild wirklich endgültig gelöscht werden?")) {
      startTransition(async () => {
        const result = await deleteGalleryItem(id);
        if (result.error) {
          toast({ variant: "destructive", title: "Fehler", description: result.error });
        } else {
          toast({ title: "Erfolg", description: "Bild wurde gelöscht." });
        }
      });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-4">Rezepte</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipes.length > 0 ? recipes.map((recipe) => (
                <TableRow key={recipe.id}>
                  <TableCell className="font-medium">{recipe.title}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteRecipe(recipe.id)}
                      disabled={isPending}
                    >
                      Löschen
                    </Button>
                  </TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Keine Rezepte gefunden.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Galeriebilder</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vorschau</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {galleryItems.length > 0 ? galleryItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Image src={item.url} alt={item.caption || ""} width={80} height={80} className="rounded-md object-cover" />
                  </TableCell>
                  <TableCell>{item.caption || <span className="text-muted-foreground">N/A</span>}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteGalleryItem(item.id)}
                      disabled={isPending}
                    >
                      Löschen
                    </Button>
                  </TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Keine Bilder gefunden.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
