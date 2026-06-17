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

// ===== THEME TOGGLE (Dark/Light) =====
function initThemeToggle() {
  const themeToggle = document.querySelector('.theme-toggle');
  if (!themeToggle) return;

  // Get saved theme or default to dark
  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme);

  themeToggle.addEventListener('click', function() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

// ===== BOOKMARKS FEATURE =====
function initBookmarks() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const bookmarkBtn = document.querySelector('[data-bookmark]');
  
  if (!bookmarkBtn) return;

  // Load bookmarks from localStorage
  let bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
  
  // Update button state
  const isBookmarked = bookmarks.some(b => b.path === currentPage);
  updateBookmarkButton(bookmarkBtn, isBookmarked);

  bookmarkBtn.addEventListener('click', function() {
    const pageTitle = document.querySelector('h1')?.textContent || 'Bookmarked Page';
    const pagePath = currentPage;
    
    const bookmarkIndex = bookmarks.findIndex(b => b.path === pagePath);
    if (bookmarkIndex !== -1) {
      bookmarks.splice(bookmarkIndex, 1);
      updateBookmarkButton(bookmarkBtn, false);
    } else {
      bookmarks.push({ title: pageTitle, path: pagePath, date: new Date().toISOString() });
      updateBookmarkButton(bookmarkBtn, true);
    }
    
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
  });
}

function updateBookmarkButton(btn, isBookmarked) {
  btn.textContent = isBookmarked ? '⭐ Bookmarked' : '☆ Bookmark';
  btn.style.color = isBookmarked ? 'var(--primary)' : 'inherit';
}

// ===== SEARCH FUNCTIONALITY =====
function initSearch() {
  const searchInput = document.querySelector('.search-input');
  const searchResults = document.querySelector('.search-results');
  
  if (!searchInput || !searchResults) return;

  // Build searchable index from all pages
  const searchIndex = [
    { title: 'Home', path: '/', type: 'page' },
    { title: 'SRE Perspective', path: '/roles/sre-perspective.html', type: 'role' },
    { title: 'DevOps Engineer', path: '/roles/devops-engineer.html', type: 'role' },
    { title: 'Data Engineer', path: '/roles/data-engineer.html', type: 'role' },
    { title: 'Technical Support', path: '/roles/technical-support.html', type: 'role' },
    { title: 'TPM Perspective', path: '/roles/tpm-perspective.html', type: 'role' },
    { title: 'Platform Engineer', path: '/roles/platform-engineer.html', type: 'role' },
    { title: 'C# / .NET 10', path: '/technologies/csharp-dotnet.html', type: 'tech' },
    { title: 'React / TypeScript', path: '/technologies/react-typescript.html', type: 'tech' },
    { title: 'API Integrations', path: '/technologies/api-integrations.html', type: 'tech' },
    { title: 'Agentic AI', path: '/technologies/agentic-ai.html', type: 'tech' },
    { title: 'Bicep / ARM', path: '/technologies/bicep-arm.html', type: 'tech' },
    { title: 'YAML / Pipelines', path: '/technologies/yaml-pipelines.html', type: 'tech' },
    { title: 'Git / GitHub Actions', path: '/technologies/git-github-actions.html', type: 'tech' },
    { title: 'Observability', path: '/technologies/observability.html', type: 'tech' },
    { title: 'AKS / Containers', path: '/technologies/aks-containers.html', type: 'tech' },
    { title: 'Labs & Capstones', path: '/labs/labs-index.html', type: 'labs' },
    { title: 'Glossary', path: '/resources/glossary.html', type: 'resource' },
    { title: 'Code Snippets', path: '/resources/code-snippets.html', type: 'resource' }
  ];

  // Keyboard shortcut: / to focus search
  document.addEventListener('keydown', function(e) {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
    // Escape to unfocus
    if (e.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.blur();
    }
  });

  searchInput.addEventListener('input', function(e) {
    const query = e.target.value.toLowerCase().trim();
    
    if (!query) {
      searchResults.innerHTML = '';
      return;
    }

    const results = searchIndex.filter(item =>
      item.title.toLowerCase().includes(query) ||
      item.type.toLowerCase().includes(query)
    );

    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-no-results">No results found. Try another search term.</div>';
      return;
    }

    searchResults.innerHTML = results.map(result => `
      <div class="search-result-item" onclick="window.location.href='${result.path}'">
        <div class="search-result-title">${result.title}</div>
        <div class="search-result-path">
          <span style="background: rgba(0,212,255,0.2); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; text-transform: uppercase;">${result.type}</span>
        </div>
        <div class="search-result-preview">Jump to this guide →</div>
      </div>
    `).join('');
  });

  // Allow Enter key to go to first result
  searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      const firstResult = searchResults.querySelector('.search-result-item');
      if (firstResult) {
        firstResult.click();
      }
    }
  });
}

// ===== SIDEBAR NAVIGATION =====
function initSidebar() {
  const navToggle = document.querySelector('.nav-toggle');
  const sidebar = document.querySelector('.sidebar');
  const sidebarClose = document.querySelector('.sidebar-close');
  const sidebarLinks = document.querySelectorAll('.sidebar-link');

  if (!navToggle || !sidebar) return;

  navToggle.addEventListener('click', function() {
    sidebar.classList.toggle('open');
  });

  if (sidebarClose) {
    sidebarClose.addEventListener('click', function() {
      sidebar.classList.remove('open');
    });
  }

  // Close sidebar on link click (mobile)
  sidebarLinks.forEach(link => {
    link.addEventListener('click', function() {
      if (window.innerWidth <= 1024) {
        sidebar.classList.remove('open');
      }
    });
  });

  // Highlight active link
  sidebarLinks.forEach(link => {
    if (link.href === window.location.href || link.href.includes(window.location.pathname)) {
      link.classList.add('active');
    }
  });
}

// ===== SCROLL FUNCTIONALITY =====
function initScrollControls() {
  const scrollUp = document.querySelector('#scroll-up');
  const scrollDown = document.querySelector('#scroll-down');

  if (!scrollUp || !scrollDown) return;

  window.addEventListener('scroll', function() {
    const scrollPos = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;

    // Show/hide scroll-up button
    scrollUp.style.display = scrollPos > 300 ? 'flex' : 'none';
    
    // Show/hide scroll-down button (hide near bottom)
    scrollDown.style.display = scrollPos < docHeight - 300 ? 'flex' : 'none';
  });

  scrollUp.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  scrollDown.addEventListener('click', function() {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  });
}

// ===== TABLE OF CONTENTS SMOOTH SCROLL =====
function initTableOfContents() {
  const tocLinks = document.querySelectorAll('.toc a');
  
  tocLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href').substring(1);
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ===== COPY CODE BUTTONS =====
function initCopyButtons() {
  const codeBlocks = document.querySelectorAll('pre code');
  
  codeBlocks.forEach(code => {
    const pre = code.parentElement;
    const button = document.createElement('button');
    button.textContent = '📋 Copy';
    button.style.cssText = `
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.75rem;
      opacity: 0;
      transition: opacity 0.3s;
    `;
    
    pre.style.position = 'relative';
    pre.appendChild(button);
    
    pre.addEventListener('mouseenter', () => button.style.opacity = '1');
    pre.addEventListener('mouseleave', () => button.style.opacity = '0');
    
    button.addEventListener('click', async function() {
      const text = code.textContent;
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = '✓ Copied!';
        setTimeout(() => button.textContent = '📋 Copy', 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });
  });
}

// ===== INTERSECTION OBSERVER FOR FADE-IN =====
function initFadeInAnimation() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  const elements = document.querySelectorAll('.card, .lab-box, section');
  elements.forEach(el => observer.observe(el));
}

// Initialize everything when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    initThemeToggle();
    initSearch();
    initBookmarks();
    initSidebar();
    initScrollControls();
    initTableOfContents();
    initCopyButtons();
    initFadeInAnimation();
  });
} else {
  initThemeToggle();
  initSearch();
  initBookmarks();
  initSidebar();
  initScrollControls();
  initTableOfContents();
  initCopyButtons();
  initFadeInAnimation();
}
