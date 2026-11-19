"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Loader2 } from "lucide-react";

type SignInFormProps = {
  callbackUrl: string;
  googleEnabled: boolean;
  microsoftEnabled: boolean;
  initialError: string | null;
};

export function SignInForm({
  callbackUrl,
  googleEnabled,
  microsoftEnabled,
  initialError,
}: SignInFormProps) {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState<"credentials" | "google" | "microsoft" | null>(null);

  async function handleCredentials(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);

    if (!login.trim() || !password) {
      setError("Enter your login id and password.");
      return;
    }

    setPending("credentials");
    try {
      const result = await signIn("credentials", {
        login: login.trim(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (!result || result.error) {
        setError("Invalid login id or password. Please check your college credentials.");
        setPassword("");
        return;
      }

      router.replace(result.url || callbackUrl);
      router.refresh();
    } catch {
      setError("Could not reach the sign-in service. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function handleOAuth(provider: "google" | "azure-ad") {
    if (pending) return;
    setError(null);
    setPending(provider === "google" ? "google" : "microsoft");
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      setError("Could not start sign-in. Please try again.");
      setPending(null);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-white lg:grid-cols-[minmax(0,1fr)_400px]">
      {/* Campus photo */}
      <div className="relative h-56 w-full lg:h-auto">
        <Image
          src="/images/campus.jpg"
          alt="Presidency University campus"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 75vw"
          className="object-cover"
        />
      </div>

      {/* Sign-in panel */}
      <div className="flex flex-col items-center justify-center px-6 py-10 lg:px-8">
        <div className="w-full max-w-[330px]">
          <form onSubmit={handleCredentials} className="mt-5 space-y-3" noValidate>
            <label className="relative block">
              <span className="pointer-events-none absolute left-3 top-[7px] text-[11px] leading-none text-[#6b7280]">
                Login
              </span>
              <input
                name="login"
                type="text"
                autoComplete="username"
                inputMode="text"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                disabled={pending !== null}
                className="h-[46px] w-full rounded-[3px] border border-[#c7ccd4] bg-white px-3 pb-1 pt-[19px] text-[13.5px] text-[#111827] outline-none transition-colors placeholder:text-[#9ca3af] focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]/30 disabled:bg-[#f9fafb]"
              />
            </label>

            <label className="relative block">
              <span className="pointer-events-none absolute left-3 top-[7px] text-[11px] leading-none text-[#6b7280]">
                Password
              </span>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={pending !== null}
                className="h-[46px] w-full rounded-[3px] border border-[#c7ccd4] bg-white pl-3 pr-10 pb-1 pt-[19px] text-[13.5px] text-[#111827] outline-none transition-colors placeholder:text-[#9ca3af] focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]/30 disabled:bg-[#f9fafb]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[#9ca3af] transition-colors hover:text-[#4b5563]"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </label>

            {error ? (
              <p role="alert" className="rounded-[3px] bg-red-50 px-3 py-2 text-[12px] leading-snug text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending !== null}
              className="flex h-[42px] w-full items-center justify-center gap-2 rounded-[3px] bg-[#7c3aed] text-[14px] font-semibold text-white transition-colors hover:bg-[#6d28d9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c3aed] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {pending === "credentials" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign in
            </button>
          </form>

          <div className="mt-2.5 space-y-2">
            {googleEnabled ? (
              <button
                type="button"
                onClick={() => handleOAuth("google")}
                disabled={pending !== null}
                className="relative flex h-[42px] w-full items-center justify-center rounded-[3px] border border-[#c7ccd4] bg-white text-[13.5px] font-medium text-[#374151] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="absolute left-3 flex items-center">
                  {pending === "google" ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <GoogleIcon />}
                </span>
                Sign in with Google
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => handleOAuth("azure-ad")}
              disabled={pending !== null || !microsoftEnabled}
              title={microsoftEnabled ? undefined : "Microsoft sign-in is not configured yet."}
              className="relative flex h-[42px] w-full items-center justify-center rounded-[3px] border border-[#c7ccd4] bg-white text-[13.5px] font-medium text-[#374151] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="absolute left-3 flex items-center">
                {pending === "microsoft" ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <MicrosoftIcon />}
              </span>
              Sign in with Microsoft
            </button>
          </div>

          <div className="mt-5 text-center">
            <a
              href="mailto:ams.support@presidencyuniversity.edu?subject=AMS%20password%20reset"
              className="text-[13px] text-[#4b5563] underline underline-offset-2 hover:text-[#7c3aed]"
            >
              Forgot Password?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84a10.13 10.13 0 0 1-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0 0 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18a13.22 13.22 0 0 1 0-8.36v-5.7H4.34a21.99 21.99 0 0 0 0 19.76l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 9.5c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 2.66 29.93 1 24 1 15.4 1 7.96 5.94 4.34 13.12l7.35 5.7C13.42 13.62 18.27 9.5 24 9.5z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 23 23" className="h-[17px] w-[17px]" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
