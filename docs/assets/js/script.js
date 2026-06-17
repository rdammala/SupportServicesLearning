// ===== SIDEBAR TOGGLE =====
document.addEventListener('DOMContentLoaded', function() {
  const navToggle = document.querySelector('.nav-toggle');
  const sidebar = document.querySelector('.sidebar');
  const sidebarClose = document.querySelector('.sidebar-close');

  if (navToggle) {
    navToggle.addEventListener('click', function() {
      sidebar.classList.toggle('open');
    });
  }

  if (sidebarClose) {
    sidebarClose.addEventListener('click', function() {
      sidebar.classList.remove('open');
    });
  }

  // Close sidebar when clicking a link
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  sidebarLinks.forEach(link => {
    link.addEventListener('click', function() {
      sidebar.classList.remove('open');
    });
  });

  // ===== ACTIVE NAV LINK =====
  const currentPath = window.location.pathname;
  sidebarLinks.forEach(link => {
    if (link.getAttribute('href') === currentPath || 
        link.getAttribute('href').includes(currentPath.split('/').pop())) {
      link.classList.add('active');
    }
  });

  // ===== SCROLL BUTTONS =====
  const scrollUpBtn = document.getElementById('scroll-up');
  const scrollDownBtn = document.getElementById('scroll-down');

  window.addEventListener('scroll', function() {
    const scrollPos = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;

    // Show/hide scroll-up button
    if (scrollPos > 300) {
      scrollUpBtn.classList.add('show');
    } else {
      scrollUpBtn.classList.remove('show');
    }

    // Show/hide scroll-down button
    if (scrollPos < docHeight - 300) {
      scrollDownBtn.classList.add('show');
    } else {
      scrollDownBtn.classList.remove('show');
    }
  });

  // Scroll button click handlers
  if (scrollUpBtn) {
    scrollUpBtn.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (scrollDownBtn) {
    scrollDownBtn.addEventListener('click', function() {
      window.scrollTo({ 
        top: document.documentElement.scrollHeight, 
        behavior: 'smooth' 
      });
    });
  }

  // ===== TABLE OF CONTENTS LINKS =====
  const tocLinks = document.querySelectorAll('.toc a');
  tocLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ===== SMOOTH FADE IN =====
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe all cards and sections
  document.querySelectorAll('.card, .lab-box, h2, h3').forEach(el => {
    observer.observe(el);
  });

  // ===== TAB FUNCTIONALITY =====
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      const tabContents = document.querySelectorAll('.tab-content');
      const buttons = document.querySelectorAll('.tab-button');

      // Hide all tabs
      tabContents.forEach(content => {
        content.classList.remove('active');
      });

      // Remove active from all buttons
      buttons.forEach(btn => {
        btn.classList.remove('active');
      });

      // Show selected tab
      const selectedTab = document.getElementById(tabName);
      if (selectedTab) {
        selectedTab.classList.add('active');
      }

      // Add active to clicked button
      this.classList.add('active');
    });
  });

  // ===== CODE COPY BUTTON =====
  const codeBlocks = document.querySelectorAll('pre code');
  codeBlocks.forEach(block => {
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy';
    copyBtn.className = 'copy-btn';
    copyBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 5px 10px;
      background: rgba(0, 212, 255, 0.2);
      border: 1px solid rgba(0, 212, 255, 0.5);
      color: #00d4ff;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.3s ease;
    `;

    copyBtn.addEventListener('mouseover', function() {
      this.style.background = 'rgba(0, 212, 255, 0.4)';
    });

    copyBtn.addEventListener('mouseout', function() {
      this.style.background = 'rgba(0, 212, 255, 0.2)';
    });

    copyBtn.addEventListener('click', function() {
      const text = block.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      });
    });

    const preBlock = block.parentElement;
    preBlock.style.position = 'relative';
    preBlock.appendChild(copyBtn);
  });

  // ===== EXTERNAL LINKS =====
  document.querySelectorAll('a[target="_blank"]').forEach(link => {
    if (!link.textContent.includes('↗')) {
      link.textContent += ' ↗';
    }
  });
});

// ===== MERMAID CONFIGURATION =====
if (typeof mermaid !== 'undefined') {
  mermaid.initialize({ 
    startOnLoad: true, 
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: 'segoe ui, sans-serif'
  });
}
