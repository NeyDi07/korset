import { useI18n } from '../i18n/index.js'

export default function RouteLoader() {
  const { t } = useI18n()
  return (
    <div className="route-loader" role="status" aria-live="polite">
      <div className="route-loader__spinner" aria-label={t('common.loading')} />
    </div>
  )
}
