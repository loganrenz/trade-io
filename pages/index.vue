<template>
  <div
    class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800"
  >
    <div class="container mx-auto px-4 py-16">
      <div class="text-center">
        <h1 class="mb-4 text-5xl font-bold text-gray-900 dark:text-white">Welcome to Trade.io</h1>
        <p class="mb-8 text-xl text-gray-600 dark:text-gray-300">
          Production-grade paper trading platform for learning and competition
        </p>

        <div
          v-if="healthData"
          class="mb-8 inline-block rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800"
        >
          <div class="flex items-center gap-2 text-sm">
            <div class="flex items-center gap-1">
              <div class="h-2 w-2 rounded-full bg-green-500"></div>
              <span class="text-gray-700 dark:text-gray-300"
                >API Status: {{ healthData.status }}</span
              >
            </div>
          </div>
        </div>

        <div class="flex justify-center gap-4">
          <button
            class="rounded-lg bg-indigo-600 px-6 py-3 text-white transition hover:bg-indigo-700"
          >
            Get Started
          </button>
          <button
            class="rounded-lg border border-indigo-600 bg-white px-6 py-3 text-indigo-600 transition hover:bg-gray-50"
          >
            Learn More
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Example tRPC call - will work once dependencies are installed
const { data: healthData } = await useFetch('/api/trpc/health.check', {
  method: 'GET',
});
</script>
