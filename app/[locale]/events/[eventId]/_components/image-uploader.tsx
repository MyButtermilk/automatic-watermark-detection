"use client";

import { useState, useRef } from "react";
import { getCloudinarySignature, saveGalleryItem } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ImageUploader({ eventId }: { eventId: string }) {
  const [isUploading, setIsUploading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fileInput = event.currentTarget.elements.namedItem("image") as HTMLInputElement;
    const file = fileInput.files?.[0];

    if (!file) {
      alert("Bitte wähle eine Datei aus.");
      return;
    }

    setIsUploading(true);

    try {
      // 1. Get signature from our server
      const { timestamp, signature, error } = await getCloudinarySignature();
      if (error || !signature) {
        throw new Error(error || "Signatur konnte nicht vom Server abgerufen werden.");
      }

      // 2. Create form data to send to Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY!);
      formData.append("signature", signature);
      formData.append("timestamp", timestamp.toString());
      formData.append("folder", "sauna-boys-club"); // Optional: organize uploads

      // 3. Upload to Cloudinary
      const endpoint = `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!}/image/upload`;
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Upload zu Cloudinary fehlgeschlagen: ${errorData.error.message}`);
      }

      const data = await response.json();
      const { public_id, secure_url } = data;

      // 4. Save metadata to our database
      const caption = (event.currentTarget.elements.namedItem("caption") as HTMLInputElement)?.value;
      const saveResult = await saveGalleryItem(eventId, public_id, secure_url, caption);

      if (saveResult?.error) {
        throw new Error(saveResult.error);
      }

      alert("Bild erfolgreich hochgeladen!");
      formRef.current?.reset();

    } catch (error: any) {
      console.error("Upload failed:", error);
      alert(`Fehler beim Upload: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleUpload} className="space-y-4 p-4 border rounded-lg">
      <h3 className="font-semibold text-lg">Neues Bild hochladen</h3>
      <div>
        <Label htmlFor="image">Bild auswählen</Label>
        <Input id="image" name="image" type="file" accept="image/*" required />
      </div>
      <div>
        <Label htmlFor="caption">Bildunterschrift (optional)</Label>
        <Input id="caption" name="caption" type="text" placeholder="Ein schöner Abend..." />
      </div>
      <Button type="submit" disabled={isUploading}>
        {isUploading ? "Lade hoch..." : "Bild hochladen"}
      </Button>
    </form>
  );
}
