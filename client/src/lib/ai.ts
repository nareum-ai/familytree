import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { app } from './firebase';

const aiInst = getAI(app, { backend: new GoogleAIBackend() });
export const geminiFlash = getGenerativeModel(aiInst, { model: 'gemini-2.0-flash' });
