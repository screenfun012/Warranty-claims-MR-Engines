/**
 * Script za migraciju postojećih email thread-ova
 * 
 * Šta radi:
 * 1. Pronalazi sve thread-ove koji imaju RE:/FW: u subject-u
 * 2. Čisti subject-e i merge-uje thread-ove sa istim cleaned subject-om
 * 3. Uklanja quoted text iz postojećih poruka
 * 4. Deduplikuje poruke na osnovu Message-ID
 * 
 * Upotreba:
 * npm run migrate-threads
 * ili
 * npx tsx scripts/migrate-email-threads.ts
 */

import { getPrisma } from "../lib/db/prisma";
import { 
  cleanSubject, 
  extractCleanBody,
  deduplicateMessages
} from "../lib/email/emailThreadingUtils";

interface MigrationStats {
  threadsProcessed: number;
  threadsMerged: number;
  messagesDeduped: number;
  messagesCleaned: number;
  errors: number;
}

async function migrateEmailThreads(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    threadsProcessed: 0,
    threadsMerged: 0,
    messagesDeduped: 0,
    messagesCleaned: 0,
    errors: 0,
  };

  console.log("🔧 Starting email threads migration...\n");

  const prisma = await getPrisma();

  try {
    // 1. Get all threads
    const allThreads = await prisma.emailThread.findMany({
      include: {
        messages: {
          orderBy: { date: 'asc' }
        }
      }
    });

    console.log(`📧 Found ${allThreads.length} total threads\n`);

    // 2. Group threads by cleaned subject
    const threadsByCleanSubject = new Map<string, typeof allThreads>();

    for (const thread of allThreads) {
      const cleaned = cleanSubject(thread.subjectOriginal);
      
      if (!threadsByCleanSubject.has(cleaned)) {
        threadsByCleanSubject.set(cleaned, []);
      }
      
      threadsByCleanSubject.get(cleaned)!.push(thread);
      stats.threadsProcessed++;
    }

    console.log(`🔍 Found ${threadsByCleanSubject.size} unique conversations\n`);

    // 3. Merge threads with same cleaned subject
    for (const [cleanedSubject, threads] of threadsByCleanSubject) {
      if (threads.length <= 1) continue; // Samo jedan thread, nema šta da merge-ujemo

      console.log(`\n📝 Processing: "${cleanedSubject}"`);
      console.log(`   Found ${threads.length} threads to merge:`);
      
      threads.forEach((t, i) => {
        console.log(`   ${i + 1}. ${t.subjectOriginal} (${t.messages.length} messages)`);
      });

      try {
        // Odaberi "glavni" thread (najstariji ili onaj sa najviše poruka)
        const mainThread = threads.reduce((prev, curr) => {
          const prevDate = new Date(prev.createdAt).getTime();
          const currDate = new Date(curr.createdAt).getTime();
          return currDate < prevDate ? curr : prev;
        });

        console.log(`   ✓ Main thread: ${mainThread.id}`);

        // Sakupi sve poruke iz svih thread-ova
        const allMessages = threads.flatMap(t => t.messages);
        
        // Deduplikuj poruke
        const uniqueMessages = deduplicateMessages(
          allMessages.map(m => ({
            ...m,
            messageId: m.messageId || undefined
          }))
        );

        const dedupedCount = allMessages.length - uniqueMessages.length;
        if (dedupedCount > 0) {
          console.log(`   ✓ Removed ${dedupedCount} duplicate messages`);
          stats.messagesDeduped += dedupedCount;
        }

        // Prebaci sve poruke u glavni thread
        for (const message of uniqueMessages) {
          if (message.emailThreadId !== mainThread.id) {
            await prisma.emailMessage.update({
              where: { id: message.id },
              data: { emailThreadId: mainThread.id }
            });
          }

          // Očisti quoted text
          if (message.bodyText) {
            const cleaned = extractCleanBody(message.bodyText, message.bodyHtml || undefined);
            
            if (cleaned !== message.bodyText) {
              await prisma.emailMessage.update({
                where: { id: message.id },
                data: { bodyText: cleaned }
              });
              stats.messagesCleaned++;
            }
          }
        }

        // Update main thread subject
        if (mainThread.subjectOriginal !== cleanedSubject) {
          await prisma.emailThread.update({
            where: { id: mainThread.id },
            data: { subjectOriginal: cleanedSubject }
          });
        }

        // Obriši ostale thread-ove
        const threadsToDelete = threads.filter(t => t.id !== mainThread.id);
        for (const thread of threadsToDelete) {
          await prisma.emailThread.delete({
            where: { id: thread.id }
          });
          stats.threadsMerged++;
          console.log(`   ✓ Deleted thread: ${thread.id}`);
        }

        console.log(`   ✅ Merged into thread: ${mainThread.id}`);

      } catch (error) {
        stats.errors++;
        console.error(`   ❌ Error merging threads for "${cleanedSubject}":`, error);
      }
    }

    // 4. Clean bodyText for all remaining messages (ako nisu već čišćene)
    console.log("\n🧹 Cleaning quoted text from all messages...");
    
    const allMessages = await prisma.emailMessage.findMany({
      where: {
        bodyText: {
          not: null
        }
      }
    });

    let cleanedInThisPass = 0;
    for (const message of allMessages) {
      if (!message.bodyText) continue;

      const cleaned = extractCleanBody(message.bodyText, message.bodyHtml || undefined);
      
      // Only update if there's actual change
      if (cleaned !== message.bodyText && cleaned.length < message.bodyText.length) {
        await prisma.emailMessage.update({
          where: { id: message.id },
          data: { bodyText: cleaned }
        });
        cleanedInThisPass++;
      }
    }

    if (cleanedInThisPass > 0) {
      console.log(`✓ Cleaned ${cleanedInThisPass} additional messages`);
      stats.messagesCleaned += cleanedInThisPass;
    }

  } catch (error) {
    console.error("❌ Migration failed:", error);
    stats.errors++;
    throw error;
  }

  return stats;
}

// DRY RUN MODE - proveri šta će se desiti bez izmena
async function dryRunMigration() {
  console.log("🔍 DRY RUN MODE - Checking what would be migrated...\n");

  const prisma = await getPrisma();

  const allThreads = await prisma.emailThread.findMany({
    include: {
      messages: true
    }
  });

  const threadsByCleanSubject = new Map<string, typeof allThreads>();

  for (const thread of allThreads) {
    const cleaned = cleanSubject(thread.subjectOriginal);
    
    if (!threadsByCleanSubject.has(cleaned)) {
      threadsByCleanSubject.set(cleaned, []);
    }
    
    threadsByCleanSubject.get(cleaned)!.push(thread);
  }

  let wouldMerge = 0;
  let wouldDedupe = 0;

  for (const [cleanedSubject, threads] of threadsByCleanSubject) {
    if (threads.length > 1) {
      console.log(`Would merge ${threads.length} threads for: "${cleanedSubject}"`);
      threads.forEach(t => {
        console.log(`  - ${t.subjectOriginal} (${t.messages.length} msgs)`);
      });
      wouldMerge += threads.length - 1;

      // Check for duplicates
      const allMessages = threads.flatMap(t => t.messages);
      const uniqueMessages = deduplicateMessages(
        allMessages.map(m => ({ ...m, messageId: m.messageId || undefined }))
      );
      const dedupCount = allMessages.length - uniqueMessages.length;
      if (dedupCount > 0) {
        console.log(`  ⚠️  Would remove ${dedupCount} duplicate messages`);
        wouldDedupe += dedupCount;
      }
      console.log();
    }
  }

  console.log("\n📊 DRY RUN SUMMARY:");
  console.log(`Total threads: ${allThreads.length}`);
  console.log(`Unique conversations: ${threadsByCleanSubject.size}`);
  console.log(`Threads that would be merged: ${wouldMerge}`);
  console.log(`Duplicate messages that would be removed: ${wouldDedupe}`);
  console.log("\nRun with --execute flag to perform migration");
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--execute');

  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║     Email Threads Migration Script                    ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  if (isDryRun) {
    await dryRunMigration();
  } else {
    console.log("⚠️  EXECUTING MIGRATION - This will modify your database!\n");
    
    const stats = await migrateEmailThreads();

    console.log("\n");
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║     Migration Complete                                 ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log("\n📊 FINAL STATS:");
    console.log(`   Threads processed: ${stats.threadsProcessed}`);
    console.log(`   Threads merged: ${stats.threadsMerged}`);
    console.log(`   Messages deduped: ${stats.messagesDeduped}`);
    console.log(`   Messages cleaned: ${stats.messagesCleaned}`);
    console.log(`   Errors: ${stats.errors}`);
    
    if (stats.errors === 0) {
      console.log("\n✅ Migration completed successfully!");
    } else {
      console.log(`\n⚠️  Migration completed with ${stats.errors} errors`);
    }
  }
}

// Run it!
main()
  .catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    const { getPrisma } = await import("../lib/db/prisma");
    const prisma = await getPrisma();
    await prisma.$disconnect();
  });
