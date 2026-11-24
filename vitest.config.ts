import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['tests/**/*.test.{ts,tsx,js}','src/**/*.test.{ts,tsx,js}']}});
