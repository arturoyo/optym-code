# optym-code — Contexto operativo para otra IA

**Fecha:** 2026-05-04
**Repo:** https://github.com/arturoyo/optym-code
**Owner:** arturo (arturoyo@gmail.com)

---

## Qué es optym-code

Plugin para Claude Code (CLI de Anthropic) que hace dos cosas:
1. **Model routing** — enruta cada prompt al modelo más barato que puede resolverlo (Haiku/Sonnet/Opus)
2. **Terse mode** — comprime respuestas ~65% menos tokens

Resultado combinado: 20-55% de ahorro en quota de Claude Code.

---

## Estructura del repo

```
install.sh                  # Instalador one-command (curl | bash)
hooks/
  optym-activate.js         # SessionStart hook: activa terse + statusline
  optym-mode-tracker.js     # UserPromptSubmit hook: routing + nudges
  optym-statusline.sh       # Statusline: S:64% O:8% H:27% ↓78% vs Opus
  install.sh                # Instalador interno (post-clone)
skills/
  optym/skill.md            # /optym command
  savings/skill.md          # /savings command
  force-opus/skill.md       # /force-opus
  force-haiku/skill.md      # /force-haiku
  force-sonnet/skill.md     # /force-sonnet
  optym-code/upgrade/skill.md  # /optym-code:upgrade
README.md
CONTEXT.md                  # Este archivo
```

---

## Cómo funciona el routing

**Free (regex local, ~70% accuracy):**
- Hook clasifica el prompt con patrones regex
- Haiku: saludos, git status, preguntas simples
- Sonnet: write/create/fix/explain
- Opus: refactor, debug complejo, arquitectura

**Pro (Mercury 2 ML, ~92% accuracy, $9/mes):**
- Hook llama `api.optym.pro/v1/classify` con el prompt
- Gateway llama Mercury 2 (Inception Labs) — diffusion LLM, ~300-600ms
- Cache Redis 1h para prompts repetidos
- Prompts cortos (<50 chars) clasificados localmente (gratis)
- Fallback a regex si Mercury falla
- Pro key en `~/.optym-lite/pro.key` o env `OPTYM_PRO_KEY`

---

## Backend (api.optym.pro)

**Stack:** FastAPI + PostgreSQL + Redis
**Repo:** https://github.com/arturoyo/optym.pro (privado)
**Server:** miniserver arturo, /home/arturo/optym/

Endpoints relevantes para optym-code:
- `POST /v1/classify` — clasificar prompt (requiere Pro key)
- `POST /v1/telemetry` — ping anónimo de uso (sin auth)
- `GET /v1/telemetry/summary` — stats agregados públicos
- `GET /v1/telemetry/waitlist` — emails de waitlist (admin)

Classify usa Mercury 2 (Inception Labs):
- Modelo: `mercury-2`
- API key env: `INCEPTION_API_KEY`
- max_tokens: 500 (Mercury necesita budget para razonamiento interno)
- Tier names gateway: cheap/mid/premium → hook normaliza a haiku/sonnet/opus

---

## Dashboard admin (app.optym.pro)

Panel de admin en `app.optym.pro` → Admin:
- **⚡ optym-code** — telemetría de installs, requests, distribución modelos
- **📋 Waitlist** — emails de gente apuntada al waitlist

Stats día 1 (2026-05-04, solo uso interno arturo):
- 11 installs, 630 requests, 2 Pro (ambos arturo), 5 waitlist

---

## Nudges (sistema de conversión)

En `optym-mode-tracker.js`, el hook muestra nudges en markdown blockquote:

| Nudge | Frecuencia | Contenido |
|-------|-----------|-----------|
| Satisfacción | cada 50 req | Rating 1-5 |
| GitHub stars | cada 200 req | Link al repo |
| Upgrade Pro | cada 30 req (free) | Delta Haiku% actual vs Pro estimado |
| Feedback | cada 100 req | Opciones a/b/c/d |
| optym.pro platform | cada 20 sesiones (SessionStart) | Pitch para devs que usan LLMs en sus apps |

El nudge de upgrade muestra el mayor salto posible según uso real:
- Si mucho Opus → "Pro bajaría Opus de X% a Y%"
- Si mucho Sonnet → "Pro subiría Haiku de X% a Y%"
- Framing: optimización de quota, no dinero
- Precio siempre al final: "For just $9/month..."

---

## Statusline

Formato: `S:64% O:8% H:27% ↓78% vs Opus | optym.pro`

Savings calculado vs baseline todo-Opus (precios relativos H=1, S=12, O=60).
Pro users ven `OPTYM.PRO` en amarillo en vez de `optym.pro` en azul.

---

## Instalación para usuarios

```bash
curl -s https://raw.githubusercontent.com/arturoyo/optym-code/master/install.sh | bash
```

Reiniciar Claude Code. Listo.

Para activar Pro:
```bash
echo "optym_live_XXXX" > ~/.optym-lite/pro.key
chmod 600 ~/.optym-lite/pro.key
```

---

## Estado actual (2026-05-04)

- Plugin funcional y en uso interno ~5 días
- Pro con Mercury 2 operativo (Inception Labs PAYG)
- Admin panel con telemetría y waitlist
- Pendiente: lanzamiento público, landing optym.pro/#code
- La landing está en OTRO servidor — este repo solo tiene el plugin

---

## Tarea pendiente en este repo

**Verificar que el comando de instalación en la landing es correcto:**
```bash
curl -s https://raw.githubusercontent.com/arturoyo/optym-code/master/install.sh | bash
```

Si la landing muestra otro comando, actualizar para que coincida con este.
La landing de optym-code está en `optym.pro/#code` (servidor separado, no en este repo).
