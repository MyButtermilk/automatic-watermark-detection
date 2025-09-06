import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="w-full lg:grid lg:min-h-[calc(100vh-theme(spacing.16))] lg:grid-cols-2 xl:min-h-[calc(100vh-theme(spacing.16))]">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <LoginForm />
        </div>
      </div>
      <div className="hidden bg-muted lg:block">
        {/* We can place an image here later if needed */}
        <div className="flex flex-col justify-center items-center h-full text-center p-12">
            <h2 className="text-4xl font-bold">Sauna Boys Club</h2>
            <p className="text-xl mt-4 text-muted-foreground">Jeden Mittwoch bei Niko.</p>
        </div>
      </div>
    </div>
  );
}
