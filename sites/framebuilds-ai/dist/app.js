'use strict';
(() => {
  const store = window.FRAMEBUILDS_STORE;
  const allSkills = window.FRAMEBUILDS_SKILLS || [];
  const publicSkillIds = new Set(store.publicSkillIds);
  const skills = allSkills.filter(skill => publicSkillIds.has(skill.id));
  const packages = new Map(store.packages.map(pack => [pack.id, { ...pack, skillSet: new Set(pack.resolvedSkillIds) }]));
  const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  const grid = document.querySelector('#catalog-grid');
  const more = document.querySelector('#catalog-more');
  const search = document.querySelector('#skill-search');
  const status = document.querySelector('#catalog-status');
  const packageSelect = document.querySelector('#catalog-package');
  const clearCatalog = document.querySelector('#clear-catalog');
  const labels = { conteudo: 'Conteúdo', video: 'Vídeo', design: 'Design & sites', produtividade: 'Produtividade' };
  const symbols = { conteudo: '✳', video: '▷', design: '⌘', produtividade: '▤' };
  let activeCategory = 'all';
  let expanded = false;
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  document.querySelectorAll('[data-skill-count]').forEach(node => { node.textContent = skills.length; });
  document.querySelector('#year').textContent = new Date().getFullYear();

  function renderCatalog() {
    const query = normalize(search.value.trim());
    const selectedPackage = packages.get(packageSelect.value);
    const matching = skills.filter(skill => (!selectedPackage || selectedPackage.skillSet.has(skill.id)) && (activeCategory === 'all' || skill.category === activeCategory) && normalize(`${skill.name} ${skill.description} ${skill.id}`).includes(query));
    const visible = expanded || query ? matching : matching.slice(0, 9);
    const fragment = document.createDocumentFragment();
    visible.forEach(skill => {
      const article = document.createElement('article');
      article.className = 'skill-card';
      const top = document.createElement('div');
      top.className = 'skill-card-top';
      const icon = document.createElement('span');
      icon.className = 'skill-symbol';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = symbols[skill.category];
      const category = document.createElement('span');
      category.className = 'skill-category';
      category.textContent = labels[skill.category];
      top.append(icon, category);
      const title = document.createElement('h3');
      title.textContent = skill.name;
      const description = document.createElement('p');
      description.textContent = skill.description;
      article.append(top, title, description);
      const owner = store.packages.find(pack => !pack.includes && pack.resolvedSkillIds.includes(skill.id));
      if (owner) {
        const badge = document.createElement('span');
        badge.className = 'skill-package';
        badge.textContent = owner.name;
        article.append(badge);
      }
      fragment.append(article);
    });
    grid.replaceChildren(fragment);
    more.hidden = !!query || matching.length <= 9;
    more.firstChild.textContent = expanded ? 'Mostrar menos skills ' : `Explorar ${matching.length === skills.length ? 'todas as' : 'as'} ${matching.length} skills `;
    more.lastElementChild.textContent = expanded ? '↑' : '↓';
    const scope = selectedPackage ? ` no pacote ${selectedPackage.name}` : ' na coleção';
    const categoryScope = activeCategory === 'all' ? '' : ` · ${labels[activeCategory]}`;
    status.textContent = matching.length ? `${visible.length} de ${matching.length} skills${scope}${categoryScope}.` : 'Nenhuma skill encontrada nesta seleção. Tente outra busca ou limpe os filtros.';
    clearCatalog.hidden = activeCategory === 'all' && !query && packageSelect.value === 'all';
  }
  function resetCategory() {
    activeCategory = 'all';
    document.querySelectorAll('[data-filter]').forEach(button => {
      const active = button.dataset.filter === 'all';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  document.querySelectorAll('[data-filter]').forEach(button => {
    button.addEventListener('click', () => {
      activeCategory = button.dataset.filter;
      expanded = false;
      document.querySelectorAll('[data-filter]').forEach(filter => {
        const active = filter === button;
        filter.classList.toggle('active', active);
        filter.setAttribute('aria-pressed', String(active));
      });
      renderCatalog();
    });
  });
  search.addEventListener('input', () => { expanded = false; renderCatalog(); });
  packageSelect.addEventListener('change', () => { expanded = false; resetCategory(); renderCatalog(); });
  clearCatalog.addEventListener('click', () => {
    packageSelect.value = 'all';
    search.value = '';
    expanded = false;
    resetCategory();
    renderCatalog();
    packageSelect.focus({ preventScroll: true });
  });
  more.addEventListener('click', () => {
    expanded = !expanded;
    renderCatalog();
    if (!expanded) document.querySelector('#biblioteca').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
  renderCatalog();

  const menuToggle = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('#mobile-nav');
  function closeMenu() {
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Abrir menu');
    mobileNav.hidden = true;
  }
  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Abrir menu' : 'Fechar menu');
    mobileNav.hidden = isOpen;
  });
  mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  matchMedia('(min-width: 761px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

  const packageDialog = document.querySelector('#package-dialog');
  const privacyDialog = document.querySelector('#privacy-dialog');
  let detailPackageId = 'completo';
  const openPurchase = window.FRAMEBUILDS_CHECKOUT.openPurchase;
  document.querySelectorAll('[data-purchase]').forEach(button => button.addEventListener('click', () => openPurchase(button.dataset.purchase)));
  document.querySelectorAll('[data-package-details]').forEach(button => button.addEventListener('click', () => {
    const pack = packages.get(button.dataset.packageDetails);
    if (!pack) return;
    detailPackageId = pack.id;
    document.querySelector('#package-dialog-label').textContent = pack.label;
    document.querySelector('#package-dialog-title').textContent = pack.name;
    document.querySelector('#package-dialog-description').textContent = pack.audience;
    document.querySelector('#package-dialog-price').textContent = `${money(pack.priceCents)} · pagamento único`;
    document.querySelector('#package-dialog-count').textContent = `${pack.skillCount} skills e rotinas`;
    document.querySelector('#package-dialog-requirements').textContent = pack.requirements;
    document.querySelector('#package-dialog-prompt').textContent = pack.examplePrompt;
    const list = document.querySelector('#package-dialog-skills');
    const fragment = document.createDocumentFragment();
    skills.filter(skill => pack.skillSet.has(skill.id)).forEach(skill => {
      const item = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = skill.name;
      const code = document.createElement('code');
      code.textContent = skill.id;
      item.append(name, code);
      fragment.append(item);
    });
    list.replaceChildren(fragment);
    document.querySelector('.package-skill-list').open = false;
    packageDialog.scrollTop = 0;
    packageDialog.showModal();
  }));
  document.querySelector('#package-dialog-buy').addEventListener('click', () => openPurchase(detailPackageId));
  document.querySelector('#package-dialog-browse').addEventListener('click', () => {
    packageDialog.close();
    packageSelect.value = detailPackageId;
    search.value = '';
    expanded = false;
    resetCategory();
    renderCatalog();
    document.querySelector('#biblioteca').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    packageSelect.focus({ preventScroll: true });
  });
  document.querySelector('[data-privacy]').addEventListener('click', () => privacyDialog.showModal());
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelectorAll('.modal-close, [data-close-dialog]').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('click', event => {
      const box = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
    });
  });

  const prompts = [
    ['Crie um Reel sobre a minha próxima grande ideia.', 'Exemplo de uso: roteiro, direção de cenas e edição com as skills de vídeo.'],
    ['Crie uma página para apresentar a minha nova marca.', 'Exemplo de uso: briefing, estrutura e implementação com as skills de sites.'],
    ['Pesquise referências e monte meu plano de conteúdo.', 'Exemplo de uso: pesquisa e planejamento com as skills de conteúdo.']
  ];
  let promptIndex = 0;
  document.querySelector('.preview-reel').classList.add('is-selected');
  document.querySelector('#demo-next').addEventListener('click', () => {
    promptIndex = (promptIndex + 1) % prompts.length;
    document.querySelector('#demo-prompt').textContent = prompts[promptIndex][0];
    document.querySelector('#demo-caption').textContent = prompts[promptIndex][1];
    document.querySelector('.studio-topline .mono').textContent = `0${promptIndex + 1} / 03`;
    document.querySelectorAll('.preview').forEach((card, index) => card.classList.toggle('is-selected', index === promptIndex));
  });
  const mobileBuy = document.querySelector('#mobile-buy');
  const hero = document.querySelector('.hero');
  const offer = document.querySelector('.packages-section');
  let pastHero = false;
  let offerVisible = false;
  const updateMobileBuy = () => mobileBuy.classList.toggle('visible', pastHero && !offerVisible);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      pastHero = !entries[0].isIntersecting && entries[0].boundingClientRect.bottom < 0;
      updateMobileBuy();
    }).observe(hero);
    new IntersectionObserver(entries => { offerVisible = entries[0].isIntersecting; updateMobileBuy(); }).observe(offer);
  }
})();
