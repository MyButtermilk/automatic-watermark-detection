"use client"

import { useFormState, useFormStatus } from 'react-dom';
import { signup } from '@/lib/actions';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function SignupForm() {
  const t = useTranslations('SignupPage');
  const [errorMessage, dispatch] = useFormState(signup, undefined);

  return (
    <form action={dispatch}>
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{t('nameLabel')}</Label>
              <Input id="name" name="name" placeholder="Dein Name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">{t('emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                name="email"
                placeholder="deine@email.de"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t('passwordLabel')}</Label>
              <Input id="password" type="password" name="password" required />
            </div>
            {errorMessage && (
              <div className="text-sm text-red-500">{errorMessage}</div>
            )}
            <SignupButton />
            <div className="mt-4 text-center text-sm">
              {t('hasAccount')}{" "}
              <Link href="/login" className="underline">
                {t('loginLink')}
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

function SignupButton() {
  const t = useTranslations('SignupPage');
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? t('buttonPending') : t('button')}
    </Button>
  );
}
