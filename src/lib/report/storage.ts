import { env } from "@/env";

export interface StoredReportFile {
  bucket: string;
  path: string;
  objectUrl: string;
  signedUrl: string;
}

const DEFAULT_REPORTS_BUCKET = "reports";

function getSupabaseConfig() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase storage is not configured");
  }

  return {
    baseUrl: env.SUPABASE_URL.replace(/\/$/, ""),
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function toAbsoluteSignedUrl(baseUrl: string, rawSignedUrl: string): string {
  if (rawSignedUrl.startsWith("http")) {
    return rawSignedUrl;
  }

  if (rawSignedUrl.startsWith("/storage/v1/")) {
    return `${baseUrl}${rawSignedUrl}`;
  }

  return `${baseUrl}/storage/v1${
    rawSignedUrl.startsWith("/") ? rawSignedUrl : `/${rawSignedUrl}`
  }`;
}

async function parseErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `Supabase request failed (${response.status})`;
  }

  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    return parsed.error ?? parsed.message ?? text;
  } catch {
    return text;
  }
}

async function ensureBucketExists(bucket: string) {
  const { baseUrl, serviceRoleKey } = getSupabaseConfig();

  const readResponse = await fetch(`${baseUrl}/storage/v1/bucket/${bucket}`, {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    cache: "no-store",
  });

  if (readResponse.ok) {
    return;
  }

  if (readResponse.status !== 404) {
    throw new Error(await parseErrorMessage(readResponse));
  }

  const createResponse = await fetch(`${baseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      public: false,
      allowed_mime_types: ["application/pdf"],
    }),
    cache: "no-store",
  });

  if (!createResponse.ok && createResponse.status !== 409) {
    throw new Error(await parseErrorMessage(createResponse));
  }
}

export async function uploadReportPdfToSupabase(input: {
  fileName: string;
  buffer: Buffer;
  bucket?: string;
  pathPrefix?: string;
  expiresInSeconds?: number;
}): Promise<StoredReportFile> {
  const { baseUrl, serviceRoleKey } = getSupabaseConfig();
  const bucket = input.bucket ?? DEFAULT_REPORTS_BUCKET;
  const pathPrefix = input.pathPrefix?.replace(/^\/+|\/+$/g, "") ?? "";
  const objectPath = [pathPrefix, input.fileName].filter(Boolean).join("/");
  const encodedPath = encodeStoragePath(objectPath);

  await ensureBucketExists(bucket);

  const uploadResponse = await fetch(
    `${baseUrl}/storage/v1/object/${bucket}/${encodedPath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/pdf",
        "x-upsert": "true",
      },
      body: Uint8Array.from(input.buffer),
      cache: "no-store",
    }
  );

  if (!uploadResponse.ok) {
    throw new Error(await parseErrorMessage(uploadResponse));
  }

  const signResponse = await fetch(
    `${baseUrl}/storage/v1/object/sign/${bucket}/${encodedPath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expiresIn: input.expiresInSeconds ?? 60 * 60 * 24 * 7,
      }),
      cache: "no-store",
    }
  );

  if (!signResponse.ok) {
    throw new Error(await parseErrorMessage(signResponse));
  }

  const signBody = (await signResponse.json()) as {
    signedURL?: string;
    signedUrl?: string;
    data?: {
      signedURL?: string;
      signedUrl?: string;
    };
  };

  const rawSignedUrl =
    signBody.signedURL ??
    signBody.signedUrl ??
    signBody.data?.signedURL ??
    signBody.data?.signedUrl;

  if (!rawSignedUrl) {
    throw new Error("Supabase did not return a signed URL");
  }

  return {
    bucket,
    path: objectPath,
    objectUrl: `${baseUrl}/storage/v1/object/${bucket}/${encodedPath}`,
    signedUrl: toAbsoluteSignedUrl(baseUrl, rawSignedUrl),
  };
}
