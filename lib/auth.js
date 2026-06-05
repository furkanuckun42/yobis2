import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.JWT_SECRET || 'some-fallback-32-char-key-for-aes-encryption'
const IV_LENGTH = 16

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export function encryptPassword(text) {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decryptPassword(text) {
  try {
    if (!text || !text.includes(':')) return null
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
    const textParts = text.split(':')
    const iv = Buffer.from(textParts.shift(), 'hex')
    const encryptedText = Buffer.from(textParts.join(':'), 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
  } catch (err) {
    return null
  }
}

export function verifyPassword(input, stored) {
  const decrypted = decryptPassword(stored)
  if (decrypted !== null) {
    return decrypted === input
  }
  // Legacy SHA-256 hash comparison
  const inputHashed = hashPassword(input)
  return stored === inputHashed
}
