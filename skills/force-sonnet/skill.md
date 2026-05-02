---
name: force-sonnet
description: Force all requests to use Claude Sonnet (mid tier)
---

Write "mid" to the optym-lite override file:

```bash
mkdir -p ~/.optym-lite && echo "mid" > ~/.optym-lite/force-tier
```

Tell the user: "All requests will now use Sonnet. Use /optym-reset to return to auto-routing."
