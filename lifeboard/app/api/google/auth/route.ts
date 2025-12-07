import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  // Scopes: full calendar read/write for your account
  const scopes = [
    "https://www.googleapis.com/auth/calendar",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline", // important: gives refresh token
    prompt: "consent",      // important: forces refresh token
    scope: scopes,
  });

  return NextResponse.redirect(url);
}
