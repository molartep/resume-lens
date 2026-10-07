import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['tests/**/*.test.{ts,tsx}'],fileParallelism:false,maxWorkers:1,restoreMocks:true}});
