import s3 from "../config/s3.js";
import prisma from "../db/db.js";
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';


export async function uploadImageSaveInDb(data) {
    try {
        const { filename, originalUrl,s3Key ,size, format, userId } = data;
        const saveImage = await prisma.image.create({
            data: {
                filename, originalUrl, size, format, userId , s3Key
            }
        })
        return saveImage;
    } catch (error) {
        console.log(error, "error")
    }
}


export async function getImages(s3Key) {
    try {
         
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: s3Key,
        });
          const response = await s3.send(command);
           const chunks = [];
           for await (const chunk of response.Body) {
                chunks.push(chunk);
          }
        return Buffer.concat(chunks);
    } catch (error) {
        console.log(error)
    }
}


export async function uploadImageAfterAIProcessing(buffer, filename){
    console.log(buffer , filename)

     const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: filename,
    Body: buffer,
    ContentType: "image/png",
  });

  await s3.send(command);

  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
 
}