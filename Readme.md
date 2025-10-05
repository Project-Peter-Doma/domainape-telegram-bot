# 🦍 DomainApe Telegram Bot

**DomainApe** is the official companion bot for the **Peter** domain intelligence platform. It provides real-time alerts and on-demand analysis for on-chain domains within the Doma Protocol ecosystem.

**Live Bot:** [@domainape_bot on Telegram](https://t.me/domainape_bot)

---

### ✨ Core Functionality

- **On-Demand Reports:** Users can request a full Peter intelligence report for any domain directly in Telegram using the `/report <domain>` command.
- **Subscription Service:** Integrates with the Peter website, allowing users to subscribe to alerts for specific domains.
- **Proactive Alerts (via Cron Job):**
    - **Just Listed & Sold Alerts:** Continuously monitors the Doma Poll API and notifies subscribed users when a tracked domain is listed or sold.
    - **Momentum Spike Alerts:** Proactively informs users about significant surges in market activity for relevant TLDs.

### 🛠️ Tech Stack

- **Framework:** [Node.js](https://nodejs.org/) with [TypeScript](https://www.typescriptlang.org/)
- **Telegram Bot Library:** [Telegraf](https://telegraf.js.org/)
- **Server:** [Express.js](https://expressjs.com/)
- **Database:** [Vercel Postgres](https://vercel.com/storage/postgres) with [Prisma](https://www.prisma.io/)
- **Deployment:** [Vercel Serverless Functions & Cron Jobs](https://vercel.com/)

### 🔗 Architecture

This bot is deployed as two serverless functions on Vercel:

1.  **Webhook Handler (`/api/bot`):** A stateless function that listens for incoming messages from Telegram (e.g., `/start`, `/report`) and responds accordingly.
2.  **Cron Job Worker (`/api/cron`):** A scheduled function that runs every minute to poll the Doma API for new events and push proactive alerts to subscribed users stored in the Postgres database.

This architecture ensures the bot is highly scalable, resilient, and cost-effective.
