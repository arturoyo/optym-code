# optym-code — Preguntas de Negocio

**Fecha:** 2026-05-02

## Producto

### ¿Qué pasa si Anthropic unifica cuotas en una sola?
**Riesgo ALTO.** Si no hay cuota separada por modelo, nuestro valor principal desaparece para suscripciones.
**Mitigación:** Para API key users seguimos ahorrando dinero real (Haiku 18x más barato). Y pivotamos a multi-provider: routing entre Claude, Gemini, GPT — eso nunca lo hará Anthropic.
**Probabilidad:** Baja a medio plazo. Las cuotas separadas incentivan upgrades de plan. A Anthropic le conviene mantenerlas.

### ¿Los usuarios notarán diferencia Sonnet vs Opus?
**Para 70-80% de tareas: NO.** Leer archivos, git ops, refactors simples, explicaciones — Sonnet rinde igual.
**Para 20-30%: SÍ.** Arquitectura compleja, debugging multi-capa, razonamiento creativo — ahí Opus se nota.
**Por eso el escalado automático es clave.** No quitamos Opus, lo reservamos. El usuario debería sentir "mismo servicio, más duración".
**Validar en Fase 0:** si usuarios se quejan de calidad → afinar classifier para escalar más agresivamente.

### ¿El subagente pierde contexto de conversación?
**SÍ — esto es un problema real.** Cuando escalamos a Opus via subagente, el subagente no tiene historia de la conversación. Solo recibe el prompt actual.
**Mitigación actual:** El hook dice "Include relevant conversation context". Pero depende de que Sonnet lo haga bien.
**Fix futuro:** No escalar tareas que referencian conversación previa. Solo escalar tareas independientes (diseño, análisis desde cero).
**Pendiente:** Medir en Fase 0 cuántas escalaciones pierden contexto y si afecta calidad.

---

## Monetización

### ¿$9 es el precio correcto?
**Probablemente sí.** Referencia: Claude Max cuesta $100-200/mes. Si optym-code estira esa suscripción 2-3x, $9 es <5% del coste total. Impulso de compra fácil.
**Riesgo:** Si el ahorro percibido es bajo ("solo ahorro cuota, no dinero"), $9 puede parecer innecesario.
**Alternativa:** $4.99/mes — más impulso, menos barrera. Volumen > margen.
**Decisión:** Empezar con $9, bajar a $4.99 si conversión <2%.

### ¿Freemium por límites o por features?
**Por features (actual modelo).** Free = regex classifier. Pro = ML classifier.
**NO limitar requests en free.** Si el free no funciona bien, nadie probará el Pro. El free tiene que ser útil de verdad — solo "menos preciso" que Pro.
**El upsell es la precisión:** "Ahorras 60% con free. Podrías ahorrar 80% con Pro."

### ¿Cobrar por ahorro real? (% de savings)
**Idea interesante pero imposible de medir con suscripción.** No sabemos cuánto "vale" cada request en cuota. Con API key sí podríamos: "te ahorramos $47 este mes, te cobramos $4.70 (10%)".
**Decisión:** Flat rate ($9/mes) para suscripción. Usage-based para API key users en el futuro.

---

## Distribución

### ¿Cómo llegamos a los primeros 100 usuarios?
**Orden de prioridad:**
1. **Reddit r/ClaudeAI** — post con screenshot de statusline + savings reales. "I built a plugin that stretches my Opus quota 80%". Alto engagement.
2. **Twitter/X** — thread con before/after de cuota. Tag @AnthropicAI. Devs comparten savings.
3. **HackerNews** — "Show HN: optym-code — save 80% of your Claude Code Opus quota". Si llega a front page = 1000+ installs día 1.
4. **Discord Anthropic** — compartir en #claude-code channel.
5. **Dev.to / Hashnode** — blog post "How I save $X/month on Claude Code with a plugin".

### ¿Pedimos a Anthropic que nos listen como plugin oficial?
**No todavía.** Primero demostrar tracción (100+ installs, datos de savings reales). Anthropic podría verlo como "hack" de su sistema de cuotas.
**Después de tracción:** presentar como "mejora la experiencia del usuario" no como "exploit de cuotas". Ellos ahorran compute también.
**Riesgo:** Anthropic podría bloquear el plugin. Mitigación: somos open source, difícil de bloquear sin romper ecosistema de plugins.

### ¿Partnership con caveman?
**Sí, tiene sentido.** Caveman comprime output, nosotros rutamos modelos. Complementarios.
**Approach:** Contactar a Julius Brussee (creador de caveman). Proponer integración: caveman + optym-code bundle.
**O mejor:** No necesitamos partnership — ya integramos terse mode internamente. Caveman es competencia ahora, no partner.
**Decisión:** Mantener como competencia. Nuestro terse mode es suficiente. Si caveman nos copia el routing, nos diferencia el Pro (ML).

---

## Legal

### ¿Viola ToS de Anthropic?
**Analizado:** Los ToS de Claude Code permiten plugins y hooks. Cambiar `--model sonnet` es un flag público documentado. No interceptamos API, no modificamos auth, no reverse-engineeramos nada.
**El alias `claude --model sonnet` es uso legítimo** — es un flag oficial de Claude Code.
**La instrucción de escalado a Opus via Agent tool es uso legítimo** — Agent con model param es API pública.
**Conclusión: NO viola ToS.** Usamos APIs y flags públicos documentados.

### ¿GDPR con telemetría?
**Sí cumple, pero documentar mejor:**
- UUID anónimo generado localmente (no email, no nombre, no IP)
- Solo contadores agregados (sonnet:45, opus:8)
- No se almacenan prompts ni contenido
- Opt-out documentado en README
**Pendiente:** Añadir enlace a privacy policy en optym.pro. Documentar retención de datos (90 días).

### ¿MIT o AGPLv3?
**MIT es correcto para el plugin free.** Queremos máxima adopción. AGPLv3 ahuyenta empresas.
**El Pro (ML classifier) no está en el repo.** Está en api.optym.pro — no necesita licencia open source porque es SaaS.
**Decisión:** MIT para optym-code. Propietary para api.optym.pro. IP protegida.

---

## Competencia

### ¿Qué pasa si caveman copia el routing?
**Probable.** Julius verá nuestro repo público y puede añadir `--model sonnet` a caveman.
**Defensa:** Nuestro Pro (ML classifier 92%) no es copiable sin datos de entrenamiento. Free routing es fácil de copiar, Pro no.
**Timing:** Tenemos ventaja de ~2-4 semanas. Suficiente para establecer marca y primeros usuarios.

### ¿Si OpenAI/Google lanzan routing nativo?
**Validación total.** Si lo hacen, confirman que el problema es real y la solución valiosa.
**Pivote:** Nos convertimos en routing CROSS-PLATFORM. Ningún vendor hará routing entre competidores. Nosotros sí: "¿Esta tarea la hace mejor GPT-4 mini o Claude Sonnet? optym-code decide."
**Este es el verdadero moat a largo plazo:** routing agnóstico de provider.

### ¿Patentes?
**No viable en EU** (Arturo está en España). Software patents son débiles en Europa.
**En US:** Posible patentar "método de clasificación de prompts para optimización de cuota de modelo LLM en herramientas de desarrollo". Coste: ~$10-15K.
**Decisión:** No invertir en patentes ahora. Trade secret (ML classifier) + velocidad de ejecución > patentes.

---

## Preguntas sin responder (necesitan datos)

- ¿Cuál es el ratio real de tareas simples vs complejas en uso diario de Claude Code?
- ¿Cuánto dura Opus quota con vs sin optym-code? (medir en Fase 0)
- ¿Los usuarios de API key ahorran más o menos que los de suscripción?
- ¿Qué % de escalaciones a Opus son correctas? (precision del classifier)
- ¿Cuál es el NPS del producto? (medir con nudge de satisfacción)
