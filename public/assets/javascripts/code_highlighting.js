function highlightCodeBlocks() {
  if (!window.hljs) return

  document.querySelectorAll('pre code').forEach((block) => {
    if (block.dataset.highlighted) return

    block.classList.replace('language-eruby', 'language-erb')
    block.classList.replace('language-shell', 'language-bash')

    window.hljs.highlightElement(block)
  })
}

document.addEventListener('DOMContentLoaded', highlightCodeBlocks)
document.addEventListener('turbo:load', highlightCodeBlocks)
