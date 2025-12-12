<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
    <div class="container mx-auto px-4 py-16">
      <div class="text-center">
        <h1 class="text-5xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to Trade.io
        </h1>
        <p class="text-xl text-gray-600 dark:text-gray-300 mb-8">
          Production-grade paper trading platform for learning and competition
        </p>
        
        <div v-if="healthData" class="inline-block bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <div class="flex items-center gap-2 text-sm">
            <div class="flex items-center gap-1">
              <div class="w-2 h-2 rounded-full bg-green-500"></div>
              <span class="text-gray-700 dark:text-gray-300">API Status: {{ healthData.status }}</span>
            </div>
          </div>
        </div>
        
        <div class="flex gap-4 justify-center">
          <button
            class="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Get Started
          </button>
          <button
            class="px-6 py-3 bg-white text-indigo-600 rounded-lg hover:bg-gray-50 transition border border-indigo-600"
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
