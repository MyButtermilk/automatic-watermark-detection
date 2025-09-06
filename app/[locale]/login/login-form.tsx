"use client"

import { useFormState, useFormStatus } from 'react-dom';
import { authenticate } from '@/lib/actions';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useTranslations } from 'next-intl';

export function LoginForm() {
  const t = useTranslations('LoginPage');
  const [errorMessage, dispatch] = useFormState(authenticate, undefined);

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
            <LoginButton />
            <div className="mt-4 text-center text-sm">
              {t('noAccount')}{" "}
              <Link href="/signup" className="underline">
                {t('signupLink')}
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

function LoginButton() {
  const t = useTranslations('LoginPage');
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? t('buttonPending') : t('button')}
    </Button>
  );
}
