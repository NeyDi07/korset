import { useState } from 'react'
import { useI18n } from '../utils/i18n.js'

export default function RetailSettingsScreen() {
  const { lang } = useI18n()
  const isKz = lang === 'kz'

  const [settings, setSettings] = useState({
    name: 'Магазин "Продукты у дома"',
    address: 'ул. Абая 15, Алматы',
    notifyMissing: true,
    notifyDaily: false,
  })

  const handleChange = (key, val) => setSettings(p => ({ ...p, [key]: val }))

  return (
    <div style={{ padding: '20px 16px 80px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-display)', color: '#fff', margin: '0 0 4px' }}>
          {isKz ? 'Магазин баптаулары' : 'Настройки профиля'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-sub)', margin: 0 }}>
          {isKz ? 'Сауда нүктесін басқару' : 'Управление торговой точкой'}
        </p>
      </div>

      {/* Main Info Box */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingLeft: 4 }}>
          {isKz ? 'НЕГІЗГІ АҚПАРАТ' : 'ОСНОВНАЯ ИНФОРМАЦИЯ'}
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
          
          <div style={{ padding: '16px 16px' }}>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 6 }}>{isKz ? 'Дүкен атауы' : 'Название объекта'}</div>
            <input 
              type="text" 
              value={settings.name} 
              onChange={e => handleChange('name', e.target.value)}
              style={{
                width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', padding: '12px 14px', borderRadius: 10, fontSize: 15, outline: 'none'
              }}
            />
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

          <div style={{ padding: '16px 16px' }}>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 6 }}>{isKz ? 'Мекенжай' : 'Фактический адрес'}</div>
            <input 
              type="text" 
              value={settings.address} 
              onChange={e => handleChange('address', e.target.value)}
              style={{
                width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', padding: '12px 14px', borderRadius: 10, fontSize: 15, outline: 'none'
              }}
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingLeft: 4 }}>
          {isKz ? 'ХАБАРЛАНДЫРУЛАР' : 'УВЕДОМЛЕНИЯ'}
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 }}>
          
          {/* Toggle 1 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}>
            <div>
              <div style={{ fontSize: 15, color: '#fff', fontWeight: 500, marginBottom: 4 }}>{isKz ? 'Жоқ тауарлар' : 'Отсутствующие товары'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{isKz ? 'Сатып алушылар таба алмаған тауарлар туралы хабарлау' : 'Пуш-уведомление, если клиент не нашел товар'}</div>
            </div>
            <div 
              onClick={() => handleChange('notifyMissing', !settings.notifyMissing)} 
              style={{ 
                width: 50, height: 28, borderRadius: 14, cursor: 'pointer', flexShrink: 0,
                background: settings.notifyMissing ? '#38BDF8' : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: 'background 0.3s'
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: settings.notifyMissing ? 25 : 3,
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                transition: 'left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              }} />
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 16px' }} />

          {/* Toggle 2 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}>
            <div>
              <div style={{ fontSize: 15, color: '#fff', fontWeight: 500, marginBottom: 4 }}>{isKz ? 'Күнделікті есеп' : 'Ежедневный отчет'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{isKz ? 'Кешкі сканерлеу статистикасы' : 'Сводка сканирований каждый вечер'}</div>
            </div>
            <div 
              onClick={() => handleChange('notifyDaily', !settings.notifyDaily)} 
              style={{ 
                width: 50, height: 28, borderRadius: 14, cursor: 'pointer', flexShrink: 0,
                background: settings.notifyDaily ? '#38BDF8' : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: 'background 0.3s'
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: settings.notifyDaily ? 25 : 3,
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                transition: 'left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              }} />
            </div>
          </div>

        </div>
      </div>

      {/* Danger Zone */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#EF4444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingLeft: 4 }}>
          {isKz ? 'ҚАУІПТІ АЙМАҚ' : 'ОПАСНАЯ ЗОНА'}
        </div>
        <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 16 }}>
          <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
             <div>
               <div style={{ fontSize: 15, color: '#EF4444', fontWeight: 500, marginBottom: 4 }}>{isKz ? 'Каталогты тазарту' : 'Очистить каталог'}</div>
               <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{isKz ? 'Барлық жүктелген тауарларды өшіру' : 'Удалить все добавленные товары из системы'}</div>
             </div>
             <button style={{ background: 'rgba(239, 68, 68, 0.15)', border: 'none', color: '#EF4444', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
               {isKz ? 'Тазарту' : 'Сброс'}
             </button>
          </div>
        </div>
      </div>

    </div>
  )
}
