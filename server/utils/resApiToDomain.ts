export function getDomainUrlFromResApi(resApiUrl: string) {
  try {
    const url = new URL(resApiUrl);

    // Split the hostname and remove the first subdomain
    const parts = url.hostname.split('.');
    if (parts.length > 2) {
      parts.shift(); // remove the first subdomain (e.g., "resource-status")
    }

    // Rebuild the domain without the first subdomain
    const domain = parts.join('.');

    // Return the new base URL (always include protocol)
    return `${url.protocol}//${domain}/`;
  } catch {
    return '';
  }
}
