# optym-code — Roadmap

**Última actualización:** 2026-05-04
**Visión:** El OpenRouter del CLI — routing inteligente para cualquier AI CLI y cualquier proveedor.

---

## Estado actual (2026-05-04)

- ✅ Proxy local funcional (localhost:8088)
- ✅ Routing estático Claude Code (Haiku/Sonnet/Opus)
- ✅ Terse mode (lite/full/ultra)
- ✅ Telemetría anónima en producción
- ✅ 1 usuario Pro activo (92% savings, 207 requests)
- ✅ 2 usuarios free activos (Linux + Windows)
- ✅ 4 emails en waitlist (incluyendo 1 en Codex)
- ✅ Landing en optym.pro/#code

---

## Fase 1 — Beta cerrado (ahora → 2 semanas)

**Goal:** 10 usuarios activos, datos reales de 1000+ requests.

- [ ] Enviar invitación a los 3 waitlist externos
- [ ] Actualizar copy landing (framing quota, no coste API)
- [ ] Fix bug `days_active: 20576` en telemetría
- [ ] Recoger feedback de usuarios Windows (satisfaction baja)
- [ ] Pulir classifier con datos reales de telemetría
- [ ] Documentar soporte multi-plataforma (win32 ya hay usuarios)

---

## Fase 2 — Beta abierto + npm público (semana 3-4)

**Goal:** 100 installs, primeras métricas públicas.

- [ ] Publicar en npm: `npm install -g optym-code`
- [ ] Post Reddit (r/ClaudeAI, r/programming, r/SideProject)
- [ ] HackerNews Show HN
- [ ] Datos reales en landing (% savings, installs, tier distribution)

---

## Fase 3 — Multi-CLI (mes 2)

**Goal:** Funcionar en los 3 CLIs principales de AI.

- [ ] **Codex CLI** — formato OpenAI-compatible, ya hay 1 waitlist
- [ ] **Gemini CLI** — mismo patrón proxy, model IDs distintos
- [ ] **Aider** — OpenAI-compatible, plug-and-play
- [ ] README multi-plataforma
- [ ] Tests cross-platform (Linux, macOS, Windows)

---

## Fase 4 — Monetización Pro (mes 2-3)

**Goal:** Primeros $500 MRR.

- [ ] Onboarding: registro → Stripe → OPTYM_PRO_KEY → activar
- [ ] Dashboard Pro en optym.pro (histórico, analytics por sesión)
- [ ] ML classifier con datos reales de telemetría
- [ ] Email sequence onboarding (3 emails)
- [ ] Pricing: $9/mes · $90/año

---

## Fase 5 — OpenRouter del CLI (mes 3-6)

**Goal:** Routing de modelo Y proveedor. Cualquier CLI, cualquier LLM.

```
CLI request → optym-code proxy
  → classify complexity
  → select model (Haiku/Sonnet/Opus/GPT-4o-mini/Gemini-Flash...)
  → select provider (Anthropic/OpenAI/DeepSeek/Mistral...)
  → cheapest option that meets SLA
```

- [ ] Soporte multi-proveedor (OpenAI, DeepSeek, Mistral)
- [ ] Arbitrage real-time (mismo engine que optym-api)
- [ ] Cursor/Windsurf/Continue.dev
- [ ] BYOK — el usuario trae sus propias keys de cada proveedor
- [ ] Team plan ($29/mes) — dashboard compartido

---

## Fase 6 — Modelos locales (mes 6+)

**Goal:** $0 para requests simples. Mezcla cloud + local transparente.

```
"fix typo" → Ollama local (phi-3, $0.000)
"explain this" → Sonnet ($0.003)
"design arch" → Opus ($0.052)
```

- [ ] Soporte Ollama (localhost:11434)
- [ ] Soporte LM Studio
- [ ] Router consciente de hardware local disponible
- [ ] Modo "max-local": escalar a cloud solo si local falla calidad

---

## Métricas objetivo

| Métrica | Ahora | Fase 2 | Fase 4 | Fase 5 |
|---|---|---|---|---|
| Installs activos | ~4 | 100 | 500 | 2000 |
| Avg savings % | 92% (Pro) | >70% | >75% | >80% |
| Pro conversions | 1 | 10 | 50 | 200 |
| MRR | $0 | $90 | $450 | $1800 |
| GitHub stars | — | 100 | 500 | 2000 |
| CLIs soportados | 1 | 1 | 3 | 6+ |
| Proveedores | 1 | 1 | 2 | 5+ |

---

## Moat

El valor acumulable que otros no pueden copiar fácilmente:

1. **Historial de uso por proyecto** — el classifier mejora con cada request
2. **Multi-CLI desde el día 1** — Anthropic nunca hará routing cross-provider
3. **Datos de telemetría anónima** — ground truth real de qué necesita Opus vs Haiku
4. **Comunidad early** — los primeros 100 usuarios son los evangelistas

---

## Decisiones pendientes

- ¿Free trial Pro? (7 días parece suficiente)
- ¿Programa de referidos? (1 mes gratis por referido activo)
- ¿Publicar dashboard de telemetría agregada? (social proof público)
- ¿Pricing anual desde el inicio? ($90/año = 2 meses gratis)
