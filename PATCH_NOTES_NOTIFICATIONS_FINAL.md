Körset Notifications Final v1 Patch

Что сделано:
- экран уведомлений с реальными настройками push
- manifest + service worker
- подписка устройства на push через /api/push/subscribe
- отключение подписки через /api/push/unsubscribe
- серверная отправка тестового push через /api/push/send-test
- внутренний endpoint для боевых событий /api/push/send-event
- генератор VAPID ключей: npm run push:keys
- SQL схема: supabase_push_notifications.sql
- настройки уведомлений сохраняются в profile.preferences.notifications и localStorage

Что нужно сделать вручную:
1. npm install
2. выполнить supabase_push_notifications.sql в Supabase SQL Editor
3. сгенерировать VAPID keys: npm run push:keys
4. добавить env в Vercel / .env.local
5. redeploy

Ограничение iPhone:
- web push на iPhone работает для веб-приложения, добавленного на экран Домой
