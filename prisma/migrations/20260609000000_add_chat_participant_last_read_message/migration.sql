-- Add a per-participant read marker for unread count and future read state features.
ALTER TABLE "ChatParticipant" ADD COLUMN "lastReadMessageId" TEXT;

CREATE INDEX "ChatParticipant_lastReadMessageId_idx" ON "ChatParticipant"("lastReadMessageId");

ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_lastReadMessageId_fkey" FOREIGN KEY ("lastReadMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
