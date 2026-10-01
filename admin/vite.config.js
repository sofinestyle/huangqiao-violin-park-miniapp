import { defineConfig } from 'vite';
export default defineConfig({base:'/admin/',server:{host:'127.0.0.1',port:5173,strictPort:true,proxy:{'/api':'http://127.0.0.1:8787','/assets':'http://127.0.0.1:8787'}},build:{outDir:'dist',emptyOutDir:true}});
