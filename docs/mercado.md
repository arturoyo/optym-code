# optym-code — Análisis de Mercado

**Fecha:** 2026-05-02

## TAM (Total Addressable Market)

| Segmento | Estimación |
|---|---|
| Devs en el mundo | ~30M |
| Usan AI coding tools | ~50% → 15M |
| Usan Claude (cualquier forma) | ~15-20% → 2-3M |
| Claude Code específicamente | ~30-40% de users Claude → 800K-1.2M |
| Con suscripción Max/Pro | ~20-30% → 200K-350K |

## SAM (Serviceable Available Market)

Devs con suscripción Claude Code Max/Pro que queman Opus en tareas simples: **200K-350K**

## Proyecciones de Revenue

| Captura | Usuarios | MRR ($9/mes Pro) |
|---|---|---|
| 1% | 2K-3.5K | $18K-31K |
| 2% | 4K-7K | $36K-63K |
| 5% | 10K-17.5K | $90K-157K |
| 10% | 20K-35K | $180K-315K |

## Mercado adicional (no suscripción)

| Segmento | Usuarios est. | Modelo |
|---|---|---|
| API key directa (Anthropic) | ~500K devs | Proxy — ahorro real en $ |
| Aider users | ~100K | Proxy compatible |
| Cursor (modo Claude) | ~1M+ | Proxy compatible |
| Gemini CLI (futuro) | Creciendo | Adaptable |
| Codex CLI (futuro) | Nuevo | Adaptable |

## Competencia directa

| Producto | Qué hace | vs optym-code |
|---|---|---|
| Caveman | Comprime output (texto) | No hace routing |
| Superpowers | Skills de workflow | No optimiza costes |
| Ninguno | Smart model routing para suscripción | **Somos los primeros** |

## Moat (ventaja competitiva)

1. **First mover** — nadie hace routing de cuota para suscripción
2. **Datos de uso** — telemetría anónima da insights únicos sobre patrones de uso
3. **Funnel a Optym Pro** — ML classifier no es replicable sin datos de entrenamiento
4. **Efecto red** — más usuarios → mejores datos → mejor routing → más usuarios
5. **Open source** — adopción rápida, confianza, contribuciones

## Riesgo principal

Anthropic implementa routing automático nativo. Mitigación: si lo hacen, validamos nuestra tesis y pivotamos a multi-provider (Gemini + OpenAI + Claude).

## Expansión multi-plataforma

El problema de "quemar modelo caro en tareas simples" es universal:

| Plataforma | Modelo caro → barato | Esfuerzo adaptación |
|---|---|---|
| Gemini CLI | Pro → Flash | Hook similar, cambiar modelo IDs |
| Codex (OpenAI) | o3 → o4-mini | Proxy + model rewrite |
| Cursor | Slow → Fast | Extension API diferente |
| Windsurf | Premium → Standard | Extension API diferente |
| Aider | Any → cheaper | Proxy ya funciona |
| Continue.dev | Any → cheaper | Extension adaptable |

**TAM con multi-plataforma: ~15M devs usando AI coding tools.**

A $9/mes, capturar 1% de ese mercado = **$1.35M MRR**.

Prioridad de expansión:
1. ✅ Claude Code (hecho)
2. 🔜 Gemini CLI (mismo patrón de hooks)
3. 🔜 Codex CLI (proxy)
4. 🔜 Cursor/Windsurf (plugins nativos)
