"use client";

import { useTransition, useRef } from "react";
import { addShoppingItem, toggleShoppingItem } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { ShoppingItem } from "@prisma/client";

interface ShoppingListProps {
  eventId: string;
  items: ShoppingItem[];
}

export function ShoppingList({ eventId, items }: ShoppingListProps) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const handleAddItem = async (formData: FormData) => {
    // Basic client-side validation to prevent empty submissions
    if (!formData.get("name")) return;

    const result = await addShoppingItem(eventId, formData);
    if (result?.success) {
      formRef.current?.reset();
    } else if (result?.error) {
      alert(`Fehler: ${result.error}`);
    }
  };

  const handleToggleItem = (itemId: string, purchased: boolean) => {
    startTransition(() => {
      toggleShoppingItem(itemId, purchased, eventId);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Einkaufsliste</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={handleAddItem} className="flex items-end gap-2 mb-4">
          <div className="grid gap-1.5 flex-grow">
            <Label htmlFor="name">Neuer Artikel</Label>
            <Input id="name" name="name" placeholder="z.B. Olivenöl" required />
          </div>
          <div className="grid gap-1.5">
             <Label htmlFor="quantity">Menge</Label>
            <Input id="quantity" name="quantity" placeholder="z.B. 500" />
          </div>
           <div className="grid gap-1.5">
             <Label htmlFor="unit">Einheit</Label>
            <Input id="unit" name="unit" placeholder="z.B. ml" />
          </div>
          <Button type="submit">Hinzufügen</Button>
        </form>
        <div className="space-y-2">
          {items.length > 0 ? items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <Checkbox
                id={`item-${item.id}`}
                checked={item.purchased}
                onCheckedChange={(checked) => handleToggleItem(item.id, !!checked)}
                disabled={isPending}
                aria-label={`Mark ${item.name} as purchased`}
              />
              <Label
                htmlFor={`item-${item.id}`}
                className={`flex-grow ${item.purchased ? "line-through text-muted-foreground" : ""}`}
              >
                {item.name}{" "}
                {item.quantity && <span className="text-sm text-muted-foreground">({item.quantity} {item.unit || ''})</span>}
              </Label>
            </div>
          )) : <p className="text-sm text-muted-foreground">Die Einkaufsliste ist noch leer.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
