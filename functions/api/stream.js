
function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeJSON(data) {
  return base64url(new TextEncoder().encode(JSON.stringify(data)));
}

async function getGoogleAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);

  const header = encodeJSON({ alg: "RS256", typ: "JWT" });
  const claim = encodeJSON({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  });

  const unsigned = header + "." + claim;

  const pem = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binary = atob(pem);
  const keyBytes = Uint8Array.from(binary, c => c.charCodeAt(0));

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      privateKey,
      new TextEncoder().encode(unsigned)
    )
  );

  const assertion = unsigned + "." + base64url(signature);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  if (!response.ok) throw new Error("Google authentication failed");

  const result = await response.json();
  return result.access_token;
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const videoId = Number(url.searchParams.get("id"));
    const token = url.searchParams.get("token");

    if (![1, 2, 3, 4].includes(videoId) || !token) {
      return new Response("অনুমতি পাওয়া যায়নি", { status: 403 });
    }

    const access = await env.DB.prepare(
      "SELECT video_id FROM access_tokens WHERE token = ? AND video_id = ?"
    ).bind(token, videoId).first();

    if (!access) {
      return new Response("ভিডিও দেখার অনুমতি নেই", { status: 403 });
    }

    const video = await env.DB.prepare(
      "SELECT drive_file_id FROM videos WHERE id = ? AND active = 1"
    ).bind(videoId).first();

    if (!video) {
      return new Response("ভিডিও পাওয়া যায়নি", { status: 404 });
    }

    const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const googleToken = await getGoogleAccessToken(serviceAccount);

    const headers = {
      Authorization: "Bearer " + googleToken
    };

    const range = request.headers.get("Range");
    if (range) headers.Range = range;

    const driveResponse = await fetch(
      "https://www.googleapis.com/drive/v3/files/" +
      encodeURIComponent(video.drive_file_id) +
      "?alt=media&supportsAllDrives=true",
      { headers }
    );

    if (!driveResponse.ok) {
      return new Response("Google Drive থেকে ভিডিও আনা যায়নি", {
        status: driveResponse.status === 404 ? 404 : 502
      });
    }

    const responseHeaders = new Headers({
      "Content-Type": driveResponse.headers.get("Content-Type") || "video/mp4",
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    });

    for (const name of ["Content-Length", "Content-Range"]) {
      const value = driveResponse.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    return new Response(driveResponse.body, {
      status: driveResponse.status,
      headers: responseHeaders
    });

  } catch (error) {
    return new Response("ভিডিও চালাতে সমস্যা হয়েছে", { status: 500 });
  }
}
