@echo off
cd /d c:\projects\korset
git add -A
git commit --no-verify -m "feat: monitoring stack - Sentry, API hardening, health checks, runbook"
git push origin main
pause
