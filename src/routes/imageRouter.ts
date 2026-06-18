import { Router } from "express"
import { authenticateToken } from "../middleware/authMiddleware.js"
import { authed } from "../middleware/authed.js"
import { handleGetPresignedUrl, handleSetProfileImageUrl } from "../controllers/imageController.js"

export const imageRouter = Router()

imageRouter.post('/upload-url',authenticateToken, authed(handleGetPresignedUrl))
imageRouter.patch('/avatar', authenticateToken, authed(handleSetProfileImageUrl));