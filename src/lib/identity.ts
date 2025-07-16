const STORAGE_KEY = 'persona-identity';

export interface Identity {
  publicKey: string;
  privateKey: string;
}

async function generateIdentity(): Promise<Identity> {
  if (
    typeof window === 'undefined' ||
    !window.crypto ||
    !window.crypto.subtle
  ) {
    throw new Error('Web Crypto API not available. Are you running in a secure browser context?');
  }
  const keyPair = await window.crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true, // can be extracted
    ['sign', 'verify']
  );

  // Export the keys in a storable format (JWK)
  const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey!);
  const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey!);

  return {
    publicKey: JSON.stringify(publicKeyJwk),
    privateKey: JSON.stringify(privateKeyJwk)
  };
}

// Main function to get the identity.
// It will load from storage, or create a new one if it doesn't exist.
export async function getIdentity(storageKey = 'persona-identity'): Promise<Identity> {
  const storedIdentity = localStorage.getItem(storageKey);
  if (storedIdentity) {
    console.log('✅ Identity loaded from storage.');
    return JSON.parse(storedIdentity) as Identity;
  } else {
    console.log('✨ No identity found, generating a new one...');
    const newIdentity = await generateIdentity();
    localStorage.setItem(storageKey, JSON.stringify(newIdentity));
    console.log('🔑 New identity saved to storage.');
    return newIdentity;
  }
}