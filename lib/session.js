const SECRET = process.env.SESSION_SECRET || 'hd_studio_yobi_default_session_secret_key_32_bytes_long_secret_key'

// Helper to convert base64url to base64
function base64urlToBase64(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) {
    str += '='
  }
  return str
}

// Helper to convert base64 to base64url
function base64ToBase64url(str) {
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Signs a payload using HMAC SHA-256 (Web Crypto API)
 */
async function signHMAC(payload, secret) {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  )
  
  // Convert ArrayBuffer to binary string then base64
  const bytes = new Uint8Array(signature)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return base64ToBase64url(btoa(binary))
}

/**
 * Verifies a payload signature using HMAC SHA-256
 */
async function verifyHMAC(payload, signature, secret) {
  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['verify']
    )
    
    const binarySig = atob(base64urlToBase64(signature))
    const sigBuf = new Uint8Array(binarySig.length)
    for (let i = 0; i < binarySig.length; i++) {
      sigBuf[i] = binarySig.charCodeAt(i)
    }
    
    return await crypto.subtle.verify(
      'HMAC',
      key,
      sigBuf,
      encoder.encode(payload)
    )
  } catch (err) {
    console.error('HMAC verify error:', err)
    return false
  }
}

/**
 * Encrypts/Signs session payload into a token
 * @param {object} data - Session payload
 * @returns {Promise<string>} Token string
 */
export async function encrypt(data) {
  const jsonStr = JSON.stringify(data)
  // Simple encoding to base64url
  const encodedPayload = base64ToBase64url(btoa(unescape(encodeURIComponent(jsonStr))))
  const signature = await signHMAC(encodedPayload, SECRET)
  return `${encodedPayload}.${signature}`
}

/**
 * Decrypts/Verifies token into session payload
 * @param {string} token - Token string
 * @returns {Promise<object|null>} Session payload or null if invalid/expired
 */
export async function decrypt(token) {
  try {
    if (!token || !token.includes('.')) return null
    const [encodedPayload, signature] = token.split('.')
    if (!encodedPayload || !signature) return null
    
    const isValid = await verifyHMAC(encodedPayload, signature, SECRET)
    if (!isValid) return null
    
    const jsonStr = decodeURIComponent(escape(atob(base64urlToBase64(encodedPayload))))
    const data = JSON.parse(jsonStr)
    
    // Check expiration
    if (data.exp && Date.now() > data.exp) {
      return null // Expired
    }
    
    return data
  } catch (err) {
    console.error('Session parsing error:', err)
    return null
  }
}
