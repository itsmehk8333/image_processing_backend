import { Worker } from "bullmq";
import { connection, retryImageQueue } from '../queues/imageQueue.js';
import prisma from "../../db/db.js";
import { InferenceClient } from "@huggingface/inference";
import { uploadImageAfterAIProcessing } from "../../services/images.service.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const client = new InferenceClient(process.env.HF_TOKEN);
console.log(process.env.HF_TOKEN)

async function processImage(job) {
  const { jobId, imageUrl, processingType, params, prompt } = job.data;

  await prisma.delayedJob.update({
    where: { id: jobId },
    data: { status: 'PROCESSING' }
  });

  //  await sleep(60000);


  const generatedImage = await client.textToImage({
    model: "black-forest-labs/FLUX.1-schnell",
    inputs: prompt,
    parameters: {
      prompt: prompt
    },
    parameters: {
      num_inference_steps: 5
    }
  });

  const arrayBuffer = await generatedImage.arrayBuffer();

  const buffer = Buffer.from(arrayBuffer);;

  const generateImageS3Url = await uploadImageAfterAIProcessing(buffer, `generated-${Date.now()}.png`)

  return generateImageS3Url

}


const worker = new Worker("image-processing", async (job) => {

  const result = await processImage(job);
  const {jobId} = job.data

  await prisma.delayedJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      result: result
    }
  });

}, { connection, concurrency: 5 });

worker.on('failed', async (job, err) => {

  const retryCount = job.retryCount;

  if (retryCount > 1) {
    await prisma.delayedJob.update({
      where: { id: job.data.jobId },
      data: { status: 'FAILED', error: err.message, result: null }
    });
    return null;
  }

  await prisma.delayedJob.update({
    where: { id: job.data.jobId },
    data: {
      retryCount: {
        increment: 1
      }
    }
  });

  await retryImageQueue.add("retry-image-worker", job);

});


const retryWorker = new Worker("retry-image-worker", async (job) => {
  console.log(84)
  const retryResult = await processImage(job);
  await prisma.delayedJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      result: retryResult
    }
  });
}, { connection, concurrency: 5 })

retryWorker.on("failed" , () =>{
  console.log(95 , "-------------------")
})