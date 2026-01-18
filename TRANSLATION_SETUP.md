# Translation Setup - Konfiguracija Prevođenja

Aplikacija podržava automatsko prevodenje teksta kroz različite provajdere. Translation je **opciona** funkcionalnost - ako nije konfigurisana, aplikacija radi normalno bez prevoda.

## Podržani Provajderi

### 1. **DeepL** (Preporučeno za evropske jezike)
- ✅ Odličan kvalitet prevoda
- ✅ Podrška za srpski (SR) - **samo paid API**, free API ima ograničenu podršku
- ✅ Besplatna trial verzija sa 500,000 karaktera/mesec

### 2. **OpenAI** (Preporučeno za srpski)
- ✅ Odličan kvalitet prevoda
- ✅ **Najbolji izbor za srpski** jezik
- ✅ Koristi GPT modele (gpt-3.5-turbo, gpt-4, itd.)

### 3. **Google** (Placeholder - nije implementirano)
- ⚠️ Trenutno nije potpuno implementirano
- Preporučeno: koristi DeepL ili OpenAI

## Konfiguracija za Vercel

### DeepL Setup

1. **Registruj se na DeepL:**
   - Idi na [https://www.deepl.com/pro-api](https://www.deepl.com/pro-api)
   - Kreiraj nalog i uzmi API key
   - **Free API:** [https://www.deepl.com/docs-api/api-access](https://www.deepl.com/docs-api/api-access) - dobijaš besplatno do 500k karaktera/mesec

2. **Dodaj u Vercel Environment Variables:**
   ```
   TRANSLATION_PROVIDER=deepl
   TRANSLATION_API_KEY=<tvoj-deepl-api-key>
   TRANSLATION_BASE_URL=https://api-free.deepl.com/v2/translate
   ```
   
   **Napomena:**
   - Za **Free API** (do 500k karaktera/mesec): `TRANSLATION_BASE_URL=https://api-free.deepl.com/v2/translate`
   - Za **Paid API** (neograničeno): `TRANSLATION_BASE_URL=https://api.deepl.com/v2/translate` ili ostavi prazno (default je paid URL)
   - **TRANSLATION_BASE_URL je opciono** - ako ostaviš prazno, koristi se default paid URL

### OpenAI Setup

1. **Registruj se na OpenAI:**
   - Idi na [https://platform.openai.com](https://platform.openai.com)
   - Kreiraj nalog i uzmi API key iz [API Keys sekcije](https://platform.openai.com/api-keys)

2. **Dodaj u Vercel Environment Variables:**
   ```
   TRANSLATION_PROVIDER=openai
   TRANSLATION_API_KEY=<tvoj-openai-api-key>
   TRANSLATION_BASE_URL=https://api.openai.com/v1/chat/completions
   TRANSLATION_MODEL=gpt-3.5-turbo
   ```
   
   **Napomena:**
   - **TRANSLATION_BASE_URL je opciono** - ako ostaviš prazno, koristi se `https://api.openai.com/v1/chat/completions`
   - **TRANSLATION_MODEL je opciono** - ako ostaviš prazno, koristi se `gpt-3.5-turbo`
   - Za bolji kvalitet: `TRANSLATION_MODEL=gpt-4` (skupije)
   - Za brzinu i nižu cenu: `TRANSLATION_MODEL=gpt-3.5-turbo` (preporučeno)

## Primeri Konfiguracije

### DeepL (Free)
```bash
TRANSLATION_PROVIDER=deepl
TRANSLATION_API_KEY=your-deepl-free-api-key-here
TRANSLATION_BASE_URL=https://api-free.deepl.com/v2/translate
```

### DeepL (Paid)
```bash
TRANSLATION_PROVIDER=deepl
TRANSLATION_API_KEY=your-deepl-paid-api-key-here
# TRANSLATION_BASE_URL može ostati prazno (default je paid URL)
```

### OpenAI
```bash
TRANSLATION_PROVIDER=openai
TRANSLATION_API_KEY=sk-your-openai-api-key-here
TRANSLATION_BASE_URL=https://api.openai.com/v1/chat/completions
TRANSLATION_MODEL=gpt-3.5-turbo
```

### Onemogući Prevod
```bash
TRANSLATION_PROVIDER=none
# Ostale TRANSLATION_* varijable mogu ostati prazne
```

## Kako Dodati u Vercel

1. **Idi u Vercel Dashboard:**
   - Projekat → Settings → Environment Variables

2. **Dodaj varijable za Production:**
   - `TRANSLATION_PROVIDER` - `deepl` ili `openai`
   - `TRANSLATION_API_KEY` - tvoj API key
   - `TRANSLATION_BASE_URL` - (opciono) base URL za API
   - `TRANSLATION_MODEL` - (opciono, samo za OpenAI) model naziv

3. **Redeploy Aplikaciju:**
   - Deployments → tri tačke (⋯) → Redeploy

## Provera da li Radi

1. Otvori bilo koju reklamaciju u aplikaciji
2. Idi na **Summary** tab
3. Pokušaj da prevedeš tekst (dugme "Translate to EN" ili slično)
4. Ako radi, vidićeš preveden tekst. Ako ne radi, proveri:
   - Da li su environment varijable postavljene na Vercel-u
   - Da li si uradio **Redeploy** nakon dodavanja varijabli
   - Vercel Runtime Logs za greške

## Troubleshooting

### Problem: "Translation failed: No translation returned"
- **Uzrok:** API key nije validan ili provider nije pravilno konfigurisan
- **Rešenje:** Proveri da li je `TRANSLATION_API_KEY` tačan i da li je `TRANSLATION_PROVIDER` tačno postavljen (`deepl` ili `openai`)

### Problem: "Translation request timed out"
- **Uzrok:** Problemi sa internet konekcijom ili API je spor
- **Rešenje:** Proveri internet konekciju ili koristi drugi provider

### Problem: Prevod ne radi za srpski (SR)
- **Uzrok:** DeepL free API ima ograničenu podršku za srpski
- **Rešenje:** Koristi **OpenAI** provider umesto DeepL za srpski jezik

### Problem: API key greška
- **Uzrok:** API key je pogrešan ili nema dozvole
- **Rešenje:** Proveri da li je API key tačan i da li ima dozvole za translation API

## Cene (Aproksimativno)

### DeepL
- **Free:** 500,000 karaktera/mesec besplatno
- **Paid:** €4.99/mesec za 1M karaktera, €9.99/mesec za 5M karaktera

### OpenAI
- **GPT-3.5-turbo:** ~$0.001 per 1K tokena (jeftinije)
- **GPT-4:** ~$0.03 per 1K tokena (skuplje, ali bolji kvalitet)

## Preporuka

Za **srpski jezik**, preporučujem **OpenAI** jer:
- ✅ Najbolji kvalitet prevoda za srpski
- ✅ Podrška za srpski je potpuna
- ✅ Relativno jeftino sa GPT-3.5-turbo
- ✅ Brzo i pouzdano

Za **ostale evropske jezike** (engleski, nemački, holandski), **DeepL** je odličan izbor zbog kvaliteta i free trial-a.
