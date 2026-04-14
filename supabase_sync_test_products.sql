-- =========================================================================
-- Körset — Полная синхронизация магазина store-one с 16 тестовыми товарами
-- Данные взяты из src/data/products.json + src/data/storeInventories.js
-- Инструкция: Скопируй ВСЁ и выполни в Supabase Dashboard → SQL Editor
-- =========================================================================

DO $$
DECLARE
  v_store_id uuid;
BEGIN

  -- ═══════════════════════════════════════════════════════════════════
  -- 1. МАГАЗИН store-one
  -- ═══════════════════════════════════════════════════════════════════
  SELECT id INTO v_store_id FROM stores WHERE code = 'store-one' LIMIT 1;

  IF v_store_id IS NULL THEN
    INSERT INTO stores (code, name, city, address, type, plan, is_active)
    VALUES (
      'store-one',
      'Магазин 1',
      'Усть-Каменогорск',
      'Тестовый магазин Körset',
      'minimarket',
      'pilot',
      true
    )
    RETURNING id INTO v_store_id;
    RAISE NOTICE 'Создан магазин store-one с id=%', v_store_id;
  ELSE
    -- Обновляем имя на случай, если оно отличалось
    UPDATE stores SET name = 'Магазин 1', city = 'Усть-Каменогорск', is_active = true
    WHERE id = v_store_id;
    RAISE NOTICE 'Магазин store-one уже существует, id=%', v_store_id;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════
  -- 2. ГЛОБАЛЬНЫЕ ПРОДУКТЫ (из products.json — точные данные)
  -- ═══════════════════════════════════════════════════════════════════
  INSERT INTO global_products (ean, name, brand, category, halal_status, image_url, ingredients_raw, data_quality_score)
  VALUES
    -- p001: Snickers 50г
    ('4600000102452', 'Snickers 50г', 'Mars', 'grocery', 'no', '/products/1.png',
     'Молочный шоколад 34% (сахар, масло какао, сухое цельное молоко, какао тёртое), арахис 16%, карамель 13% (сахар, глюкозный сироп, сливочное масло, молоко), нуга (сахар, патока, яичный белок), сахар.', 82),

    -- p002: Snickers 80г
    ('4600000102453', 'Snickers 80г', 'Mars', 'grocery', 'no', '/products/1_2.png',
     'Молочный шоколад 34%, арахис 16%, карамель 13%, нуга, сахар.', 82),

    -- p003: Батончик Step 50г
    ('4600000103012', 'Батончик Step 50г', 'Конфил', 'grocery', 'yes', '/products/2.png',
     'Шоколадная глазурь (сахар, растительный жир, какао-порошок), нуга (сахар, патока), карамель, молоко сухое, соль.', 62),

    -- p004: Coca-Cola 0.5л
    ('5000112546324', 'Coca-Cola 0.5л', 'Coca-Cola', 'grocery', 'yes', '/products/3.png',
     'Вода питьевая, сахар, углекислый газ, краситель карамельный E150d, регулятор кислотности ортофосфорная кислота, натуральные ароматизаторы.', 70),

    -- p005: Coca-Cola 1л
    ('5000112546325', 'Coca-Cola 1л', 'Coca-Cola', 'grocery', 'yes', '/products/3_1.png',
     'Вода питьевая, сахар, углекислый газ, краситель E150d, ортофосфорная кислота, натуральные ароматизаторы.', 70),

    -- p006: Coca-Cola Zero 0.5л
    ('5000112546326', 'Coca-Cola Zero 0.5л', 'Coca-Cola', 'grocery', 'yes', '/products/3_2.png',
     'Вода питьевая, углекислый газ, краситель E150d, регуляторы кислотности, подсластители (аспартам, ацесульфам К), натуральные ароматизаторы.', 68),

    -- p007: Pepsi 0.5л
    ('4890008100309', 'Pepsi 0.5л', 'PepsiCo', 'grocery', 'yes', '/products/4.png',
     'Вода, сахар, углекислый газ, краситель E150d, регулятор кислотности E338, ароматизатор.', 68),

    -- p008: Cool Cola 1л
    ('4870200003011', 'Cool Cola 1л', 'Wimm-Bill-Dann', 'grocery', 'yes', '/products/11.png',
     'Вода питьевая, сахар, углекислый газ, краситель, ортофосфорная кислота, ароматизатор.', 52),

    -- p009: Tassay 0.5л
    ('4870200003012', 'Tassay 0.5л', 'Tassay', 'grocery', 'yes', '/products/5.png',
     'Природная питьевая вода.', 88),

    -- p010: Tassay 1л
    ('4870200003013', 'Tassay 1л', 'Tassay', 'grocery', 'yes', '/products/5_1.png',
     'Природная питьевая вода.', 88),

    -- p011: Samal 0.5л
    ('4870200003014', 'Samal 0.5л', 'Samal', 'grocery', 'yes', '/products/6.png',
     'Питьевая вода.', 72),

    -- p012: Samal 1л
    ('4870200003015', 'Samal 1л', 'Samal', 'grocery', 'yes', '/products/6_1.png',
     'Питьевая вода.', 72),

    -- p013: Рис Цесна 700г
    ('4870200003020', 'Рис Цесна 700г', 'Цесна', 'grocery', 'yes', '/products/7.png',
     'Рис длиннозёрный шлифованный.', 82),

    -- p014: Рис Makfa 800г
    ('4870200003021', 'Рис Makfa 800г', 'Makfa', 'grocery', 'yes', '/products/7_1.png',
     'Рис пропаренный.', 78),

    -- p015: Тушёнка Кублей говядина 338г
    ('4870200003022', 'Тушёнка Кублей говядина 338г', 'Halal Meat KZ', 'grocery', 'yes', '/products/8.png',
     'Говядина, жир говяжий, лук репчатый, соль поваренная, перец чёрный молотый, лавровый лист. Халал.', 77),

    -- p016: Колбаса Мама Может 400г
    ('4870200003023', 'Колбаса Мама Может 400г', 'Мясокомбинат', 'grocery', 'no', '/products/12.png',
     'Свинина, говядина, крахмал картофельный, соль, специи, усилитель вкуса E621.', 55)

  ON CONFLICT (ean) DO UPDATE SET
    name               = EXCLUDED.name,
    brand              = EXCLUDED.brand,
    category           = EXCLUDED.category,
    halal_status       = EXCLUDED.halal_status,
    image_url          = EXCLUDED.image_url,
    ingredients_raw    = EXCLUDED.ingredients_raw,
    data_quality_score = EXCLUDED.data_quality_score;

  -- ═══════════════════════════════════════════════════════════════════
  -- 3. ПРИВЯЗКА ТОВАРОВ К МАГАЗИНУ (store_products)
  --    Цены и полки из src/data/storeInventories.js
  -- ═══════════════════════════════════════════════════════════════════
  DELETE FROM store_products WHERE store_id = v_store_id;

  INSERT INTO store_products (store_id, ean, global_product_id, price_kzt, stock_status, shelf_zone, is_active)
  SELECT
    v_store_id,
    gp.ean,
    gp.id,
    inv.price,
    'in_stock',
    inv.shelf,
    true
  FROM (VALUES
    ('4600000102452'::text, 420, 'Полка C1'),
    ('4600000102453',       620, 'Полка C1'),
    ('4600000103012',       180, 'Полка C1'),
    ('5000112546324',       320, 'Полка B1'),
    ('5000112546325',       520, 'Полка B1'),
    ('5000112546326',       340, 'Полка B1'),
    ('4890008100309',       300, 'Полка B2'),
    ('4870200003011',       220, 'Полка B3'),
    ('4870200003012',       180, 'Полка A1'),
    ('4870200003013',       260, 'Полка A1'),
    ('4870200003014',       150, 'Полка A2'),
    ('4870200003015',       200, 'Полка A2'),
    ('4870200003020',       890, 'Полка D1'),
    ('4870200003021',       750, 'Полка D1'),
    ('4870200003022',      1750, 'Полка E2'),
    ('4870200003023',      1890, 'Полка E1')
  ) AS inv(ean, price, shelf)
  JOIN global_products gp ON gp.ean = inv.ean;

  RAISE NOTICE 'Синхронизация завершена: 16 товаров привязано к store-one (id=%)', v_store_id;

END $$;
