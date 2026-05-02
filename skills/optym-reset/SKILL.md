---
name: optym-reset
description: Clear tier override and return to auto-routing
---

Remove the optym-lite override file:

```bash
rm -f ~/.optym-lite/force-tier
```

Tell the user: "Auto-routing restored. optym-lite will classify prompts automatically."
