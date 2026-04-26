export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export function parseContentDispositionFilename(response: Response, fallback: string): string {
  const cd = response.headers.get("Content-Disposition");
  if (cd) {
    const match = cd.match(/filename="?([^"]+)"?/);
    if (match)
      return match[1];
  }
  return fallback;
}

export async function parseResponseError(response: Response, fallback: string): Promise<string> {
  try {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json() as { detail?: unknown; message?: unknown };
      if (typeof data?.detail === "string")
        return data.detail;
      if (typeof data?.message === "string")
        return data.message;
      if (Array.isArray(data?.detail))
        return JSON.stringify(data.detail);
    }
    const text = await response.text();
    if (text)
      return text;
  }
  catch {}
  return fallback;
}

export async function downloadFromApi(
  url: string,
  token: string,
  fallbackFilename: string,
): Promise<void> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(await parseResponseError(response, "Ошибка загрузки"));
  }

  const blob = await response.blob();
  const filename = parseContentDispositionFilename(response, fallbackFilename);
  triggerBlobDownload(blob, filename);
}
