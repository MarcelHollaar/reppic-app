-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
