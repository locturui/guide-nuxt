<script setup lang="ts">
definePageMeta({
  middleware: "auth",
  name: "bookings",
});
</script>

<template>
  <BookingTable />
</template>
