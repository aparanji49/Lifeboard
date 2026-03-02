"use client";

import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Header() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthed = status === "authenticated";

  const name = session?.user?.name ?? "Guest";
  const image = session?.user?.image ?? null;

  return (
    <header className="flex items-center px-6 py-6">
      <Image
        src="/logo.png"
        alt="LifeBoard"
        width={200}
        height={20}
        priority
      />

      {/* Right side */}
      <div className="ml-auto flex items-center gap-4">
        {/* Greeting */}
        <div className="flex items-center gap-2">
          {isAuthed && image ? (
            <Image
              src={image}
              alt={name}
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-slate-200" />
          )}

          <p className="text-sm text-slate-700">
            Hi{" "}
            <span className="font-medium text-slate-900">
              {isLoading ? "…" : name}
            </span>
            !
          </p>
        </div>

        {/* Auth button */}
        {isAuthed ? (
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={isLoading}
          >
            Sign out
          </button>
        ) : (
          // <button
          //   onClick={() => signIn("google", { callbackUrl: "/" })}
          //   className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200 disabled:opacity-50"
          //   disabled={isLoading}
          // >
          //   {isLoading ? "Loading…" : "Continue with Google"}
          // </button>
          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="flex items-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            disabled={isLoading}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
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
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31l3.57 2.77C21.35 18.74 22.56 15.92 22.56 12.25z"
              />
            </svg>
            <span>{isLoading ? "Loading…" : "Sign in with Google"}</span>
          </button>
        )}
      </div>
    </header>
  );
}