# Stacking order (z-index) used in the app

Keep new overlays on this scale so nothing ends up under something it should cover.

| z-index | What |
|---|---|
| none / `z-10`–`z-20` | page content, pinned bars (search + Filters bar, invoice detail header) |
| `z-30` | back-to-top button, tooltips |
| `z-40` | top bar, and the bell and account dropdowns inside it |
| `z-50` | page popups: chart expand, info dialog, Recycle Bin dialogs |
| `z-[55]` / `z-[60]` | mobile menu backdrop / drawer |
| `z-[9999]` | importer and invoice form popups, and every dropdown and calendar (drawn on the page itself, see `useFloatingPosition`) |
| `z-[10000]` | confirm dialog (can open from inside a form) |
| `z-[10001]` | toasts (must be seen over any popup) |

A dropdown inside a layered parent can never rise above that parent, so a dropdown's parent must be on a
higher layer than anything it should cover (that is why the top bar is above the pinned search bar).
