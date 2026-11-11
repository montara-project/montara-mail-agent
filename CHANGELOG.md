# Changelog

All notable changes to this project are documented in this file. Versions follow the git tags (`v*`); Docker images are published to ghcr.io with the same version.


## [1.8.0](https://github.com/montara-project/montara-mail-agent/compare/v1.7.0...v1.8.0) (2026-11-11)

### Features

* **server:** list the OAuth providers this server has a client for ([50b0c23](https://github.com/montara-project/montara-mail-agent/commit/50b0c23d47d5b80255fc7b92dbff003ab16b6690))
* **web-ui:** paginate blocked addresses and active sessions ([2d26223](https://github.com/montara-project/montara-mail-agent/commit/2d26223fca945f01f74ed74c93df8a59719dc35d))
* **web-ui:** show only the OAuth ways in the server can serve ([52a7680](https://github.com/montara-project/montara-mail-agent/commit/52a7680e3207dde1e7e7f2916b9cfb881cb4b6af))

### Bug Fixes

* **server:** bump go 1.27.4 for govulncheck ([6afc1b8](https://github.com/montara-project/montara-mail-agent/commit/6afc1b87f8fcc72a5b28eae8cb112787d8580241))
* **server:** pin the go 1.27.4 build image and tidy OAuth review notes ([d20f1f8](https://github.com/montara-project/montara-mail-agent/commit/d20f1f862461858195a90d0819266e2e5b8c2335))
* **server:** refuse Outlook app passwords up front ([b27e030](https://github.com/montara-project/montara-mail-agent/commit/b27e03038432c5c7c388fbd8a658608001677436))
* **server:** send OAuth returns to the API's own origin on Origin: null ([81ab9b8](https://github.com/montara-project/montara-mail-agent/commit/81ab9b828d328e921bc7700b19c2c2bd9f977629))
* **web-ui:** handle a failed OAuth provider list and touch-capable pointers ([d717914](https://github.com/montara-project/montara-mail-agent/commit/d7179145b3e09d41a3eee2e10566317ee17f7404))

## [1.7.0](https://github.com/montara-project/montara-mail-agent/compare/v1.6.0...v1.7.0) (2026-11-07)

### Features

* **auth:** add passkey sign-in and revoking sessions ([984563e](https://github.com/montara-project/montara-mail-agent/commit/984563e762a2512849a01560eeff0e4c6af07b51))
* **server:** confirm identity before adding a passkey or TOTP ([652b18c](https://github.com/montara-project/montara-mail-agent/commit/652b18c4704f3a237175ffdeca583a4f9cf07baf))
* **web-ui:** ask for the password before adding a passkey or 2FA ([525285d](https://github.com/montara-project/montara-mail-agent/commit/525285d43b3d961c77e9c83631c5011ad98738e6))

### Bug Fixes

* **server:** revoke credentials before a password is written ([c1c3748](https://github.com/montara-project/montara-mail-agent/commit/c1c3748f868d4989bbfbebb27079151e209db8fd))
* **server:** upgrade authula to v1.50.1 and patch vulnerable deps ([539ac23](https://github.com/montara-project/montara-mail-agent/commit/539ac2315233d0856b057a30b925a78f3ca90b45))
* update login oauth button ([58d9dde](https://github.com/montara-project/montara-mail-agent/commit/58d9ddef3d65012c1070fbd988cc72ca187d5a44))
* update mailoauth ([b3a437e](https://github.com/montara-project/montara-mail-agent/commit/b3a437e47c7a621a58046e43beca174baf5666b8))
* **web-ui:** recognize Firefox and Chrome on iOS in session names ([347b629](https://github.com/montara-project/montara-mail-agent/commit/347b6292729b1d6edd5f5ed7af8990ab441ca84a))

## [1.6.0](https://github.com/montara-project/montara-mail-agent/compare/v1.5.0...v1.6.0) (2026-11-04)

### Features

* **auth:** add sign in with Microsoft (Outlook) ([b3e7c5c](https://github.com/montara-project/montara-mail-agent/commit/b3e7c5cb323427ec87e947e3dd1d792658f4b08c))

### Bug Fixes

* update authula ([d324935](https://github.com/montara-project/montara-mail-agent/commit/d3249353b22ef9084c7585b15ec602983d914b87))
* update well known ([3e206a9](https://github.com/montara-project/montara-mail-agent/commit/3e206a94b867efbd0f58aaa46292c35e6bc45011))

## [1.5.0](https://github.com/montara-project/montara-mail-agent/compare/v1.4.0...v1.5.0) (2026-11-03)

### Bug Fixes

* update adjustment text size for comfortable ([b1e467b](https://github.com/montara-project/montara-mail-agent/commit/b1e467b84c90964882780f73ba3d250c6837cf4d))
* update billing and invoice page ([3ec546b](https://github.com/montara-project/montara-mail-agent/commit/3ec546bfe095537ab2a7ae92527b72b5fa534b40))
* update minor ([65a44ad](https://github.com/montara-project/montara-mail-agent/commit/65a44ad15375c90976173fd74552a8f859f7508e))

## [1.4.0](https://github.com/montara-project/montara-mail-agent/compare/v1.3.0...v1.4.0) (2026-11-03)

### Bug Fixes

* update custom skills per user ([33f8d3a](https://github.com/montara-project/montara-mail-agent/commit/33f8d3af259fa805389fab81005accf899a84b83))
* update draft/reply skills ([9d166aa](https://github.com/montara-project/montara-mail-agent/commit/9d166aa44d54d30ff17bf39de7af9b299efd5c30))
* update email count badge ([8eee981](https://github.com/montara-project/montara-mail-agent/commit/8eee98105cf65456f7cc283875ddb78ae4323b6c))
* update font style ([e5b87d4](https://github.com/montara-project/montara-mail-agent/commit/e5b87d48cd6a75c578a5c62941b036b4bd58d352))
* update mcp ([aaf18f7](https://github.com/montara-project/montara-mail-agent/commit/aaf18f79e63961494e5a1d4d291def8846dd5547))

## [1.3.0](https://github.com/montara-project/montara-mail-agent/compare/v1.2.0...v1.3.0) (2026-11-03)

### Bug Fixes

* update bug and improve billing page ([d4c6fbe](https://github.com/montara-project/montara-mail-agent/commit/d4c6fbe588680c902a826aadf927ccccabf8aae3))
* update pending payment ([e90a50b](https://github.com/montara-project/montara-mail-agent/commit/e90a50bb74df3fb2c5a2e14dd05a84d7fbb0ad70))

## [1.2.0](https://github.com/montara-project/montara-mail-agent/compare/v1.1.0...v1.2.0) (2026-11-03)

### Features

* add design file ([86f4794](https://github.com/montara-project/montara-mail-agent/commit/86f4794fd7fe971459bde78e24760d26d3d6ced8))
* **web-ui:** add a compact size to the OTP code input ([6ceca42](https://github.com/montara-project/montara-mail-agent/commit/6ceca42c7b25df7daba94a8a83698df2aa767250))
* **web-ui:** align the account page with its design ([5db4cb3](https://github.com/montara-project/montara-mail-agent/commit/5db4cb38ea48ec06b00bfac523649bf75da554dc))
* **web-ui:** rework base palette tokens to dark-first design system ([60ab15d](https://github.com/montara-project/montara-mail-agent/commit/60ab15d69f7edfbe66cdd879e289322c1513723d))

### Bug Fixes

* update billing page ([160d80d](https://github.com/montara-project/montara-mail-agent/commit/160d80d9c646e64e20b32ec0bc9c6ef8e7287fd9))
* update design ([fce7f84](https://github.com/montara-project/montara-mail-agent/commit/fce7f84c3b1e0d4a79982afb8810398987a94b49))
* update minor ui and light theme ([e911a24](https://github.com/montara-project/montara-mail-agent/commit/e911a240db9b0db03230fa9886f4f88a30f5a01e))
* update polish UI ([3335749](https://github.com/montara-project/montara-mail-agent/commit/3335749a3a66d8d42987c1ae528c6ec806a2332d))
* **web-ui:** align the dashboard with its design ([bb94e6b](https://github.com/montara-project/montara-mail-agent/commit/bb94e6b7b202e283fdfcc53db7e8afccada77ac2))
* **web-ui:** align the floating assistant and move toasts off its corner ([66d0de4](https://github.com/montara-project/montara-mail-agent/commit/66d0de4a3bd4f446704d9f797b122c5c2615eb14))
* **web-ui:** align the mail sidebar with its design ([0997e97](https://github.com/montara-project/montara-mail-agent/commit/0997e970aaefd2d9effc84a3fd20bc7eda136b26))
* **web-ui:** claim healthy connections only once the accounts load ([e26273c](https://github.com/montara-project/montara-mail-agent/commit/e26273c6cdb9f54993d7e2b47aa5915de0430cde))
* **web-ui:** fit the sign-in card to narrow screens and word the backup step ([e01d045](https://github.com/montara-project/montara-mail-agent/commit/e01d045e9c6d79ed364acdbc1d605ae2f2faa635))
* **web-ui:** focus the subject once loaded and leave archived mail on E ([2e0a691](https://github.com/montara-project/montara-mail-agent/commit/2e0a6919dbb9c21afd8d3fd34c398001864f619f))
* **web-ui:** inset settings toggle rows like the skills list ([9cd35d0](https://github.com/montara-project/montara-mail-agent/commit/9cd35d0516a891a8152aab18fd33db59be633b29))
* **web-ui:** keep rail buttons one size when the sidebar collapses ([1e838ca](https://github.com/montara-project/montara-mail-agent/commit/1e838ca82506f11357023e2ac0be84925e47a274))
* **web-ui:** keep sidebar and header stable and polish accounts panel ([61d6406](https://github.com/montara-project/montara-mail-agent/commit/61d64061bcc7acff616a116a3089888f86187652))
* **web-ui:** keep the compose draft on Minus and drop a duplicate file name ([625c030](https://github.com/montara-project/montara-mail-agent/commit/625c030ca03bb9ad1deef1eaa562e6da0653c43b))
* **web-ui:** match sidebar spacing and footers to the design ([d01462e](https://github.com/montara-project/montara-mail-agent/commit/d01462ea27fa6f2d90b80ba5deb7977576313701))
* **web-ui:** open the named mailbox from ?account= in either inbox mode ([83aee4c](https://github.com/montara-project/montara-mail-agent/commit/83aee4cc79d4252aff59f0bc7a6679cd49a39ffb))
* **web-ui:** put the settings index in the settings column ([1aed478](https://github.com/montara-project/montara-mail-agent/commit/1aed478596efb065293289eaf8dbc8a260bb371c))
* **web-ui:** toast a missing clipboard and name the avatar URL control ([e9b164d](https://github.com/montara-project/montara-mail-agent/commit/e9b164d769ac8b7acea25917e5e23c6fd1881fa7))

## [1.1.0](https://github.com/montara-project/montara-mail-agent/compare/v1.0.0...v1.1.0) (2026-10-31)

### Features

* move an email account between the user's own organizations ([e2af4a5](https://github.com/montara-project/montara-mail-agent/commit/e2af4a5bf070daa8283b412a0965f07974ee4950))
* **web-ui:** show token usage in the Mail sidebar ([956fc3a](https://github.com/montara-project/montara-mail-agent/commit/956fc3a6721358fe399b8eeaa40ff304a0f842e4))

## [1.0.0](https://github.com/montara-project/montara-mail-agent/compare/v0.9.0...v1.0.0) (2026-10-31)

### ⚠ BREAKING CHANGES

* replace the global LLM provider scope with the platform one

### Features

* add an AI Assistant Panel position preference ([a9d7aa5](https://github.com/montara-project/montara-mail-agent/commit/a9d7aa5ddbfe29461b3f1794269b10efade317bd))
* add plans, subscriptions and a wallet to the Cloud Edition ([b9030f3](https://github.com/montara-project/montara-mail-agent/commit/b9030f318f3957b9291c169f13ab7bfc872c76bb))
* **main-web:** add the pricing page ([396c9c3](https://github.com/montara-project/montara-mail-agent/commit/396c9c3fb2f7a09fb21d279d2da9330496d648f9))
* **main-web:** improve SEO and match the home page to the product ([0fa7226](https://github.com/montara-project/montara-mail-agent/commit/0fa7226da7f8fa8242288a0bbbc1b41bb337073a))
* **main-web:** prerender the site and redirect HTTP to HTTPS ([9092641](https://github.com/montara-project/montara-mail-agent/commit/90926419d05b5d2259ad62febd9a1a03b8a452ad))
* page the top-up history and polish the checkout dialog ([49f6af9](https://github.com/montara-project/montara-mail-agent/commit/49f6af917a9409bec82c25ab3df53b3405dad797))
* scope organization selection to the user's own organizations ([aa61d81](https://github.com/montara-project/montara-mail-agent/commit/aa61d8142df2b7b1c6bf855cf76a1b3a86bb117e))
* **server:** label OAuth mailboxes with the owner's display name ([b5dc556](https://github.com/montara-project/montara-mail-agent/commit/b5dc55698be4c3f46250540f7c4825add2449791))
* show the sign-in method and hide Change password without a password ([5cc46ff](https://github.com/montara-project/montara-mail-agent/commit/5cc46ff41a39a6fa01f9143469c9d1ee036ee393))
* token quotas with BorderPay top-ups and a platform provider scope ([62952a7](https://github.com/montara-project/montara-mail-agent/commit/62952a7ba6d337e4a673afcc75531c5e85d4c42c))
* **web-ui:** add an organization from the no organization empty state ([19e79c3](https://github.com/montara-project/montara-mail-agent/commit/19e79c3464f21dcb3db64610e2caebce05033979))
* **web-ui:** add top-up invoices and polish the billing page ([3e06798](https://github.com/montara-project/montara-mail-agent/commit/3e067986f61c6d3de67902955cf4c8654c1b069a))
* **web-ui:** limit the AI Providers page to super users ([06bfeb9](https://github.com/montara-project/montara-mail-agent/commit/06bfeb9a4d52546c2d35a41d1aacf4030ea9e947))
* **web-ui:** make the self hosted server choice Community only ([ca8abb1](https://github.com/montara-project/montara-mail-agent/commit/ca8abb171608e9b5eac44d46dc98efad694dfdf1))
* **web-ui:** open the floating AI assistant from a corner button ([3c20a91](https://github.com/montara-project/montara-mail-agent/commit/3c20a91153e9f72f3fd15c0449f9d052fb892b8f))
* **web-ui:** show token usage in the Platform sidebar ([f9187d2](https://github.com/montara-project/montara-mail-agent/commit/f9187d2d918dfc56060e3b464a52e500c34a8866))

### Bug Fixes

* a review pass over disclosures, docs, and organization state ([c7ae01c](https://github.com/montara-project/montara-mail-agent/commit/c7ae01cb19f1eb4e420a3547a7ad751cef6541e1))
* ask for the two-factor code after Google sign-in ([437a314](https://github.com/montara-project/montara-mail-agent/commit/437a3141c1c4754808f990195048ab4b5295205d))
* **deps:** update follow-redirects to 1.16.2 for GHSA-mrwp-f3q8-3g9p ([2788c9d](https://github.com/montara-project/montara-mail-agent/commit/2788c9df7173376dab73608c58fb0898175e4133))
* harden the token quota and pay-as-you-go flow ([491a691](https://github.com/montara-project/montara-mail-agent/commit/491a69130ff6870d027b6e6c0fa9fa185a2ab211))
* keep billing webhooks and abandoned checkouts from getting stuck ([687cde0](https://github.com/montara-project/montara-mail-agent/commit/687cde03c4197bfa1b5572e9dbbf4adbb6bac542))
* **main-web:** add nosniff, frame and referrer headers ([52e533c](https://github.com/montara-project/montara-mail-agent/commit/52e533ceeb4d6e6aae2a989df4fa4e6556245c1c))
* **main-web:** show Enterprise as Custom and end the promo on time ([b4307d5](https://github.com/montara-project/montara-mail-agent/commit/b4307d520353e18548266e6e2f6c880ed68f078b))
* **server:** close the ways AI calls could skip the token quota ([687e632](https://github.com/montara-project/montara-mail-agent/commit/687e63277c35b0d5258783cbaa0efef06526b35b))
* **server:** harden subscription renewal and the token balance ([6d08d27](https://github.com/montara-project/montara-mail-agent/commit/6d08d2727d3d9190e62fd9c7878a15fa87d6cda1))
* **server:** issue the session cookie on the Google sign-in redirect ([b1303a7](https://github.com/montara-project/montara-mail-agent/commit/b1303a7ef450182eed56f8fbfd90654ab2c5895f))
* **server:** repair the two token sweeps that failed on every boot ([654dee6](https://github.com/montara-project/montara-mail-agent/commit/654dee6f8a795d54afabb0c4177df62156cc356b))
* update agent panel ([6b85fdc](https://github.com/montara-project/montara-mail-agent/commit/6b85fdc90a63467bb8706c475af078f953266765))
* update email on main-web ([e0d13a9](https://github.com/montara-project/montara-mail-agent/commit/e0d13a97b9693bbfc518f031ac5c47ec65ef438a))
* update github runner ([3a96ce5](https://github.com/montara-project/montara-mail-agent/commit/3a96ce53e6d7d44f599cbbfc234439d9a92ff94c))
* update link get early access ([f96d6da](https://github.com/montara-project/montara-mail-agent/commit/f96d6daa0a253ed463012c9eb186d470e47e646b))
* update linter ([b3351e1](https://github.com/montara-project/montara-mail-agent/commit/b3351e170aef49a5aa4b2e5267a2193ad8f5f6ae))
* update order billing card ([747cf8a](https://github.com/montara-project/montara-mail-agent/commit/747cf8a217ca8ac25a146e3fe2eccc4649881364))
* update plans ([1ab4e85](https://github.com/montara-project/montara-mail-agent/commit/1ab4e85dd45cb33cad7a75c745946e7522180c5f))
* update runner ([cd8733b](https://github.com/montara-project/montara-mail-agent/commit/cd8733bbf6f4d722030e2674eea14b2cf82ac139))
* update settings security ([4c92697](https://github.com/montara-project/montara-mail-agent/commit/4c92697ab1c1a37bfe00cbeb57c85341f69eda4c))
* **web-ui:** redirect everyone but a super user away from IP blocks ([5ee6d25](https://github.com/montara-project/montara-mail-agent/commit/5ee6d253a6c2f76de8a4b54605460b8dfa983b9d))

### Code Refactoring

* replace the global LLM provider scope with the platform one ([93f8b87](https://github.com/montara-project/montara-mail-agent/commit/93f8b8713f25d7641ea628a0531ec0b599cbe317))

## [0.9.0](https://github.com/montara-project/montara-mail-agent/compare/v0.8.0...v0.9.0) (2026-10-30)

### Features

* add a global inbox with account flags and a split inbox setting ([36f6714](https://github.com/montara-project/montara-mail-agent/commit/36f67141ecc1b8df760e6965db22ce90f8ee6acf))
* **web-ui:** flag global inbox mail with the account's email address ([2ec7262](https://github.com/montara-project/montara-mail-agent/commit/2ec7262b89af303ee1d3a4ed780cb317d78c34c2))
* **web-ui:** mark unread mail with a blue edge and polish the mail list ([78f2b9a](https://github.com/montara-project/montara-mail-agent/commit/78f2b9aadd5fe8bf024e505c21afad0f721e2d0a))
* **web-ui:** show the account as a colored chip on global inbox mail ([75328b3](https://github.com/montara-project/montara-mail-agent/commit/75328b345f5c3af0fe3cb813d0372fcf31c86714))

## [0.8.0](https://github.com/montara-project/montara-mail-agent/compare/v0.7.0...v0.8.0) (2026-10-30)

### Features

* **server:** identify as montara-mail to LLM providers ([24fe6d1](https://github.com/montara-project/montara-mail-agent/commit/24fe6d18c114e04432d9f6f2b61bcd4dfe1837cd))
* **web-ui:** collapse email sign-in behind a button and harden the page ([b40017b](https://github.com/montara-project/montara-mail-agent/commit/b40017b84f2339f02bb8c0524b7a39219964c8c8))
* **web-ui:** use HeroUI InputOTP for two-factor codes ([85d69d7](https://github.com/montara-project/montara-mail-agent/commit/85d69d7665d2ad62c9ace8351cf1a568f9d6d730))

## [0.7.0](https://github.com/montara-project/montara-mail-agent/compare/v0.6.0...v0.7.0) (2026-10-30)

### Features

* **docs:** add cookieless analytics ([501042d](https://github.com/montara-project/montara-mail-agent/commit/501042d4f9e78ba46b15cb3800b27a9ec90dc46d))
* **docs:** migrate the docs site to TanStack Start on a Cloudflare Worker ([b058787](https://github.com/montara-project/montara-mail-agent/commit/b058787f5c1ab18fd7269cefa3022d0a7201182e))
* **main-web:** add cookieless analytics ([370de50](https://github.com/montara-project/montara-mail-agent/commit/370de505a590a17ed9d5a06f373db90e6fd9df63))

### Bug Fixes

* **web-ui:** keep long sender names from widening mail list rows ([2065f5f](https://github.com/montara-project/montara-mail-agent/commit/2065f5fc9206de06859a66925245d132253e3352))

## [0.6.0](https://github.com/montara-project/montara-mail-agent/compare/v0.5.0...v0.6.0) (2026-10-29)

### Features

* **server:** block IP addresses, by hand and automatically ([478703a](https://github.com/montara-project/montara-mail-agent/commit/478703ab4a595b5d78b4628a02de2c1a78d7ce84))
* **server:** scope API keys to one organization, and let /mcp reach what the app does ([726b890](https://github.com/montara-project/montara-mail-agent/commit/726b890a4c4a97d76647a1c985bf7a946c9e894c))
* **web-ui:** pick an API key's access, one organization or all ([e0bf33e](https://github.com/montara-project/montara-mail-agent/commit/e0bf33ee2995ed8074158a657e56b2f152a1585d))
* **web-ui:** replace the sample storage meter with a subscribe banner ([c83c524](https://github.com/montara-project/montara-mail-agent/commit/c83c5247fc29409d384bbeaac24ff00b21230c2f))

### Bug Fixes

* **server:** close the findings of the 2026-10-29 security audit ([4a458f0](https://github.com/montara-project/montara-mail-agent/commit/4a458f0a89c8056e13c13652324ad6d40332335a))
* **web-ui:** finish OAuth in the app, never load images from AI answers ([97253bd](https://github.com/montara-project/montara-mail-agent/commit/97253bdf0c104c66d858a968bdf812c4be5a17e5))

## [0.5.0](https://github.com/montara-project/montara-mail-agent/compare/v0.4.0...v0.5.0) (2026-10-29)

### Features

* **docs:** add the docs site at docs.montaramail.web.id ([7b531d0](https://github.com/montara-project/montara-mail-agent/commit/7b531d081d59eb715c8510b944dbd3ab12c3c029))
* **server:** serve the mail agent's tools to MCP clients at /mcp ([87d5c5a](https://github.com/montara-project/montara-mail-agent/commit/87d5c5a4e3ddb94639d3919a7035e9950cbbf798))
* **web-ui:** manage API keys for MCP clients in the Control Center ([a96e173](https://github.com/montara-project/montara-mail-agent/commit/a96e1732beb1a6c47072acc933e8816d00c0ebd0))
* **web-ui:** show a progress toast while a bulk mail action runs ([530a306](https://github.com/montara-project/montara-mail-agent/commit/530a306a4fad1bb19a3e0bdef72a4582f80e399a))
* **web-ui:** show each account's unread count in the account switcher ([2052451](https://github.com/montara-project/montara-mail-agent/commit/205245112416264e5fe660d77af03373094b5969))

### Bug Fixes

* **server:** close the /mcp holes the security review found ([44d86f0](https://github.com/montara-project/montara-mail-agent/commit/44d86f0a5279a03bee7b9776415692ee5fbc3a8f))
* **server:** drop newsletter preheader filler from mail list teasers ([7dba173](https://github.com/montara-project/montara-mail-agent/commit/7dba173608318e6b7523ccf8d5ca9faf811c8297))

### Performance Improvements

* **web-ui:** load less JavaScript on the mail page ([ca71e03](https://github.com/montara-project/montara-mail-agent/commit/ca71e03d22abfae3d833b2b248d49c7fdea2b596))

## [0.4.0](https://github.com/montara-project/montara-mail-agent/compare/v0.3.0...v0.4.0) (2026-10-28)

### Features

* add MCP servers whose tools the assistant chat can call ([f879e68](https://github.com/montara-project/montara-mail-agent/commit/f879e6889796c38b8d93fb747f39cde1298e7db4))
* pick a timezone in My Profile and show the time in the header ([e5190db](https://github.com/montara-project/montara-mail-agent/commit/e5190db3d33916c92f3bf010620164cd9bf955b7))
* run an LLM provider in one organization or globally ([08cc438](https://github.com/montara-project/montara-mail-agent/commit/08cc438ca8d65ed78a4653d70ed500cd802fdc7a))
* select mail in the list for bulk actions, pick the page size ([a744f5b](https://github.com/montara-project/montara-mail-agent/commit/a744f5bd3f82acd1e2dac9c107d224fed1848650))
* translate email and translate reply skills ([6b26056](https://github.com/montara-project/montara-mail-agent/commit/6b26056af265a475120ac462afdcab4c6e9b2ea3))
* **web-ui:** move agent bots, skills and AI providers into Control Center ([3d2ab0a](https://github.com/montara-project/montara-mail-agent/commit/3d2ab0a8ecb04788ad4b383253996a7a9f0f95a3))
* **web-ui:** pick an AI provider's model from a searchable combobox ([112087e](https://github.com/montara-project/montara-mail-agent/commit/112087e0351fe903dd4e82f170ff7597102bed42))
* **web-ui:** show today's date beside the header clock ([c9d6498](https://github.com/montara-project/montara-mail-agent/commit/c9d649841b5851873b7f36fa1366af337ce0eebb))

### Bug Fixes

* **server:** draft replies only for important mail that is still unread ([8d8820e](https://github.com/montara-project/montara-mail-agent/commit/8d8820ead5027011e0f7f5f8a9d9ab5bbaeba047))
* **web-ui:** mail frame grows with emails that set body height 100% ([2082cdd](https://github.com/montara-project/montara-mail-agent/commit/2082cdd4d7157d3388cae5778c7c3202ef75dc99))

## [0.3.0](https://github.com/montara-project/montara-mail-agent/compare/v0.2.0...v0.3.0) (2026-10-27)

### Features

* **main-web:** per-page canonical, sitemap, robots, JSON-LD and OG image ([25c6390](https://github.com/montara-project/montara-mail-agent/commit/25c639076d75b49b453178e8d39f9a0dbdf81306))
* **server:** send noindex for app shell routes except sign-in ([91e7bc7](https://github.com/montara-project/montara-mail-agent/commit/91e7bc72def2743d91ed04123ca352ff8a03ce4c))
* **web-ui:** hide email addresses setting ([52bc470](https://github.com/montara-project/montara-mail-agent/commit/52bc470941643b3485d1e6f923773f4074bc71cb))

### Bug Fixes

* update brand logo & favicon ([6472af0](https://github.com/montara-project/montara-mail-agent/commit/6472af07fbcfc5f97bdd9265794ec1386287c688))
* **web-ui:** account page masks emails in toasts and retries failed loads ([c781488](https://github.com/montara-project/montara-mail-agent/commit/c78148886957f98b9db4eb03eb04eee7fd490559))
* **web-ui:** keep mail body skeleton above reply and forward buttons ([98bb589](https://github.com/montara-project/montara-mail-agent/commit/98bb58965a2b8bab2eb9a37ec9bdf1f0080978ee))
* **web-ui:** visible submit button and clearer switch states ([79bfc5c](https://github.com/montara-project/montara-mail-agent/commit/79bfc5c280f6a9dda50ad39968d32dd5f2f54a91))

## [0.2.0](https://github.com/montara-project/montara-mail-agent/compare/v0.1.0...v0.2.0) (2026-10-27)

### Features

* add license ([1c6e847](https://github.com/montara-project/montara-mail-agent/commit/1c6e8472320a0bbadbbf67edcd9a9c0196a1786f))
* add readme ([137bdc7](https://github.com/montara-project/montara-mail-agent/commit/137bdc70d7cbaece0b15b7c75489edd97a39f871))
* agent bots with SOUL, MEMORY, STYLE and INSTRUCTION personas ([ff3f278](https://github.com/montara-project/montara-mail-agent/commit/ff3f2789d0357eb1ce9029905365cb6ae7cd210e))
* draft replies for important mail into the agent's review queue ([35afee6](https://github.com/montara-project/montara-mail-agent/commit/35afee69d8d581bacfaf135062450a703cd51a8f))
* **server:** agent skills and a broadcast importance ([b744611](https://github.com/montara-project/montara-mail-agent/commit/b7446110b9e3dec3fc2e25a9f5d5711a3dc7a3cc))
* **server:** built-in skills adapted from humanizer and marketingskills ([6e90518](https://github.com/montara-project/montara-mail-agent/commit/6e90518d531a1ef2b35d4a4dd04ad5cba12e91d1))
* **server:** draft a whole reply to a mail from an instruction ([38b3ad7](https://github.com/montara-project/montara-mail-agent/commit/38b3ad7052a49cc4d42f9da3ca6e59fba244fe79))
* **server:** record and serve an activity log ([1e24214](https://github.com/montara-project/montara-mail-agent/commit/1e24214eabf66cefa650ed3896d7cc325bc1f40f))
* **server:** run a mail agent over one mailbox ([5bf52ce](https://github.com/montara-project/montara-mail-agent/commit/5bf52ced5f8485912c9a998aa34d176a24f0447f))
* **server:** wire mailbox OAuth for google, microsoft, yahoo and zoho ([d5f188f](https://github.com/montara-project/montara-mail-agent/commit/d5f188f365f30fa075dddec49d90ae46a9288d45))
* **web-ui:** add oauth connect option for branded mail providers ([83192e1](https://github.com/montara-project/montara-mail-agent/commit/83192e11cfded8ba83d8ab367c333e609865de89))
* **web-ui:** agent bots page and persona picker in mail ([b74dde2](https://github.com/montara-project/montara-mail-agent/commit/b74dde2b86a3e888ca414eeb78f2778e8c4e6726))
* **web-ui:** chat with the mail agent from a third mail pane ([d3444f1](https://github.com/montara-project/montara-mail-agent/commit/d3444f16951cf6baa4a1a36fed1a665e14715335))
* **web-ui:** offer google sign-in beside the email form ([89af6ec](https://github.com/montara-project/montara-mail-agent/commit/89af6ec20de8e088b2f3fe7e98a548fa699f55b3))
* **web-ui:** one Write with AI panel for the reply ([de3528e](https://github.com/montara-project/montara-mail-agent/commit/de3528ef0e20e56f78f50e5c27c8fe14fdb71161))
* **web-ui:** polish the reply draft with Humanize and Copy edit ([642a3e9](https://github.com/montara-project/montara-mail-agent/commit/642a3e9930ee354b118743bc7da74c26e21dc9a4))
* **web-ui:** prompt bar, thinking trace and streamed answers in the AI surfaces ([c957e7d](https://github.com/montara-project/montara-mail-agent/commit/c957e7dc4d2015d4edd4ea45789e1c3b49908393))
* **web-ui:** skills page, reader Skills menu and skill /commands ([503615e](https://github.com/montara-project/montara-mail-agent/commit/503615e758bed4524d78d280c8dc6c98be8fccc4))
* **web-ui:** switch for the skills' on/off ([d7a82a0](https://github.com/montara-project/montara-mail-agent/commit/d7a82a0420662421976f85e789948f04da933a8c))
* **web-ui:** toast the oauth callback outcome on the account page ([78e4d9d](https://github.com/montara-project/montara-mail-agent/commit/78e4d9db307fce952b11398e4bf6d5913b526f5b))
* **web-ui:** wire the activity log into settings ([1723d38](https://github.com/montara-project/montara-mail-agent/commit/1723d383e53688b1e80caaf210a5b77c88cfdf30))

### Bug Fixes

* **main-web:** self-host fonts, add mobile nav, gate motion, harden meta ([c896824](https://github.com/montara-project/montara-mail-agent/commit/c896824e666834742c8b7ba1fbaac64100d758ff))
* **server:** bump go 1.27.3 and amqp091-go v1.14.0 for govulncheck ([1627965](https://github.com/montara-project/montara-mail-agent/commit/16279652c95e9fe9e25589f1150dfda5d6df677c))
* **server:** encode the oauth scope's spaces as %20 in consent urls ([9a8e7bf](https://github.com/montara-project/montara-mail-agent/commit/9a8e7bfa124a8db4a3c6d4fc8688df5a2767cc3d))
* **server:** enforce a csp and hsts on api responses ([09abeb3](https://github.com/montara-project/montara-mail-agent/commit/09abeb371d472c79d36b9cbce4ddcfc839ada1b4))
* **server:** persist the drafting bot, fold agent_bots into migration 0010 ([6f8394e](https://github.com/montara-project/montara-mail-agent/commit/6f8394e8be4e19862b15a412c8c39fb29852a267))
* update action version ([bd7d627](https://github.com/montara-project/montara-mail-agent/commit/bd7d627c8d20d8c0495411ed3188d8cb75dc3859))
* update actions version ([873063b](https://github.com/montara-project/montara-mail-agent/commit/873063b608d133cbeca21b08be39624956bc0758))
* update license ([6cdc236](https://github.com/montara-project/montara-mail-agent/commit/6cdc23670fb25c610f51b0e5c66c211b6655ad26))
* **web-ui:** drop the dead cid term from the email frame csp ([72174cc](https://github.com/montara-project/montara-mail-agent/commit/72174cc6fdd348aa31d299bcb1cf79276302f6f7))
* **web-ui:** keep the refresh token cookie within the server's ttl ([7f96b7a](https://github.com/montara-project/montara-mail-agent/commit/7f96b7a8212d6ed038755c256c80d6c7db61cea4))
* **web-ui:** mail page audit fixes for phones, screen readers and color ([68ce46d](https://github.com/montara-project/montara-mail-agent/commit/68ce46d4c6388fe69efb73f558b47d0dece1b5e1))
* **web-ui:** offer the oauth sign-in only where the provider supports it ([95dd740](https://github.com/montara-project/montara-mail-agent/commit/95dd7408a771b605132529b389f8a1f3463a9bb7))
* **web-ui:** scroll the reply card down to Send when it opens ([ff0dfdf](https://github.com/montara-project/montara-mail-agent/commit/ff0dfdf8afc4287f74bf32975661a6c414a7b608))

### Performance Improvements

* **web-ui:** lazy-load images in the email reader ([f19323b](https://github.com/montara-project/montara-mail-agent/commit/f19323b0ffe4ebac40e802af8a0448d5b843f571))

## 0.1.0 (2026-10-23)

### Features

* add Lark and Zoho mail connectors ([69970bd](https://github.com/montara-project/montara-mail-agent/commit/69970bdd79b9ccc6d733f1c9492efcfa42e10968))
* build cloud and community editions ([6ae05c9](https://github.com/montara-project/montara-mail-agent/commit/6ae05c9bd21f3274d02007d606f2b980c9fc22e0))
* initial project ([4f2746d](https://github.com/montara-project/montara-mail-agent/commit/4f2746dd1d8a281777ea70f9fbb6bbe866795ac7))
* **mail:** attach files to new mails and replies ([d50e970](https://github.com/montara-project/montara-mail-agent/commit/d50e970c669efc219f576bd4b61d2da2cdb99ec9))
* **mail:** compose and send new mail ([0120828](https://github.com/montara-project/montara-mail-agent/commit/012082829ddef3d773bd6f536a2d6f00e90611fd))
* **mail:** return the kept AI summary with each mail ([ff00b76](https://github.com/montara-project/montara-mail-agent/commit/ff00b763cd893af49cc6544aec6cde5cc4bd5b30))
* **mail:** send replies from the reply composer ([95d7221](https://github.com/montara-project/montara-mail-agent/commit/95d72213b363e90c2ecc13d391c96afe712a6b07))
* **mail:** wire email actions to the mail server ([417f46f](https://github.com/montara-project/montara-mail-agent/commit/417f46feafa36c9bf4b7aef2a3d749fe9304d3be))
* **main-web:** redesign landing page around AI email management ([d41a2f6](https://github.com/montara-project/montara-mail-agent/commit/d41a2f6b5337238542380c814269358934cd1406))
* **server:** add account settings, TOTP and self-hosted LLM models ([e51de2d](https://github.com/montara-project/montara-mail-agent/commit/e51de2d2501738233700d26c642e30dcada32a5d))
* **server:** add AI mail summary endpoint ([893a774](https://github.com/montara-project/montara-mail-agent/commit/893a7748f2db2bbb6726978910f4efc97e199cf8))
* **server:** add email accounts, IMAP mail sync and per-organization AI ([408bc6e](https://github.com/montara-project/montara-mail-agent/commit/408bc6e6622f5818fc043b4aab1b36e0e01a3cb0))
* **server:** let replies choose their To and Cc ([9570052](https://github.com/montara-project/montara-mail-agent/commit/957005246145b4f31b4577c27023408a3e0ff88f))
* **server:** replace categories with organizations ([db3ac63](https://github.com/montara-project/montara-mail-agent/commit/db3ac631e50dca9f5a94b0e24d8eba8301226f47))
* **web-ui:** add a settings sidebar with account, LLM and TOTP pages ([4710679](https://github.com/montara-project/montara-mail-agent/commit/4710679cb316ff82171c6639859d63803002ceb9))
* **web-ui:** add AI header and attachment section to mail reader ([c02b4eb](https://github.com/montara-project/montara-mail-agent/commit/c02b4eb447068ea0e08702437ce8d4d5f1a8216f))
* **web-ui:** add animated theme toggler above nav user ([638711f](https://github.com/montara-project/montara-mail-agent/commit/638711f603ca5cdb9a1b696b4fd2a4f85a149283))
* **web-ui:** add collapsible reply composer with LexKit editor ([2072aab](https://github.com/montara-project/montara-mail-agent/commit/2072aabccf24cd86ba9378d4ba3c2088301a797a))
* **web-ui:** add email account cards and three-column mailbox ([3a6e690](https://github.com/montara-project/montara-mail-agent/commit/3a6e690e05ae5d8163ca33265005a592787eb424))
* **web-ui:** add mailbox view using shadcn sidebar-09 ([e4514a4](https://github.com/montara-project/montara-mail-agent/commit/e4514a4dc312eb4d0b275a16f2dc957fe69bd9d6))
* **web-ui:** add organization switcher to sidebar panels ([e7be432](https://github.com/montara-project/montara-mail-agent/commit/e7be43210df35445b2eedcfb500d40ae155c84f9))
* **web-ui:** add Platform panel to sidebar ([7413dd0](https://github.com/montara-project/montara-mail-agent/commit/7413dd0db89d38272858ab2fe62264b63ede1a85))
* **web-ui:** choose a self-hosted server URL in settings and at sign-in ([b7e1f47](https://github.com/montara-project/montara-mail-agent/commit/b7e1f47c4eb47ea44383fa05a9d6dd7f4c979360))
* **web-ui:** let the compose editor fill the sheet's height ([f4e6aff](https://github.com/montara-project/montara-mail-agent/commit/f4e6aff7afc6336e31d69ebdf93923a14081a304))
* **web-ui:** move email accounts to account page and add mail stats ([ba18f92](https://github.com/montara-project/montara-mail-agent/commit/ba18f920afffb63b78bc4edc62d51758d0e87bf3))
* **web-ui:** offer Forward beside Reply below a mail ([7ff8ccb](https://github.com/montara-project/montara-mail-agent/commit/7ff8ccb41408e90348032f8ad2589429575e8799))
* **web-ui:** open organization create and edit forms in a dialog ([14548ef](https://github.com/montara-project/montara-mail-agent/commit/14548ef6d4c29b7970e2d695449b0da8330e8245))
* **web-ui:** paginate mail list by 10 items ([6a7fa74](https://github.com/montara-project/montara-mail-agent/commit/6a7fa747445557aab90ad3e7196a6a74411769a2))
* **web-ui:** redesign mailbox list and reading pane ([14b21b5](https://github.com/montara-project/montara-mail-agent/commit/14b21b5b791373f0e04bfc71e62176e6b3664358))
* **web-ui:** redesign the reply panel behind a Reply button ([0f6f3d7](https://github.com/montara-project/montara-mail-agent/commit/0f6f3d74e7b2a1f0e5433350502cc774f68d1878))
* **web-ui:** show AI mail summary as highlighted markdown ([3d8652b](https://github.com/montara-project/montara-mail-agent/commit/3d8652b3822d8900da3ad22949519a0bc2bc7809))
* **web-ui:** show provider logos on connected accounts ([cfabb10](https://github.com/montara-project/montara-mail-agent/commit/cfabb109ed942ed18be8152a77784a8940848f20))
* **web-ui:** trim platform menu and add storage usage ([5d331cc](https://github.com/montara-project/montara-mail-agent/commit/5d331ccca010a4cfef6eee49d290accaa3600a8a))
* **web-ui:** use sidebar-09 shell across app pages ([c5b20a8](https://github.com/montara-project/montara-mail-agent/commit/c5b20a8e1a69f770b6b41d456539301ded4832d3))
* **web-ui:** wire mail, accounts, dashboard and settings to the API ([52eeec3](https://github.com/montara-project/montara-mail-agent/commit/52eeec35381289a0289a3e6ee503a9d0e1e3900a))

### Bug Fixes

* **mail:** render email HTML in a sandboxed frame ([531a3c7](https://github.com/montara-project/montara-mail-agent/commit/531a3c705ef54258231521ac3620787d8ea1ab98))
* **server:** let the TOTP step work when the web app is on another site ([c8ea434](https://github.com/montara-project/montara-mail-agent/commit/c8ea434f10fd191aca9e16336311d3b02a4b83ec))
* update cf domain ([c236a63](https://github.com/montara-project/montara-mail-agent/commit/c236a6349c0129ffaae0b8ed1b37894a59a5ef4f))
* update claude setting ([69520b8](https://github.com/montara-project/montara-mail-agent/commit/69520b8179941fa098056e4ccb2ee01cb1feea9c))
* update claude skills ([8041a8a](https://github.com/montara-project/montara-mail-agent/commit/8041a8a394145b1222e10e2a595a1985217479ad))
* update config ([5fb6877](https://github.com/montara-project/montara-mail-agent/commit/5fb687768eee4876c0bba80e471b3efa96326bf0))
* update migrations ([ea6ba9d](https://github.com/montara-project/montara-mail-agent/commit/ea6ba9dab54198d81be6985c57363bbe39db7d7c))
* update package name ([95c110d](https://github.com/montara-project/montara-mail-agent/commit/95c110d4cf26f8b5d7228f1796bccd8e25c1f185))
* update setting page ([88d74f0](https://github.com/montara-project/montara-mail-agent/commit/88d74f04d3cdc3b7ebcb2343ea0c9013a1abfa41))
* update setting pages ([163e457](https://github.com/montara-project/montara-mail-agent/commit/163e457e0e47bc700d91e569919735441bed7594))
* update version ([7c7a88a](https://github.com/montara-project/montara-mail-agent/commit/7c7a88ae18dad3a08ce9dc3d218191601b686a98))
* **web-ui:** align auth client with Authula endpoints ([16479b9](https://github.com/montara-project/montara-mail-agent/commit/16479b9fa9d1e2350e677a533fb70be527077ca8))
* **web-ui:** align organization switcher border with page header ([8e829cf](https://github.com/montara-project/montara-mail-agent/commit/8e829cf47b3ef7d73bd0cfe8db76596760da2441))
* **web-ui:** align the rich editor's placeholder with the text ([ca234d8](https://github.com/montara-project/montara-mail-agent/commit/ca234d86c7b89f9ad974cdc91ff64dc16e695d00)), references [#999](https://github.com/montara-project/montara-mail-agent/issues/999)
* **web-ui:** drop email frame scrollbar and follow the app theme ([9f066cc](https://github.com/montara-project/montara-mail-agent/commit/9f066ccced005e406deea887eea13ad65a5783a3))
* **web-ui:** show progress while mail actions run ([89f2552](https://github.com/montara-project/montara-mail-agent/commit/89f255298a5b46b43c406bf5578d6db389dab96d))
