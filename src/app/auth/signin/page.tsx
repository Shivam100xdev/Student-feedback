import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in · AMS",
  description: "Sign in to your student account with your college login or Google account.",
};

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Invalid login id or password.",
  AccessDenied: "This account is not allowed to sign in.",
  OAuthSignin: "Could not start Google sign-in. Please try again.",
  OAuthCallback: "Google sign-in could not be completed. Please try again.",
  OAuthAccountNotLinked: "This email is already registered with another sign-in method.",
  Configuration: "Sign-in is not configured correctly on the server.",
  Default: "Something went wrong while signing in. Please try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = sanitiseCallback(params.callbackUrl);
  const errorCode = params.error;
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default : null;

  return (
    <SignInForm
      callbackUrl={callbackUrl}
      googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
      microsoftEnabled={Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)}
      initialError={errorMessage}
    />
  );
}

/** Only allow same-site relative redirects after sign-in. */
function sanitiseCallback(value?: string): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}
