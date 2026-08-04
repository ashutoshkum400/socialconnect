import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';

export const mediaRouter = Router();

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

mediaRouter.post('/upload-url', [body('fileName').notEmpty(), body('contentType').notEmpty()], (req, res) => {
  const { fileName, contentType } = req.body;
  const key = `${req.user.id}/${uuidv4()}-${fileName}`;
  res.json({ uploadUrl: `https://example.s3.amazonaws.com/${key}`, key, contentType });
});

mediaRouter.post('/image', [body('fileName').notEmpty()], handleValidation, (req, res) => {
  res.json({ message: 'Image upload accepted', key: `${req.user.id}/${uuidv4()}-${req.body.fileName}` });
});

mediaRouter.post('/video', [body('fileName').notEmpty()], handleValidation, (req, res) => {
  res.json({ message: 'Video upload accepted', key: `${req.user.id}/${uuidv4()}-${req.body.fileName}` });
});
