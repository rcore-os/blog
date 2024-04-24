/* global NexT, CONFIG */

NexT.boot = {};

NexT.boot.registerEvents = function() {

  NexT.utils.registerScrollPercent();
  NexT.utils.registerCanIUseTag();

  // Mobile top menu bar.
  document.querySelector('.site-nav-toggle .toggle').addEventListener('click', event => {
    event.currentTarget.classList.toggle('toggle-close');
    const siteNav = document.querySelector('.site-nav');
    if (!siteNav) return;
    const animateAction = siteNav.classList.contains('site-nav-on');
    const height = NexT.utils.getComputedStyle(siteNav);
    siteNav.style.height = animateAction ? height : 0;
    const toggle = () => siteNav.classList.toggle('site-nav-on');
    const begin = () => {
      siteNav.style.overflow = 'hidden';
    };
    const complete = () => {
      siteNav.style.overflow = '';
      siteNav.style.height = '';
    };
    window.anime(Object.assign({
      targets : siteNav,
      duration: 200,
      height  : animateAction ? [height, 0] : [0, height],
      easing  : 'linear'
    }, animateAction ? {
      begin,
      complete: () => {
        complete();
        toggle();
      }
    } : {
      begin: () => {
        begin();
        toggle();
      },
      complete
    }));
  });

  const duration = 200;
  document.querySelectorAll('.sidebar-nav li').forEach((element, index) => {
    element.addEventListener('click', event => {
      const item = event.currentTarget;
      if (item.matches('.sidebar-toc-active .sidebar-nav-toc, .sidebar-overview-active .sidebar-nav-overview')) return;
      const sidebar = document.querySelector('.sidebar-inner');
      const panel = document.querySelectorAll('.sidebar-panel');
      const activeClassName = ['sidebar-toc-active', 'sidebar-overview-active'];

      window.anime({
        duration,
        targets   : panel[1 - index],
        easing    : 'linear',
        opacity   : 0,
        translateY: [0, -20],
        complete  : () => {
          // Prevent adding TOC to Overview if Overview was selected when close & open sidebar.
          sidebar.classList.remove(activeClassName[1 - index]);
          sidebar.classList.add(activeClassName[index]);
          window.anime({
            duration,
            targets   : panel[index],
            easing    : 'linear',
            opacity   : [0, 1],
            translateY: [-20, 0]
          });
        }
      });
    });
  });

  window.addEventListener('resize', NexT.utils.initSidebarDimension);

  window.addEventListener('hashchange', () => {
    const tHash = location.hash;
    if (tHash !== '' && !tHash.match(/%\S{2}/)) {
      const target = document.querySelector(`.tabs ul.nav-tabs li a[href="${tHash}"]`);
      target && target.click();
    }
  });
};

NexT.boot.refresh = function() {

  /**
   * Register JS handlers by condition option.
   * Need to add config option in Front-End at 'scripts/helpers/next-config.js' file.
   */
  CONFIG.prism && window.Prism.highlightAll();
  CONFIG.fancybox && NexT.utils.wrapImageWithFancyBox();
  CONFIG.mediumzoom && window.mediumZoom('.post-body :not(a) > img, .post-body > img', {
    background: 'var(--content-bg-color)'
  });
  CONFIG.lazyload && window.lozad('.post-body img').observe();
  CONFIG.pangu && window.pangu.spacingPage();

  CONFIG.exturl && NexT.utils.registerExtURL();
  NexT.utils.registerCopyCode();
  NexT.utils.registerTabsTag();
  NexT.utils.registerActiveMenuItem();
  NexT.utils.registerLangSelect();
  NexT.utils.registerSidebarTOC();
  NexT.utils.wrapTableWithBox();
  NexT.utils.registerVideoIframe();
};

NexT.boot.motion = function() {
  // Define Motion Sequence & Bootstrap Motion.
  if (CONFIG.motion.enable) {
    NexT.motion.integrator
      .add(NexT.motion.middleWares.header)
      .add(NexT.motion.middleWares.postList)
      .add(NexT.motion.middleWares.sidebar)
      .add(NexT.motion.middleWares.footer)
      .bootstrap();
  }
  NexT.utils.updateSidebarPosition();
};

document.addEventListener('DOMContentLoaded', () => {
  NexT.boot.registerEvents();
  NexT.boot.refresh();
  NexT.boot.motion();
});
