// api/bot.ts

import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import 'dotenv/config';

// --- INITIALIZATION ---
const prisma = new PrismaClient();
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PETER_API_URL = process.env.PETER_API_URL;
const PETER_WEBSITE_URL = process.env.PETER_WEBSITE_URL;
const VERCEL_URL = process.env.VERCEL_URL;

if (!BOT_TOKEN || !PETER_API_URL || !PETER_WEBSITE_URL) {
  console.error("CRITICAL ERROR: Missing required environment variables.");
}

const bot = new Telegraf(BOT_TOKEN!);

// --- HELPER FUNCTION to format the API response ---
function formatReportForTelegram(report: any): string {
    const peterScore = report.peter_score || 0;
    const executiveSummary = report.executive_summary || "No summary available.";
    const domainName = report.domain_name || "N/A";
    
    // Safely access nested scores, providing a default of 0
    const scores = report.scores || {};
    const onChainHealth = scores.on_chain_health || 0;
    const onChainLiquidity = scores.on_chain_liquidity || 0;
    const marketTrend = scores.market_trend || 0;
    const brandability = scores.brandability || 0;
    
    return `
*Peter Intelligence Report for ${domainName}* 🐒

*Peter Score™: ${peterScore.toFixed(1)}/100*

*Executive Summary:*
${executiveSummary}

*Key Scores:*
- On-Chain Health: *${onChainHealth}/10*
- Liquidity: *${onChainLiquidity}/10*
- Market Trend: *${marketTrend}/10*
- Brandability: *${brandability}/10*
    `;
}

// --- BOT COMMANDS ---

// Handles /start command and deeplinks from the website
bot.start(async (ctx) => {
  const deepLinkPayload = ctx.startPayload;
  const telegramId = String(ctx.from.id); // The user's unique numeric Telegram ID

  if (deepLinkPayload && deepLinkPayload.startsWith('watch_')) {
    try {
      const parts = deepLinkPayload.split('_');
      const domain = parts.slice(1, -1).join('.');
      const username = parts[parts.length - 1];
      
      console.log(`[Bot] Received watch subscription from user ${username} (${telegramId}) for domain ${domain}`);

      // Save the subscription to the Vercel Postgres database
      await prisma.subscription.create({
        data: { telegramId, domain },
      });

      await ctx.reply(
        `✅ **Subscription Confirmed!**\n\nYou will now receive real-time alerts for **${domain}**.`,
        { parse_mode: 'Markdown' }
      );
    } catch (e: any) {
      if (e.code === 'P2002') { // Prisma's unique constraint violation code
        await ctx.reply(`You are already subscribed to alerts for this domain.`);
      } else {
        console.error("Error saving subscription:", e);
        await ctx.reply("There was an error processing your subscription link. Please try again.");
      }
    }
  } else {
    ctx.reply(
      "Welcome to DomainApe! 🦍\n\nI'm your personal domain intelligence agent.\n\nUse `/report example.com` to get an instant, AI-powered analysis of any domain."
    );
  }
});

// Handles /report command for on-demand analysis
bot.command('report', async (ctx) => {
  const domain = ctx.message.text.split(' ')[1];
  console.log(`[Bot] Received /report for ${domain} from ${ctx.from.username}`);

  if (!domain) {
    return ctx.reply("Please provide a domain. Usage: `/report example.com`");
  }

  await ctx.replyWithChatAction('typing'); // Show "typing..." indicator

  try {
    const response = await axios.get(`${PETER_API_URL}?domain=${domain}`);
    const report = response.data;
    const formattedMessage = formatReportForTelegram(report);

    await ctx.reply(formattedMessage, { 
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            Markup.button.url('View Full Interactive Report', `${PETER_WEBSITE_URL}/dashboard?domain=${domain}`)
        ])
    });

  } catch (error) {
    console.error(`[Bot] Error fetching Peter API for ${domain}:`, error);
    await ctx.reply(`Sorry, I couldn't complete the analysis for *${domain}*. The Peter intelligence service may be unavailable.`, { parse_mode: 'Markdown' });
  }
});

bot.help((ctx) => ctx.reply('Use `/report domain.com` to get a full intelligence report.'));

// --- VERCEL SERVERLESS HANDLER ---
const handler = async (req: any, res: any) => {
  try {
    if (VERCEL_URL) {
      const webhookUrl = `https://${VERCEL_URL}/api/bot`;
      const hasWebhook = (await bot.telegram.getWebhookInfo()).url === webhookUrl;
      if (!hasWebhook) {
        await bot.telegram.setWebhook(webhookUrl);
        console.log(`Webhook successfully set to ${webhookUrl}`);
      }
    }
    await bot.handleUpdate(req.body);
  } catch (error) {
    console.error('[Handler] Error:', error);
  }
  res.status(200).send('OK');
};

export default handler;