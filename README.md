# Sidebar Category Tree View

Discourse theme component that turns the sidebar "Categories" section into a
collapsible tree: subcategories are nested (indented) under their parent, and
parents get a chevron toggle. Expanded/collapsed state is saved per browser.

Install: Admin → Customize → Themes → Install → From a git repository, then add
the component to your theme.

Settings: `expanded_by_default`, `indent_per_level`.

Note: only categories present in the user's sidebar are shown — add
subcategories to the sidebar (or let Discourse's defaults include them) for
them to appear under their parent.
