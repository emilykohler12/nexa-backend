-- AlterTable
ALTER TABLE "promotions" DROP COLUMN "product_id",
ADD COLUMN     "buy_qty" INTEGER,
ADD COLUMN     "items" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "kind" VARCHAR(20) NOT NULL DEFAULT 'discount',
ADD COLUMN     "pay_qty" INTEGER;
