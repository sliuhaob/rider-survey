import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'./',plugins:[react()],build:{target:['chrome64','safari12']},server:{proxy:{'/api':'http://127.0.0.1:8787'}}});

