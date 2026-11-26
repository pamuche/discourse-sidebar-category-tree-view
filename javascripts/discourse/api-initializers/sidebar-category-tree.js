import { apiInitializer } from "discourse/lib/api";

const STORAGE_KEY = "sidebar-category-tree-expanded";
const SECTION = '.sidebar-section[data-section-name="categories"]';

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore (private mode etc.)
  }
}

// Sidebar category links look like /c/<slug>/<sub-slug>/<id>
function categoryIdFromLink(link) {
  const match = link.getAttribute("href")?.match(/\/c\/(?:[^?#]+\/)?(\d+)\/?(?:[?#].*)?$/);
  return match ? parseInt(match[1], 10) : null;
}

export default apiInitializer((api) => {
  const site = api.container.lookup("service:site");
  const expandedDefault = settings.expanded_by_default;
  const indent = settings.indent_per_level;
  const state = loadState();

  const isExpanded = (id) => (id in state ? state[id] : expandedDefault);

  let observer;
  let applying = false;

  function apply() {
    const section = document.querySelector(SECTION);
    if (!section) {
      return;
    }
    const list = section.querySelector(".sidebar-section-content");
    if (!list) {
      return;
    }

    applying = true;
    try {
      const items = new Map(); // id -> { li, category }
      list.querySelectorAll(":scope > li").forEach((li) => {
        const link = li.querySelector("a.sidebar-section-link");
        const id = link && categoryIdFromLink(link);
        const category = id && site.categoriesById?.get?.(id);
        if (category) {
          items.set(id, { li, category });
        }
      });

      // Nearest ancestor that is actually shown in the sidebar
      const visibleParentId = (category) => {
        let parent = category.parentCategory;
        while (parent) {
          if (items.has(parent.id)) {
            return parent.id;
          }
          parent = parent.parentCategory;
        }
        return null;
      };

      const children = new Map();
      const roots = [];
      items.forEach(({ category }, id) => {
        const pid = visibleParentId(category);
        if (pid) {
          if (!children.has(pid)) {
            children.set(pid, []);
          }
          children.get(pid).push(id);
        } else {
          roots.push(id);
        }
      });

      // Preserve the sidebar's existing order among siblings
      const domIndex = new Map(
        [...items.keys()].map((id) => [
          id,
          [...list.children].indexOf(items.get(id).li),
        ])
      );
      const byDom = (a, b) => domIndex.get(a) - domIndex.get(b);

      let order = 0;
      const walk = (id, depth, hidden) => {
        const { li } = items.get(id);
        const kids = (children.get(id) || []).sort(byDom);
        const hasKids = kids.length > 0;
        const expanded = hasKids && isExpanded(id);

        li.style.order = String(order++);
        li.classList.add("sct-item");
        li.classList.toggle("sct-hidden", hidden);
        li.classList.toggle("sct-has-children", hasKids);
        li.classList.toggle("sct-expanded", expanded);
        li.style.setProperty("--sct-depth", depth);
        li.style.setProperty("--sct-indent", `${indent}px`);

        let toggle = li.querySelector(":scope > .sct-toggle");
        if (hasKids && !toggle) {
          toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "sct-toggle btn-transparent";
          toggle.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            state[id] = !isExpanded(id);
            saveState(state);
            apply();
          });
          li.prepend(toggle);
        } else if (!hasKids && toggle) {
          toggle.remove();
        }
        if (toggle) {
          toggle.setAttribute("aria-expanded", String(expanded));
          toggle.setAttribute("aria-label", expanded ? "Collapse" : "Expand");
        }

        kids.forEach((kid) => walk(kid, depth + 1, hidden || !expanded));
      };

      roots.sort(byDom).forEach((id) => walk(id, 0, false));

      // Non-category items (e.g. "All categories") stay at the end
      list.querySelectorAll(":scope > li:not(.sct-item)").forEach((li) => {
        li.style.order = String(order++);
      });
      list.classList.add("sct-list");
    } finally {
      applying = false;
    }
  }

  function observe() {
    observer?.disconnect();
    const sidebar = document.querySelector(".sidebar-wrapper, .sidebar-container");
    if (!sidebar) {
      return;
    }
    let scheduled = false;
    observer = new MutationObserver(() => {
      if (applying || scheduled) {
        return;
      }
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        apply();
      });
    });
    observer.observe(sidebar, { childList: true, subtree: true });
  }

  api.onPageChange(() => {
    if (!observer) {
      observe();
    }
    apply();
  });
});
