// ============================================================
// KÖRSET — Загрузка товаров в Supabase
// Запуск: node seed_products.js
// Нужно: node 18+, @supabase/supabase-js установлен
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// ⚠️ Вставь свои ключи
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tcvuffoxwavqdexrzwjj.supabase.co'
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdnVmZm94d2F2cWRleHJ6d2pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyOTY1MDQsImV4cCI6MjA4ODg3MjUwNH0.sM_cf6gvFMaNaZiN-_vU9C9SXYkXR2XOXkJzMiGF6bA'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// Читаем products.json
const raw = JSON.parse(readFileSync('./src/data/products.json', 'utf8'))

// Конвертируем в формат Supabase таблицы
const rows = raw.map(p => ({
  id:            p.id,
  ean:           p.ean || null,
  name:          p.name,
  brand:         p.manufacturer || null,
  category:      p.category,
  shelf:         p.shelf || null,
  price_kzt:     p.priceKzt || null,
  images:        p.images || [],
  ingredients:   p.ingredients || null,
  allergens:     p.allergens || [],
  diet_tags:     p.dietTags || [],
  nutrition:     p.nutritionPer100 || null,
  specs:         p.specs || null,
  halal:         p.halal === true || p.halal === 'yes',
  quality_score: p.qualityScore || 50,
  source:        'manual',
  is_active:     true,
}))

console.log(`Загружаем ${rows.length} товаров...`)

const { data, error } = await supabase
  .from('products')
  .upsert(rows, { onConflict: 'id' })

if (error) {
  console.error('❌ Ошибка:', error.message)
  process.exit(1)
}

console.log('✅ Готово! Все товары загружены в Supabase.')
console.log('Теперь сканер будет искать товары сначала там.')
