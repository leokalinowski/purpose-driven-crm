

## Install GTM, Google Analytics & Microsoft Clarity

All three tracking scripts will be added to `index.html`.

### Changes to `index.html`

1. **In `<head>`** (after the existing meta tags, before `</head>`):
   - GTM head snippet (container `GTM-WNCHZB45`)
   - GA4 gtag.js snippet (measurement ID `G-0XTL0R6Q98`)
   - Microsoft Clarity snippet (project `vx9tje0e7c`)

2. **In `<body>`** (immediately after `<body>` tag):
   - GTM noscript fallback iframe

No other files need changes. Since GA4 is also configured via GTM typically, having both the standalone gtag.js snippet and GTM gives you flexibility — you can later remove the standalone GA snippet if you manage it entirely through GTM.

