import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Recipe } from "@prisma/client";

interface RecipeDisplayProps {
  recipe: Recipe;
}

export function RecipeDisplay({ recipe }: RecipeDisplayProps) {
  let ingredients: string[] = [];
  let steps: string[] = [];

  try {
    // Ensure that ingredients and steps are valid JSON arrays
    const parsedIngredients = JSON.parse(recipe.ingredients);
    const parsedSteps = JSON.parse(recipe.steps);

    if (Array.isArray(parsedIngredients)) {
      ingredients = parsedIngredients;
    }
    if (Array.isArray(parsedSteps)) {
      steps = parsedSteps;
    }
  } catch (error) {
    console.error("Failed to parse recipe JSON:", error);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rezept</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Fehler beim Laden des Rezepts. Die Daten sind möglicherweise nicht korrekt formatiert.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{recipe.title}</CardTitle>
        {recipe.description && <CardDescription>{recipe.description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="font-semibold text-lg mb-2">Zutaten</h3>
          <ul className="list-disc pl-5 space-y-1">
            {ingredients.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-lg mb-2">Zubereitung</h3>
          <ol className="list-decimal pl-5 space-y-2">
            {steps.map((item, index) => <li key={index}>{item}</li>)}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
