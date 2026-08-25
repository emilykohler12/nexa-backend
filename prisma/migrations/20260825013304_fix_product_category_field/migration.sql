/*
  Warnings:

  - You are about to drop the column `category_id` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- AlterTable
ALTER TABLE "products" DROP COLUMN "category_id",
DROP COLUMN "description",
ADD COLUMN     "category" VARCHAR(50) NOT NULL DEFAULT '';
