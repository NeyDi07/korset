import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()
console.log('\n# Add these to Vercel / .env.local\n')
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log('VAPID_SUBJECT=mailto:hello@korset.app')
console.log('PUSH_INTERNAL_TOKEN=replace-with-random-secret')
