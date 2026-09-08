const SEC_KEY = "mietverwaltung_webauthn";

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(length)));
}

function toBase64Url(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  const binary = atob(normalized);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function authCredentialId(): string {
  return localStorage.getItem(SEC_KEY) || "";
}

export function authEnabled(): boolean {
  return authCredentialId().length > 0;
}

export async function registerDevice(): Promise<void> {
  if (!window.PublicKeyCredential || !navigator.credentials) {
    throw new Error("Geräteauthentifizierung nicht unterstützt");
  }

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "Mietverwaltung" },
      user: {
        id: randomBytes(16),
        name: "private-user",
        displayName: "Mietverwaltung"
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 }
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required"
      },
      timeout: 60000,
      attestation: "none"
    }
  });

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("Geräteauthentifizierung konnte nicht eingerichtet werden");
  }

  localStorage.setItem(SEC_KEY, toBase64Url(new Uint8Array(credential.rawId)));
}

export async function authenticate(): Promise<boolean> {
  const id = authCredentialId();
  if (!id) return true;
  if (!window.PublicKeyCredential || !navigator.credentials) return false;

  try {
    await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ id: fromBase64Url(id), type: "public-key" }],
        userVerification: "required",
        timeout: 60000
      }
    });
    return true;
  } catch {
    return false;
  }
}

export function disableAuth(): void {
  localStorage.removeItem(SEC_KEY);
}
