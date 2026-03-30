"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const LINKEDIN_URL = "https://www.linkedin.com/in/saiaparanjinemmani";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthCallback:
    "Something went wrong during sign-in. Please try again or use a different account.",
  OAuthAccountNotLinked:
    "This email is already linked to another sign-in method. Try signing in with that method instead.",
  OAuthCreateAccount:
    "We couldn't create your account. Please try again.",
  EmailCreateAccount:
    "We couldn't create your account. Please try again.",
  OAuthAccessDenied:
    "Sign-in is blocked. This app may be restricted to Google OAuth test users.",
  access_denied:
    "Sign-in is blocked. This app may be restricted to Google OAuth test users.",
  AccessDenied:
    "Sign-in is blocked. This app may be restricted to Google OAuth test users.",
  Callback:
    "Something went wrong during sign-in. Please try again.",
  Default:
    "Sign-in failed. Please try again.",
};

function SignInContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode
    ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default
    : null;
  const isOAuthAccessDenied =
    errorCode === "OAuthAccessDenied" ||
    errorCode === "access_denied" ||
    errorCode === "AccessDenied";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <Image
        src="/logo.png"
        alt="LifeBoard"
        width={200}
        height={20}
        priority
      />
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Sign in</h1>
        {errorMessage && (
          <div
            className="w-full rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800"
            role="alert"
          >
            {errorMessage}
            {isOAuthAccessDenied && (
              <p className="mt-2">
                Message me on{" "}
                <a
                  href={LINKEDIN_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  LinkedIn
                </a>{" "}
                with your Google email address and I’ll add it, then try again.
              </p>
            )}
          </div>
        )}
        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <Image
            src="/logo.png"
            alt="LifeBoard"
            width={200}
            height={20}
            priority
          />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
