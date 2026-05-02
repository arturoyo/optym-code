# optym-code — Roadmap

**Fecha:** 2026-05-02

## Fase 0: Validación (AHORA → 5 días)

- [ ] Usar optym-code diario 3-5 días
- [ ] Medir: ¿Opus quota dura más? ¿Sonnet se usa? ¿Calidad OK?
- [ ] Señales OK: Opus <50% uso diario, Sonnet sube de 3% a 30%+, sin pérdida calidad
- [ ] Señales KO: Sonnet no escala a Opus cuando toca, respuestas peores
- [ ] Recoger datos reales de `optym-code stats` y telemetría
- [ ] Ajustar classifier si hay falsos negativos/positivos

## Fase 1: Pulir + Publicar (Semana 2)

- [ ] Actualizar landing optym.pro/#code con datos reales
- [ ] Publicar npm: `npm install -g optym-code`
- [ ] Primer post en redes: "Save 80% of your Opus quota"
- [ ] Publicar en Reddit (r/ClaudeAI, r/programming)
- [ ] Publicar en HackerNews
- [ ] Publicar en Twitter/X dev community

## Fase 2: Gemini CLI + Codex (Semana 3-4)

- [ ] Adaptar hooks para Gemini CLI (mismo patrón, model IDs diferentes)
- [ ] Adaptar proxy para Codex CLI (OpenAI API format)
- [ ] README multi-plataforma
- [ ] Tests en ambas plataformas
- [ ] Publicar como plugin en ecosistemas respectivos

## Fase 3: Pro + Monetización (Mes 2)

- [ ] Onboarding flow: registro → pago → key → activar Pro
- [ ] Landing page checkout integrado con Stripe
- [ ] Email onboarding sequence (3 emails)
- [ ] Afinar ML classifier con datos reales de telemetría
- [ ] Dashboard Pro en optym.pro (histórico, analytics)

## Fase 4: Escalar (Mes 3+)

- [ ] Cursor/Windsurf extensions
- [ ] Continue.dev plugin
- [ ] VS Code extension standalone (no solo Claude Code)
- [ ] Team plan ($29/mes) — dashboard compartido
- [ ] Enterprise — self-hosted classify endpoint
- [ ] Blog: "How we save devs $X/month on AI coding"

## Métricas clave

| Métrica | Target Fase 0 | Target Fase 1 | Target Fase 3 |
|---|---|---|---|
| Installs | 1 (nosotros) | 100 | 1000 |
| Avg savings % | >50% | >60% | >70% |
| Pro conversions | 0 | 5 | 50 |
| MRR | $0 | $45 | $450 |
| GitHub stars | 0 | 50 | 500 |
| Plataformas | 1 (Claude) | 3 (Gemini, Codex) | 5+ |

## Decisiones pendientes

- ¿Free trial de Pro? (14 días vs 7 días)
- ¿Pricing anual? ($9/mes vs $90/año → 2 meses gratis)
- ¿Abrir telemetría dashboard público? (social proof)
- ¿Programa de referidos? (1 mes gratis por referido)
