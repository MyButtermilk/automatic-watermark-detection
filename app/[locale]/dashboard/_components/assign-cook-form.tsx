"use client";

import { useFormState, useFormStatus } from "react-dom";
import { assignCook } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Wird übernommen..." : "Ich koche!"}
    </Button>
  );
}

export function AssignCookForm({ eventId }: { eventId: string }) {
  // The `any` type is not ideal, but it's a common issue with useFormState
  // where the initial state and return type can be different.
  const [state, dispatch] = useFormState(assignCook.bind(null, eventId), undefined as any);

  useEffect(() => {
    if (state?.error) {
      alert(`Fehler: ${state.error}`);
    }
    // We don't need to do anything on success, as revalidatePath handles the UI update.
  }, [state]);

  return (
    <form action={dispatch}>
      <SubmitButton />
    </form>
  );
}
