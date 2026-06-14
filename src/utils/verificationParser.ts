export interface VerificationPayload {
  username: string;
  verificationKey: string;
}

export interface VerificationResult {
  success: boolean;
  data?: VerificationPayload;
  error?: string;
}

export class SourceParserService {
  private static readonly MAX_HEADER_LENGTH = 15000; // Cap extraction area to 15KB max
  private static readonly MAX_SCAN_LINES = 100;      // Parse headers up to first 100 lines for layout safety

  // Accurate regex with capturing groups safely bounded (prevents backtracking / ReDoS issues)
  private static readonly USERNAME_REGEX = /<title>Profile\s*-\s*(.*?)\s*\|\s*Orders<\/title>/i;
  private static readonly CANONICAL_REGEX = /<link\s+rel="canonical"\s+href="[^"]*?warframe\.market\/(?:[a-z]{2}\/)?profile\/([a-zA-Z0-9_-]+)"/i;
  private static readonly OG_TITLE_REGEX = /<meta\s+property="og:title"\s+content="Profile\s*-\s*(.*?)\s*\|\s*Orders"/i;
  private static readonly VERIFY_KEY_REGEX = /(WF-VERIFY-[A-Z0-9]{8,15})/i;

  /**
   * Safe HTML parsing pipeline. Runs entirely inside client browser environment.
   * Ensures no private application state payload is ever transmitted or sent to endpoints.
   */
  public static extractVerificationMeta(rawHtml: string): VerificationResult {
    if (!rawHtml || rawHtml.trim().length === 0) {
      return { success: false, error: "Empty page source payload." };
    }

    // Guardrail 1: Immediate truncation of massive pasting streams
    const truncatedPayload = rawHtml.slice(0, this.MAX_HEADER_LENGTH);

    // Guardrail 2: Slice stream strictly down to headers boundaries
    const lines = truncatedPayload.split(/\r?\n/);
    const croppedHeaderLines = lines.slice(0, this.MAX_SCAN_LINES).join("\n");

    // Guardrail 3: Bounded pattern searches
    let username = "";
    
    // Canonical link is case-insensitive in directories but keeps proper casing in profile slugs normally
    const canonicalMatch = croppedHeaderLines.match(this.CANONICAL_REGEX);
    if (canonicalMatch && canonicalMatch[1]) {
      username = canonicalMatch[1].trim();
    } else {
      // Title match (e.g. <title>Profile - TennoMerchant | Orders</title>)
      const usernameMatch = croppedHeaderLines.match(this.USERNAME_REGEX);
      if (usernameMatch && usernameMatch[1]) {
        username = usernameMatch[1].trim();
      } else {
        const ogTitleMatch = croppedHeaderLines.match(this.OG_TITLE_REGEX);
        if (ogTitleMatch && ogTitleMatch[1]) {
          username = ogTitleMatch[1].trim();
        }
      }
    }

    // Clean paths if they somehow slipped in
    if (username.includes("/")) {
      username = username.split("/").pop() || username;
    }

    // Extract exact verify signature key
    const keyMatch = croppedHeaderLines.match(this.VERIFY_KEY_REGEX);

    if (!username) {
      return {
        success: false,
        error: "Failed to locate username. Please ensure you copied your entire profile page source code (use CTRL+U -> CTRL+A -> Copy)."
      };
    }

    if (!keyMatch) {
      return {
        success: false,
        error: "Failed to locate verification key. Please ensure you saved the key inside your biography settings, refreshed your profile page, and then copied the NEW page source code."
      };
    }

    return {
      success: true,
      data: {
        username: username,
        verificationKey: keyMatch[1].trim().toUpperCase()
      }
    };
  }
}
