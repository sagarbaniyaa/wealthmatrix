import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * AES-256-GCM encryption for secrets that must be stored (not just
 * hashed) because the backend needs the plaintext back later — an
 * adviser's IMAP app password, specifically. Same "loudly fail if
 * unconfigured" discipline as ClaudeClientService/ProviderMailerService:
 * no silent fallback to storing plaintext.
 *
 * The derived key comes from ENCRYPTION_KEY (env) via scrypt, so the
 * env var itself can be any length/format, not required to already be
 * exactly 32 bytes.
 */
@Injectable()
export class CredentialCipherService {
  private readonly key: Buffer | null;

  constructor(config: ConfigService) {
    const secret = config.get<string>('ENCRYPTION_KEY');
    this.key = secret ? scryptSync(secret, 'wealthmatrix-credential-cipher-v1', 32) : null;
  }

  get isConfigured(): boolean {
    return !!this.key;
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new ServiceUnavailableException(
        'ENCRYPTION_KEY is not configured on the backend — set it in .env (any random long string) and restart the server.',
      );
    }
    return this.key;
  }

  encrypt(plaintext: string): string {
    const key = this.requireKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]).toString('base64');
  }

  decrypt(encoded: string): string {
    const key = this.requireKey();
    const raw = Buffer.from(encoded, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
}
