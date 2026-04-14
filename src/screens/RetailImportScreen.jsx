import { useI18n } from '../utils/i18n.js'

export default function RetailImportScreen() {
  const { lang } = useI18n()
  const isKz = lang === 'kz'

  return (
    <div style={{ padding: '20px 16px 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-display)', color: '#fff', margin: '0 0 8px' }}>
          {isKz ? 'Прайс-парақты жүктеу' : 'Загрузка прайс-листа'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-sub)', margin: 0, lineHeight: 1.4 }}>
          {isKz 
            ? 'Тауарларды жаппай жаңарту үшін Excel немесе CSV файлын жүктеңіз.' 
            : 'Загрузите Excel или CSV файл для массового обновления товаров и цен.'}
        </p>
      </div>

      {/* Drag & Drop Area */}
      <label style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 20px', borderRadius: 24, cursor: 'pointer',
        background: 'rgba(56, 189, 248, 0.05)',
        border: '2px dashed rgba(56, 189, 248, 0.4)',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ 
          width: 64, height: 64, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          boxShadow: '0 4px 20px rgba(56, 189, 248, 0.2)'
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
          {isKz ? 'Файлды таңдаңыз' : 'Выберите файл'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>
          {isKz ? 'XLSX, XLS немесе CSV (макс. 5MB)' : 'Поддерживаются XLSX, XLS или CSV (макс. 5MB)'}
        </div>
        <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" style={{ display: 'none' }} />
      </label>

      {/* Requirements Section */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-display)', color: '#fff', marginBottom: 12 }}>
          {isKz ? 'Файлға қойылатын талаптар' : 'Требования к файлу'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { 
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
              title: isKz ? 'Міндетті бағандар' : 'Обязательные колонки',
              desc: isKz ? 'Файлда Штрихкод (EAN) және Баға (Price) бағандары болуы керек.' : 'В файле должны быть колонки Штрихкод (EAN) и Цена (Price).' 
            },
            {
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
              title: isKz ? 'Дубликаттарсыз' : 'Без дубликатов',
              desc: isKz ? 'Бір штрихкодқа тек бір баға болуы тиіс.' : 'Один штрихкод должен встречаться в файле только один раз.'
            },
            {
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
              title: isKz ? 'Автоматты жасау' : 'Умное распознавание',
              desc: isKz ? 'Жаңа штрихкодтар базаға автоматты түрде қосылады.' : 'Товары с новыми EAN будут автоматически добавлены в вашу витрину.'
            }
          ].map((req, i) => (
            <div key={i} style={{ 
              display: 'flex', gap: 12, padding: 16, borderRadius: 16, 
              background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{ flexShrink: 0, marginTop: 2 }}>{req.icon}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{req.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.4 }}>{req.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Template Download */}
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <button style={{
          background: 'none', border: 'none', padding: '10px 20px',
          color: '#38BDF8', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          textDecoration: 'underline', textUnderlineOffset: 4
        }}>
          {isKz ? 'Үлгіні жүктеп алу (XLSX)' : 'Скачать шаблон (XLSX)'}
        </button>
      </div>

    </div>
  )
}
