import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16; // AES-GCM auth tag: 16 bytes (128 bits) — explicitly enforced
const SALT_LENGTH = 32;

function getEncryptionKey(): Buffer {
  // Security: never fall back to a hardcoded literal — that would make all
  // stored connector credentials effectively plaintext for anyone who reads the
  // source. Fail closed if no real secret is configured. (SAST Finding 7)
  if (process.env.ENCRYPTION_KEY) {
    return crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
  }
  if (process.env.SESSION_SECRET) {
    // In production, refuse the fallback: rotating SESSION_SECRET would silently
    // break decryption of every stored connector credential. Fail fast so the
    // operator sets a dedicated key before going live.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[SECURITY] ENCRYPTION_KEY is required in production. ' +
        'SESSION_SECRET cannot be used as a fallback — rotating it would silently ' +
        'corrupt all stored connector credentials. ' +
        'Add a dedicated ENCRYPTION_KEY (32+ random chars) to your environment variables.'
      );
    }
    console.warn(
      '[SECURITY] ENCRYPTION_KEY is not set — falling back to SESSION_SECRET. ' +
      'Set a dedicated ENCRYPTION_KEY (32+ random chars) in your environment config for production.'
    );
    return crypto.scryptSync(process.env.SESSION_SECRET, 'salt', 32);
  }
  throw new Error(
    '[SECURITY] Neither ENCRYPTION_KEY nor SESSION_SECRET is configured. ' +
    'Connector credential encryption cannot proceed. ' +
    'Add ENCRYPTION_KEY to your environment variables before starting the server.'
  );
}

export function encryptValue(value: string): string {
  if (!value) return value;
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  // SG: authTagLength explicitly set to 128 bits (16 bytes) per AES-GCM spec
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptValue(encryptedValue: string): string {
  if (!encryptedValue || !encryptedValue.includes(':')) return encryptedValue;
  
  try {
    const key = getEncryptionKey();
    const [ivHex, tagHex, encrypted] = encryptedValue.split(':');
    
    if (!ivHex || !tagHex || !encrypted) return encryptedValue;
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');

    // Validate tag length before use — rejects truncated/forged tags
    if (authTag.length !== TAG_LENGTH) {
      throw new Error('Invalid authentication tag length');
    }

    // SG: authTagLength explicitly set to 128 bits (16 bytes) per AES-GCM spec
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed, returning original value');
    return encryptedValue;
  }
}

export function encryptSensitiveFields(config: Record<string, any>, sensitiveKeys: string[]): Record<string, any> {
  const result = { ...config };
  
  for (const key of sensitiveKeys) {
    if (result[key] && typeof result[key] === 'string') {
      result[key] = encryptValue(result[key]);
    }
  }
  
  return result;
}

export function decryptSensitiveFields(config: Record<string, any>, sensitiveKeys: string[]): Record<string, any> {
  const result = { ...config };
  
  for (const key of sensitiveKeys) {
    if (result[key] && typeof result[key] === 'string') {
      result[key] = decryptValue(result[key]);
    }
  }
  
  return result;
}

export function redactSensitiveFields(config: Record<string, any>, sensitiveKeys: string[]): Record<string, any> {
  const result = { ...config };
  
  for (const key of sensitiveKeys) {
    if (result[key]) {
      result[key] = '********';
    }
  }
  
  return result;
}
