import webpush from 'web-push'

if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.warn('⚠️ WARNING: VAPID keys are missing from environment variables! Web Push notifications will fail.')
} else {
  webpush.setVapidDetails(
    'mailto:admin@hdstudio.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

export default webpush
