export async function fetchApiFile(
  url: string,
  options: {
    filename?: string;
    openInNewTab?: boolean;
  } = {},
): Promise<void> {
  const previewWindow = options.openInNewTab
    ? window.open("", "_blank")
    : null;
  if (previewWindow) previewWindow.opener = null;

  try {
    const response = await fetch(url, { credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error(`File request failed (${response.status})`);

    const blobUrl = URL.createObjectURL(await response.blob());
    if (options.openInNewTab) {
      if (!previewWindow) throw new Error("The browser blocked the preview window");
      previewWindow.location.href = blobUrl;
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      return;
    }

    const disposition = response.headers.get("content-disposition") ?? "";
    const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    const filename = options.filename
      ?? (encodedName ? decodeURIComponent(encodedName) : plainName)
      ?? "download";
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    previewWindow?.close();
    throw error;
  }
}