// api/cron.ts

import { Telegraf } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import 'dotenv/config';

const prisma = new PrismaClient();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
const DOMA_POLL_API = "https://api-testnet.doma.xyz/v1/poll";

// A simple in-memory cache for the last processed event ID.
// In a production app with multiple serverless instances, this should be stored in a shared database like Redis or even your Postgres DB.
let lastProcessedEventId = 0; 

export default async function handler(request: any, response: any) {
    console.log('[Cron Job] Starting scheduled task to check for alerts...');
    
    try {
        const pollParams: any = { limit: 100 }; // Check 100 events per minute
        // This logic is a simple way to avoid re-processing old events.
        if (lastProcessedEventId > 0) {
            // A more robust solution would filter events by timestamp, but we'll work with the API we have.
        }

        const pollResponse = await axios.get(DOMA_POLL_API, {
            headers: { 'Api-Key': process.env.DOMA_API_KEY },
            params: pollParams
        });

        const events: any[] = pollResponse.data?.events || [];
        
        if (events.length > 0) {
            const newEvents = events.filter(event => event.id > lastProcessedEventId);
            console.log(`[Cron Job] Fetched ${events.length} events, ${newEvents.length} are new.`);
            
            if (newEvents.length > 0) {
                // Update the last processed ID to the newest event in this batch
                lastProcessedEventId = Math.max(...newEvents.map(e => e.id));

                for (const event of newEvents) {
                    // --- Feature: "Just Listed" & "Significant Sale" Alerts ---
                    if (event.type === 'TOKEN_LISTED' || event.type === 'NAME_TOKEN_PURCHASED') {
                        const domain = event.name;
                        
                        // Find all users subscribed to alerts for this specific domain
                        const subscribers = await prisma.subscription.findMany({
                            where: { domain: domain },
                        });

                        if (subscribers.length > 0) {
                            const price = event.eventData?.payment?.price / 10**6; // Assuming 6 decimal places for USDC
                            const currency = event.eventData?.payment?.currencySymbol || 'USDC';
                            const eventTypeLabel = event.type === 'TOKEN_LISTED' ? "🔥 Just Listed" : "📈 Significant Sale";
                            
                            const message = `${eventTypeLabel} Alert!\n\n**Domain:** \`${domain}\`\n**Price:** ${price ? `${price.toLocaleString()} ${currency}` : 'N/A'}`;

                            // Send a notification to each subscriber
                            for (const sub of subscribers) {
                                await bot.telegram.sendMessage(sub.telegramId, message, { parse_mode: 'Markdown' });
                            }
                            console.log(`[Cron Job] Sent ${subscribers.length} alert(s) for ${domain}.`);
                        }
                    }
                }
            }
        } else {
            console.log('[Cron Job] No new Doma events found in this poll.');
        }

    } catch (error) {
        console.error('[Cron Job] An error occurred:', error);
    }
    
    console.log('[Cron Job] Scheduled task finished.');
    response.status(200).json({ status: 'Cron job executed successfully.' });
}