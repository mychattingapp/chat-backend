-- Add pairKey as nullable first so existing rows can be backfilled.
ALTER TABLE "FriendRequest" ADD COLUMN "pairKey" TEXT;

UPDATE "FriendRequest"
SET "pairKey" = LEAST("requesterId", "recipientId") || ':' || GREATEST("requesterId", "recipientId");

ALTER TABLE "FriendRequest" ALTER COLUMN "pairKey" SET NOT NULL;

CREATE UNIQUE INDEX "FriendRequest_pairKey_key" ON "FriendRequest"("pairKey");
