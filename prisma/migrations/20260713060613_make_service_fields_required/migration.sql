/*
  Warnings:

  - Made the column `description_ar` on table `services` required. This step will fail if there are existing NULL values in that column.
  - Made the column `description_en` on table `services` required. This step will fail if there are existing NULL values in that column.
  - Made the column `image_url` on table `services` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."services" ALTER COLUMN "description_ar" SET NOT NULL,
ALTER COLUMN "description_en" SET NOT NULL,
ALTER COLUMN "image_url" SET NOT NULL;
