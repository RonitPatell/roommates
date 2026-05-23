/**
 * Supabase Auth (PKCE) needs crypto.subtle.digest (SHA-256).
 * React Native may define `crypto` as a read-only getter — never assign to `crypto` directly.
 */
import * as ExpoCrypto from 'expo-crypto';

async function digestSha(
  algorithm: AlgorithmIdentifier,
  data: BufferSource
): Promise<ArrayBuffer> {
  const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
  const upper = name.toUpperCase();
  let algo = ExpoCrypto.CryptoDigestAlgorithm.SHA256;
  if (upper.includes('512')) {
    algo = ExpoCrypto.CryptoDigestAlgorithm.SHA512;
  } else if (upper.includes('384')) {
    algo = ExpoCrypto.CryptoDigestAlgorithm.SHA384;
  }

  const bytes =
    data instanceof ArrayBuffer
      ? new Uint8Array(data)
      : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

  return ExpoCrypto.digest(algo, bytes);
}

function getRandomValues<T extends ArrayBufferView>(array: T): T {
  const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  const random = ExpoCrypto.getRandomBytes(view.length);
  view.set(random);
  return array;
}

const subtlePolyfill = { digest: digestSha };

function buildPatchedCrypto(base?: Crypto): Crypto {
  const getRandomValuesFn =
    base?.getRandomValues?.bind(base) ?? getRandomValues;

  return {
    getRandomValues: getRandomValuesFn,
    subtle: subtlePolyfill as SubtleCrypto,
    ...(base?.randomUUID ? { randomUUID: base.randomUUID.bind(base) } : {}),
  } as Crypto;
}

function hasSubtleDigest(cryptoObj: Crypto | undefined): boolean {
  return typeof cryptoObj?.subtle?.digest === 'function';
}

function defineCryptoOn(target: object, patched: Crypto): boolean {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(target, 'crypto');
    if (descriptor?.configurable) {
      Object.defineProperty(target, 'crypto', {
        value: patched,
        configurable: true,
        writable: true,
        enumerable: descriptor.enumerable ?? true,
      });
      return true;
    }
    if (descriptor?.get) {
      const originalGet = descriptor.get;
      Object.defineProperty(target, 'crypto', {
        configurable: true,
        enumerable: descriptor.enumerable ?? true,
        get(): Crypto {
          const base = originalGet.call(target) as Crypto | undefined;
          return hasSubtleDigest(base) ? base! : buildPatchedCrypto(base);
        },
      });
      return true;
    }
  } catch {
    // try another approach
  }
  return false;
}

function installCryptoPolyfill(): void {
  if (hasSubtleDigest(globalThis.crypto)) {
    return;
  }

  const existing = globalThis.crypto;

  if (existing && !hasSubtleDigest(existing)) {
    try {
      Object.defineProperty(existing, 'subtle', {
        value: subtlePolyfill,
        configurable: true,
        writable: true,
        enumerable: true,
      });
      if (hasSubtleDigest(globalThis.crypto)) {
        return;
      }
    } catch {
      // object may be frozen
    }
  }

  const patched = buildPatchedCrypto(existing);

  if (defineCryptoOn(globalThis, patched)) {
    return;
  }

  if (typeof window !== 'undefined' && defineCryptoOn(window, patched)) {
    return;
  }
}

installCryptoPolyfill();
