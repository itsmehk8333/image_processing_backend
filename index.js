import { configDotenv } from "dotenv";
configDotenv();
import cors from "cors";

import express from "express";
import users from "./controllers/users.controller.js";
import image_processing from "./controllers/images.controller.js"
import { setupBullBoard } from "./src/config/bullBoard.js";

const app = express();
app.use(express.json());
app.use(cors()) 
setupBullBoard(app);  
app.use("/users", users);    
app.use("/image-processing",image_processing )

app.listen(5000, () =>{
    console.log("app started at 5000");
})