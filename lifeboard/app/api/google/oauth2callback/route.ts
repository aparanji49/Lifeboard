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

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "Missing code param" },
      { status: 400 }
    );
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    // THIS is what you need:
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return NextResponse.json(
        {
          error:
            "No refresh_token returned. Try removing app access from your Google account and re-authorizing with prompt=consent.",
        },
        { status: 500 }
      );
    }

    // Show it in the browser so you can copy it
    return new NextResponse(
      `
        <html>
          <body>
            <h1>Copy your refresh token</h1>
            <p><code>${refreshToken}</code></p>
            <p>Now add it to your .env.local as GOOGLE_REFRESH_TOKEN</p>
          </body>
        </html>
      `,
      {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }
    );
  } catch (err) {
    console.error("Error exchanging code for tokens:", err);
    return NextResponse.json(
      { error: "Failed to exchange code for tokens" },
      { status: 500 }
    );
  }
}
