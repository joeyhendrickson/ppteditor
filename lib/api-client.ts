export async function parseApiJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (!text) {
    throw new Error(
      `Empty response from server (${response.status}). The API may have timed out.`
    );
  }

  if (!contentType.includes("application/json") && text.trimStart().startsWith("<")) {
    const snippet = text.replace(/\s+/g, " ").slice(0, 120);
    throw new Error(
      `Server returned HTML instead of JSON (${response.status}). This usually means the API route failed, timed out, or the request was too large. ${snippet}`
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Invalid JSON from server (${response.status}): ${text.slice(0, 200)}`
    );
  }
}

export async function apiPostJson<T>(
  url: string,
  body: unknown
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseApiJson<{ error?: string } & T>(response);
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }
  return data;
}

export async function apiPostForm<T>(url: string, formData: FormData): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });
  const data = await parseApiJson<{ error?: string } & T>(response);
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }
  return data;
}
