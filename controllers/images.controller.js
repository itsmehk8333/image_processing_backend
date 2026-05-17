import express from "express";
import upload from "../middleware/upload.js";
import { getImages, uploadImageSaveInDb } from "../services/images.service.js";
import prisma from "../db/db.js";
import sharp from "sharp";

const router = express.Router();

router.post("/upload_image", upload.single("file"), async (req, res) => {
  try {
    const saveImage = await uploadImageSaveInDb({
      filename: req.file.originalname,
      s3Key: req.file.key,  
      originalUrl: req.file.location,
      size: req.file.size,
      format: req.file.mimetype,
      userId: 1
    });
    res.json({ data: saveImage });
  } catch (error) {
    res.status(500).json({
      message: "Something went wrong",
      error: error.message
    })
  }
})


router.get("/process-image/:id", async (req, res) => {
  try {
    const { id} = req.params;
    const {  w, h, quality, blur, sharpen, format, grayscale, flip } = req.query;
    const image = await prisma.image.findUnique({
      where: { id: Number(id) }
    })
    if(image == null){
      res.status(404).json({
        message : "Image not found!"
      })
    }
    const Buffer = await getImages(image.s3Key);
    const processedImage = await sharp(Buffer).resize(
      req.query.w ? Number(req.query.w) : null,
      req.query.h ? Number(req.query.h) : null,

    )
    if (grayscale === 'true') {
      processedImage.grayscale();
    }

    if (flip === 'true') {
      processedImage.flip();       
    }

    if (blur && Number(blur) >= 0.3) {
      processedImage.blur(Number(blur));
    }

    if (sharpen === 'true') {
      processedImage.sharpen();    
    }

    const outputFormat = format || 'jpeg';

    if (outputFormat === 'jpeg' || outputFormat === 'jpg') {
      processedImage.jpeg({ quality: quality ? Number(quality) : 80 });
    } else if (outputFormat === 'png') {
      processedImage.png({ quality: quality ? Number(quality) : 80 });
    } else if (outputFormat === 'webp') {
      processedImage.webp({ quality: quality ? Number(quality) : 80 });
    } else if (outputFormat === 'avif') {
      processedImage.avif({ quality: quality ? Number(quality) : 80 });
    }
    const FullprocessedImage = await processedImage.toBuffer();

    res.set('Content-Type', 'image/jpeg');
    res.send(FullprocessedImage);
  } catch (error) {
    console.log(error)
    res.status(500).json({
      message : error.message
    })
  }
})

export default router; 