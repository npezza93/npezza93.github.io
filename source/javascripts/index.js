import { MDCTabScroller } from 'https://cdn.skypack.dev/@material/tab-scroller';

window.addEventListener('load', function() {
  new MDCTabScroller(document.querySelector('.mdc-tab-scroller'))
})

document.querySelectorAll('.slide').forEach((slide) => {
  slide.addEventListener('click', () => {
    if (document.querySelector('.content.active')) {
      return
    }

    const project = slide.dataset.for
    const content = document.querySelector(`[data-project=${project}`)

    let bounds = slide.getBoundingClientRect()
    content.style.position = "fixed"
    content.style.top = bounds.top.toString() + "px"
    content.style.left = bounds.left.toString() + "px"
    content.classList.remove("invisible")
    content.classList.add('active')
    content.querySelector(".img").classList.remove("invisible")
    document.querySelector('body').style['overflow-y'] = 'hidden'

    const openUI = content.animate({ left: 0, top: 0 }, { duration: 400, iterations: 1, })
    openUI.onfinish = function() {
      content.style.top = "0px"
      content.style.left = "0px"
      content.classList.remove('open-transition')
      content.classList.add('close-transition')
      content.style.overflowY = 'scroll'
    };
  });
});

document.querySelectorAll('.close-project-desc').forEach((close) => {
  close.addEventListener('click', () => {
    let content = close.parentElement
    const project = content.dataset.project
    const slide = document.querySelector(`[data-for=${project}`)

    let logoContainer = slide.querySelector(".img")
    let bounds = logoContainer.getBoundingClientRect()

    content.style.height = bounds.height.toString() + "px"
    content.style.width = bounds.width.toString() + "px"
    content.style.overflowY = 'hidden'
    content.classList.add('fade-out')

    const openUI = content.animate({
      left: bounds.left.toString() + "px",
      top: bounds.top.toString() + "px"
    }, { duration: 400, iterations: 1, })
    openUI.onfinish = function() {
      content.style.left = bounds.left.toString() + "px"
      content.style.top = bounds.top.toString() + "px"
      content.classList.remove('active')
      content.removeAttribute('style');
      document.querySelector('body').style['overflow-y'] = 'scroll'
      content.classList.remove('fade-out')
      content.classList.add('open-transition')
      content.classList.remove('close-transition')
      content.classList.add('invisible')
    };
  });
});

function toggleHamburger() {
  document.querySelector('#backdrop').classList.toggle('active')
  document.querySelector('#hamburger-menu').classList.toggle('active')
};

document.querySelector('#hamburger').addEventListener('click', toggleHamburger)
document.querySelector('#hamburger-menu svg').addEventListener('click', toggleHamburger)
document.querySelector('#hamburger-menu a').addEventListener('click', toggleHamburger)

document.querySelector('textarea').addEventListener('input', function() {
  this.parentNode.dataset.replicatedValue = this.value
});
