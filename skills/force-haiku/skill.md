---
name: force-haiku
description: Force all requests to use Claude Haiku (cheap tier)
---

Write "cheap" to the optym-lite override file:

```bash
mkdir -p ~/.optym-lite && echo "cheap" > ~/.optym-lite/force-tier
```

Tell the user: "All requests will now use Haiku. Use /optym-reset to return to auto-routing."
