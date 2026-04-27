import { AuthArtwork } from "@/components/auth-artwork";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="grid h-screen h-dvh grid-cols-1 overflow-hidden lg:grid-cols-[1.3fr_1fr]">
      <div className="relative hidden h-full lg:block">
        <AuthArtwork />
      </div>

      <div className="flex h-full min-h-0 items-center justify-center overflow-y-auto bg-white px-6 py-6 lg:px-10 lg:py-8">
        <div className="my-auto w-full max-w-[400px]">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
