---
name: force-opus
description: Force all requests to use Claude Opus (premium tier)
---

Write "premium" to the optym-lite override file:

```bash
mkdir -p ~/.optym-lite && echo "premium" > ~/.optym-lite/force-tier
```

Tell the user: "All requests will now use Opus. Use /optym-reset to return to auto-routing."
