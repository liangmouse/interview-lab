import { LoginForm } from "@/components/login-form";
import { AuthArtwork } from "@/components/auth-artwork";

export default function SignInPage() {
  return (
    <div className="h-screen grid grid-cols-1 lg:grid-cols-[1.3fr_1fr]">
      {/* Left Column - Marketing Panel (Hidden on mobile) */}
      <div className="hidden lg:block relative h-full">
        <AuthArtwork />
      </div>

      {/* Right Column - Auth Form */}
      <div className="flex items-center justify-center p-8 lg:p-12 bg-white">
        <div className="w-full max-w-[400px]">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
