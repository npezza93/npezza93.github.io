function toggleHamburger() {
  document.querySelector('#backdrop').classList.toggle('active')
  document.querySelector('#hamburger-menu').classList.toggle('active')
};

document.addEventListener('turbo:load', () => {
  if (document.querySelector('#hamburger')) {
    document.querySelector('#hamburger').addEventListener('click', toggleHamburger)
    document.querySelector('#hamburger-menu svg').addEventListener('click', toggleHamburger)
    document.querySelector('#hamburger-menu a').addEventListener('click', toggleHamburger)

    document.querySelector('textarea').addEventListener('input', function() {
      this.parentNode.dataset.replicatedValue = this.value
    });
  }
})
