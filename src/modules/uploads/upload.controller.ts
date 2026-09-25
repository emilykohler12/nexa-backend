// src/modules/uploads/upload.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { uploadProvider } from './upload.provider'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP } from '../../app/constants/http'

const folderSchema = z.string().regex(/^[a-z0-9-]+$/, 'Carpeta inválida').optional()

export const uploadController = {
  uploadImage: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = req.file
      if (!file) {
        throw new AppError(HTTP.BAD_REQUEST, 'Falta el archivo de imagen', 'MISSING_FILE')
      }
      const parsedFolder = folderSchema.safeParse(req.body?.folder)
      const folder = parsedFolder.success ? parsedFolder.data : undefined

      const url = await uploadProvider.uploadImage(file.buffer, file.mimetype, folder)
      res.status(HTTP.CREATED).json({ url })
    } catch (err) { next(err) }
  },
}
