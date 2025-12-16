/**
 * API route to link an email thread to a claim
 * POST /api/inbox/[id]/link-claim
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { claimId } = await request.json();
    const { id: threadId } = await params;

    if (!claimId) {
      return NextResponse.json(
        { error: "claimId is required" },
        { status: 400 }
      );
    }

    // Verify claim exists
    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
    });

    if (!claim) {
      return NextResponse.json(
        { error: "Claim not found" },
        { status: 404 }
      );
    }

    // Get thread with all messages and attachments
    const thread = await prisma.emailThread.findUnique({
      where: { id: threadId },
      include: {
        messages: {
          include: {
            attachments: true,
          },
        },
      },
    });

    if (!thread) {
      return NextResponse.json(
        { error: "Thread not found" },
        { status: 404 }
      );
    }

    // Update thread to link to claim
    const updatedThread = await prisma.emailThread.update({
      where: { id: threadId },
      data: { claimId },
    });

    // Process all attachments from the thread
    const allAttachments = thread.messages.flatMap((msg) => msg.attachments || []);
    
    console.log(`[link-claim] Processing ${allAttachments.length} attachments for claim ${claimId}`);
    
    let photosCreated = 0;
    let documentsCreated = 0;
    let attachmentsSkipped = 0;

    for (const attachment of allAttachments) {
      // Skip if already linked to a different claim
      if (attachment.claimId && attachment.claimId !== claimId) {
        console.log(`[link-claim] Skipping attachment ${attachment.id} - already linked to different claim`);
        attachmentsSkipped++;
        continue;
      }

      // Check if photo or document already exists for this attachment
      const existingPhoto = await prisma.photo.findFirst({
        where: { attachmentId: attachment.id },
      });
      const existingDoc = await prisma.clientDocument.findFirst({
        where: { attachmentId: attachment.id },
      });

      // Skip if already has a document/photo
      if (existingPhoto || existingDoc) {
        console.log(`[link-claim] Skipping attachment ${attachment.id} - already has photo/document`);
        attachmentsSkipped++;
        continue;
      }

      // Link attachment to claim if not already linked
      if (!attachment.claimId) {
        await prisma.attachment.update({
          where: { id: attachment.id },
          data: { claimId },
        });
        console.log(`[link-claim] Linked attachment ${attachment.id} to claim ${claimId}`);
      }

      const isImage = attachment.mimeType.startsWith("image/");
      const isPdf = attachment.mimeType === "application/pdf";
      const isDocx = attachment.mimeType.includes("wordprocessingml") || 
                     attachment.mimeType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml") ||
                     attachment.fileName.toLowerCase().endsWith(".docx");

      console.log(`[link-claim] Attachment ${attachment.id}: isImage=${isImage}, isPdf=${isPdf}, isDocx=${isDocx}, isProbablyLogo=${attachment.isProbablyLogo}, isRelevant=${attachment.isRelevant}`);

      // Create Photo for images (skip logos, but include all other images)
      if (isImage) {
        if (attachment.isProbablyLogo) {
          console.log(`[link-claim] Skipping logo image ${attachment.id}`);
          attachmentsSkipped++;
        } else {
          await prisma.photo.create({
            data: {
              claimId,
              attachmentId: attachment.id,
              internalUpload: false,
            },
          });
          photosCreated++;
          console.log(`[link-claim] Created photo for attachment ${attachment.id}`);
        }
      }

      // Create ClientDocument for PDFs and DOCX files
      if (isPdf || isDocx) {
        await prisma.clientDocument.create({
          data: {
            claimId,
            attachmentId: attachment.id,
            textOriginal: attachment.textOriginal || "",
            originalLanguage: "SR", // Default, can be detected later
          },
        });
        documentsCreated++;
        console.log(`[link-claim] Created document for attachment ${attachment.id}`);
      }
    }

    console.log(`[link-claim] Summary: ${photosCreated} photos, ${documentsCreated} documents, ${attachmentsSkipped} skipped`);

    return NextResponse.json({
      success: true,
      thread: updatedThread,
      photosCreated,
      documentsCreated,
      message: `Linked thread to claim. Created ${photosCreated} photo(s) and ${documentsCreated} document(s).`,
    });
  } catch (error) {
    console.error("Error linking claim to thread:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to link claim" },
      { status: 500 }
    );
  }
}

