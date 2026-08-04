# Universal System GUIDs

These GUIDs (and numeric IDs) are **fixed constants** in every Optimizely CMS environment — they never change regardless of which instance, tenant, or environment you're working in. Use them whenever you need to reference these root nodes programmatically.

| Numeric ID | Name | GUID |
|:---:|---|---|
| 1 | Root Page | `43f936c9-9b23-4ea3-97b2-61c538ad07c9` |
| 2 | Wastebasket / Trash | `2f40ba47-f4fc-47ae-a244-0b909d4cf988` |
| 3 | Global Assets Root | `e56f85d0-e833-4e02-976a-2d11fe4d598c` |
| 4 | Content Assets Root | `99d57529-61f2-47c0-80c0-f91eca6af1ac` |

This guarantees that developers and APIs (like the Content Delivery API or Optimizely Graph) can safely target or exclude the root level without having to query for the environment-specific identifier first.

## Notes

- **Root Page** — the top-level ancestor of the entire content tree; all site pages descend from this node.
- **Wastebasket / Trash** — deleted content lands here before being permanently purged.
- **Global Assets Root** — shared/global media and assets (images, documents) visible across all sites.
- **Content Assets Root** — assets scoped to specific content items rather than globally shared.
