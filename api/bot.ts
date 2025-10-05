// api/bot.ts

import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';
import 'dotenv/config';

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PETER_API_URL = process.env.PETER_API_URL;
const PETER_WEBSITE_URL = process.env.PETER_WEBSITE_URL;
const VERCEL_URL = process.env.VERCEL_URL; // Provided by Vercel deployment environment

if (!BOT_TOKEN || !PETER_API_URL || !PETER_WEBSITE_URL) {
  console.error("CRITICAL ERROR: Missing required environment variables (BOT_TOKEN, PETER_API_URL, PETER_WEBSITE_URL).");
  // In a real server, you'd want to stop the process, but for serverless we'll let it fail on request.
}

// --- INITIALIZE BOT ---
const bot = new Telegraf(BOT_TOKEN!);

// --- HELPER FUNCTION ---
// A helper to format the detailed Peter API report into a concise Telegram message.
function formatReportForTelegram(report: any): string {
    return `
*Peter Intelligence Report for ${report.domain_name}* 🐒

*Peter Score™: ${report.peter_score.toFixed(1)}/100*

*Executive Summary:*
${report.executive_summary}

*Key Scores:*
- On-Chain Health: *${report.scores.on_chain_health}/10*
- Liquidity Score: *${report.scores.on_chain_liquidity}/10*
- Market Trend: *${report.scores.market_trend}/10*
- Brandability: *${report.scores.brandability}/10*
    `;
}

// --- BOT COMMANDS AND FEATURES ---

// Feature 1: Handle the /start command (including deeplinks from your website)
bot.start((ctx) => {
  const deepLinkPayload = ctx.startPayload;

  // This handles the link from your website's "Smart Alerts" component
  if (deepLinkPayload && deepLinkPayload.startsWith('watch_')) {
    try {
      const parts = deepLinkPayload.split('_');
      // Format: watch_crypto_ai_username -> watch, crypto, ai, username
      const domain = parts.slice(1, -1).join('.'); // Re-joins domain parts
      const username = parts[parts.length - 1];
      
      console.log(`[Bot] Received watch subscription from user ${username} for domain ${domain}`);

      ctx.reply(
        `✅ Welcome, @${username}!\n\nYou've successfully subscribed to real-time alerts for **${domain}**. I'll notify you of any important on-chain events.`,
        { parse_mode: 'Markdown' }
      );
      // In a production app, you would save this user-to-domain mapping in a database.
      // E.g., db.subscriptions.create({ userId: ctx.from.id, telegramHandle: username, domainToWatch: domain })
    } catch (error) {
      console.error("Error parsing deep link payload:", error);
      ctx.reply("There was an error processing your subscription link. Please try again from the website.");
    }
  } else {
    // Standard welcome message if the user just starts the bot directly.
    ctx.reply(
      "Welcome to DomainApe! 🦍\n\nI am your personal domain intelligence agent, powered by the Peter API.\n\nTo get an instant, AI-powered analysis of any domain, use the `/report` command.\n\n*For example:*\n`/report crypto.ai`"
    );
  }
});


// Feature 2: Handle the /report command for on-demand analysis
bot.command('report', async (ctx) => {
  const domain = ctx.message.text.split(' ')[1];

  if (!domain) {
    return ctx.reply("Please provide a domain to analyze. Usage: `/report example.com`");
  }

  // Acknowledge the request immediately to provide good UX
  await ctx.reply(`🦍 Analyzing **${domain}**... This can take up to a minute while the agents conduct live research.`, { parse_mode: 'Markdown' });

  try {
    const response = await axios.get(`${PETER_API_URL}?domain=${domain}`);
    const report = response.data;

    const formattedMessage = formatReportForTelegram(report);

    // Send the formatted report with an inline button to the full dashboard
    await ctx.reply(formattedMessage, { 
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            Markup.button.url('View Full Interactive Report', `${PETER_WEBSITE_URL}/dashboard?domain=${domain}`)
        ])
    });

  } catch (error) {
    console.error("Error fetching from Peter API:", error);
    await ctx.reply(`Sorry, I couldn't complete the analysis for *${domain}*. The Peter intelligence service may be experiencing high load or an error.`, { parse_mode: 'Markdown' });
  }
});

// Add a simple /help command
bot.help((ctx) => ctx.reply('Use the `/report domain.com` command to get a full intelligence report on any domain.'));


// --- VERCEL SERVERLESS FUNCTION SETUP ---

// This handler will be used by Vercel to process all incoming updates via a webhook.
const handler = async (req: any, res: any) => {
  try {
    // We need to set the webhook once, on the first request after a deployment.
    if (VERCEL_URL) {
      const webhookUrl = `https://${VERCEL_URL}/api/bot`;
      const currentWebhook = await bot.telegram.getWebhookInfo();

      if (currentWebhook.url !== webhookUrl) {
        await bot.telegram.setWebhook(webhookUrl);
        console.log(`Webhook successfully set to ${webhookUrl}`);
      }
    }

    // Process the incoming Telegram update from the request body.
    await bot.handleUpdate(req.body);
  } catch (error) {
    console.error('Error in bot handler:', error);
  }
  
  // Respond to Telegram immediately to acknowledge receipt of the update.
  res.status(200).send('OK');
};

export default handler;