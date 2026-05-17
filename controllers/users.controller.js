import express from "express";
import prisma from "../db/db.js";

const router = express.Router();


router.post("/create_user", async(req , res) =>{
    try {
        const { username, password } = req.body;
        const user = await prisma.user.create({
            data: {
                username, password
            }
        })
        res.status(201).json({
            message: "User created successfully",
            user
        })
    } catch (error) {
        res.status(500).json({
      message: "Something went wrong",
      error: error.message
    })
    }
})


export default router
