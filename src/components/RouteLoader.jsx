import { useI18n } from '../utils/i18n'

export default function RouteLoader() {
  const { t } = useI18n()
  return (
    <div className="route-loader" role="status" aria-live="polite">
      <div className="route-loader__spinner" aria-label={t.common.loading} />
    </div>
  )
}
