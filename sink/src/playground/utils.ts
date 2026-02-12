export const blockForMs = (ms: number) => {
  const start = globalThis.performance.now()
  while (globalThis.performance.now() - start < ms) {
    // block
  }
}
