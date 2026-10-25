# ISSUES.md — Codebase Audit

Dibuat: 2026-10-25 · Branch `dev` · Scope: seluruh repo (`apps/server` Go/Fiber/Authula, `apps/web-ui` React/Vite, `apps/main-web`, infra Docker)

Dua bagian, sesuai permintaan:

1. **Security audit** — diurutkan dari level paling berisiko. Tidak ada temuan Critical/High; basisnya sudah di-hardening dengan baik (detail di bagian "Already solid").
2. **Ponytail audit** (complexity/dead-code, format asli skill `ponytail-audit`).

Catatan metode: review manual atas middleware, auth (Authula + bearer/session), SecretBox, netguard (SSRF), mailsync (IMAP/SMTP over TLS), mailoauth (state HMAC + PKCE), LLM client, config validation, rendering HTML email di web-ui, token storage, Dockerfile/compose, plus `pnpm audit --prod`.

**Status perbaikan (2026-10-25, sesi yang sama):** S-1, S-2, S-3, S-5, S-6, S-8 dan seluruh temuan ponytail sudah diperbaiki dan diverifikasi (test integrasi Go lulus, CSP diuji langsung di browser — iframe email srcdoc dirender, script email diblokir, gambar https/http termuat; SPA sign-in/dashboard/settings berjalan normal di bawah CSP). S-4 sengaja di-defer (lihat catatannya). S-7 tidak memerlukan perubahan.

---

## 1. Security findings (urut level)

### S-1 · Medium — Auth token disimpan di cookie yang bisa dibaca JavaScript — ✅ FIXED (parsial, disengaja)

- **Where:** `apps/web-ui/src/lib/auth/token-storage.ts`; server TTL di `apps/server/cmd/api/authula.go` (`refreshTokenTTL = 24h`)
- **What:** Access, refresh, dan id token ditulis via `document.cookie` (non-HttpOnly) agar bisa dikirim sebagai `Authorization: Bearer` ke API lintas origin. Refresh cookie di-set `Max-Age` 30 hari, padahal server hanya mengesahkan refresh token 24 jam.
- **Diperbaiki:** `REFRESH_TOKEN_MAX_AGE` 30 hari → 24 jam (selaras TTL server), plus dokumentasi tradeoff XSS/BFF di header `token-storage.ts`. Pola non-HttpOnly dipertahankan secara disengaja untuk kasus self-hosted lintas origin; BFF HttpOnly untuk edisi hosted ditandai sebagai arah masa depan di komentar tersebut.

### S-2 · Medium — Tidak ada Content-Security-Policy pada respons server — ✅ FIXED

- **Where:** `apps/server/cmd/api/server.go` (helmet)
- **What:** SPA shell dan API disajikan tanpa header CSP sama sekali.
- **Diperbaiki:** CSP enforced di semua respons: `default-src 'self'`, `script-src 'self' 'unsafe-inline'` (bootstrap next-themes), `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: https: http:` dan `font-src 'self' data: https:` — dua allowlist terakhir sengaja longgar karena iframe `srcdoc` email mewarisi CSP parent (gambar `http:` newsletter lama dan font eksternal email tetap jalan; script email tetap diblokir oleh sandbox attribute, bukan CSP). `connect-src` menutup `self` + https + localhost untuk dev/self-host. Terverifikasi di browser: halaman sign-in, dashboard, settings, dan iframe email semuanya berfungsi.

### S-3 · Low — Tidak ada HSTS — ✅ FIXED

- **Where:** `apps/server/cmd/api/server.go`
- **Diperbaiki:** `HSTSMaxAge: 31536000` (dengan `includeSubDomains` default helmet). Helmet fiber hanya mengirim header pada request TLS (`c.Secure()`), jadi aman untuk semua environment.

### S-4 · Low — Rate limiter & cache idempotency in-memory, per-replika — ⏸ DEFERRED (keputusan infra)

- **Where:** `apps/server/internal/middlewares/rate_limit.go`, `apps/server/internal/middlewares/idempotency.go`
- **What:** Budget rate-limit dan dedup idempotency hidup di memori proses; dengan >1 replika proteksi terpecah N kali tanpa error.
- **Tidak diperbaiki sekarang:** solusinya adalah shared store (Redis), yang berarti dependensi + konfigurasi + keputusan deployment baru — di luar cakupan perbaikan cepat ini dan memang ditandai `ponytail:` di kode sebagai pekerjaan "sebelum scale-out". Aman selama masih satu instance. Jalankan sebelum menambah replika kedua.

### S-5 · Low — Activity log menyimpan PII tanpa retensi — ✅ FIXED

- **Where:** migration 000009, `apps/server/internal/repositories/activity_log.go`, `cmd/api/server.go`
- **Diperbaiki:** retention sweep — flag/env `ACTIVITY_LOG_RETENTION` (default 8760h = 1 tahun, `0` = simpan selamanya), repo method `DeleteOlderThan`, dan sweeper harian yang jalan saat boot + tiap 24 jam di `serve()` (log info jumlah baris yang dihapus, warning jika gagal). Terdokumentasi di `.env.example`.

### S-6 · Low — Advisory dependensi + scan belum otomatis — ✅ FIXED

- **Diperbaiki:** `pnpm-workspace.yaml` kini membawa `overrides` minimum-version (`vite>=8.3.3`, `zod>=4.6.6`, `undici>=7.30.1`, `fflate>=0.7.5`) — `pnpm audit --prod` kini bersih ("No known vulnerabilities found"). Dev deps root juga di-upgrade. Ditambahkan workflow CI `.github/workflows/security-audit.yml`: `govulncheck ./...` (blocking) + `pnpm audit --prod`, jalan di push/PR main & dev dan mingguan.
- Catatan: override ini penting terutama untuk chain build main-web; hapus entri override ketika paket pemanggilnya sendiri sudah naik versi.

### S-7 · Info — CSRF bertumpu pada pasangan SameSite=Lax + middleware CrossOrigin (kombinasi yang benar) — ℹ️ NO CHANGE NEEDED

- **Where:** `apps/server/cmd/api/server.go`, `apps/server/internal/middlewares/cross_origin.go`
- Kombinasi sudah benar dan saling melengkapi; catatan dokumentasi agar pasangan ini tidak dibongkar salah satu saja. Jaga `CORS_ALLOWED_ORIGINS` seminimal mungkin.

### S-8 · Info — CSP frame email memuat term mati `cid:` — ✅ FIXED

- **Where:** `apps/web-ui/src/components/block/mail/mail-body.tsx`
- **Diperbaiki:** `cid:` dihapus dari `img-src` (tidak pernah bisa di-fetch browser). Gambar `http:` dipertahankan (newsletter lama; juga dijelaskan di komentar dan dibatasi pula oleh CSP server yang mewarisi).

---

## 2. Ponytail audit (complexity — format asli skill)

```
delete: dead helper mutateByID, no caller left since the activity-log refactor. Replacement: nothing. [apps/server/internal/handlers/common.go:41] — FIXED
delete: activityLogQueries.mine/.byOrganization, only infinite() is called. Replacement: re-add when a paginated table needs them. [apps/web-ui/src/lib/api/queries/activity-log.ts] — FIXED
yagni: mustJSON wraps json.Marshal for a single call site. Replacement: inline json.Marshal and drop the helper. [apps/server/internal/handlers/common.go] — FIXED
net: -41 lines, -0 deps possible.
```

Retraksi: temuan awal menandai `apps/web-ui/src/lib/string.ts` sebagai dead code — **false positive**; `capitalizeFirstLetter` dipakai `components/layout/sidebar/layout.tsx`. File tetap ada.

Tidak ditemukan: hand-rolled stdlib, dependency yang sudah disediakan platform, factory satu produk lainnya.

---

## 3. Already solid (jangan di-flag ulang)

Inventaris singkat supaya reviewer berikutnya tidak menandai ulang hal yang sudah benar:

- **Auth/session** — Authula: session cookie HttpOnly+Secure (prod), `MaxSessionsPerUser: 5`, access JWT 15 mnt, refresh 24 jam dan di-revoke saat ganti password; middleware `Authorization` memvalidasi JWT *dan* mengecek session masih hidup (sign-out benar-benar me-revoke).
- **CSRF/CORS** — `CrossOrigin` global (termasuk rute Authula), CORS allowlist eksplisit, tanpa wildcard bersama credentials.
- **SSRF** — `lib.GuardedDialer` menutup loopback/private/CGNAT/metadata **pada connect time** (DNS rebinding tertangkap); dipakai untuk IMAP, SMTP, dan LLM base URL milik user.
- **TLS** — IMAP/SMTP implicit-TLS/STARTTLS dengan `MinVersion TLS 1.2` + verifikasi sertifikat; SMTP menolak server tanpa STARTTLS.
- **Secrets** — AES-256-GCM (`SecretBox`, key domain-separated) untuk password IMAP & API key LLM; SQL text-only di log; `DEBUG` di produksi ditolak oleh `validateFlag`; password hash hanya muncul di debug logging.
- **SQL injection** — semua query pakai bind parameter; `ORDER BY` lewat whitelist (`resolveOrder`); folder IMAP dari konstanta, bukan input bebas.
- **Konfigurasi** — `APP_SECRET` min 32 karakter divalidasi saat boot; `.env` gitignored, `.env.example` placeholder saja; Postgres tidak publish port di compose; image distroless nonroot tanpa shell.
- **XSS email** — HTML email dirender di iframe `sandbox` tanpa `allow-scripts` + CSP `default-src 'none'`; printer email meng-escape semua header.
- **Input** — semua body/query divalidasi (422 dengan field errors), lampiran dibatasi jumlah + total byte, recipients dibatasi, error handler tidak pernah membocorkan error internal (500 generik).
- **Header HTTP** — sejak S-2/S-3: CSP, HSTS (TLS only), nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy no-referrer, COOP/CORP.
