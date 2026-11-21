// Vercel serverless function: turns the Store Visit Brief into speech with ElevenLabs.
// The API key and voice ID come from Vercel environment variables only; they are never sent to the browser.
// Only brief text is accepted, and it is capped in length, so the endpoint can't be used to read arbitrary text.
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  // Trim: a pasted key often carries a trailing space or line break, which makes the request header invalid.
  const key = (process.env.ELEVENLABS_API_KEY || "").trim(), voice = (process.env.ELEVENLABS_VOICE_ID || "").trim();
  if (!key || !voice) return res.status(503).json({ error: "Voice not configured" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const text = String((body && body.text) || "");
  if (!text.startsWith("Store brief for ") || text.length > 1500) return res.status(400).json({ error: "Only store briefs can be read" });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_turbo_v2_5", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      let detail = "";
      try { const j = await r.json(); detail = (j.detail && (j.detail.status || j.detail.message)) || ""; } catch { /* not JSON */ }
      return res.status(502).json({ error: `Voice service returned ${r.status}`, detail: String(detail).slice(0, 120) });
    }
    const audio = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(audio);
  } catch (e) {
    const timedOut = e && e.name === "AbortError";
    return res.status(504).json({ error: timedOut ? "Voice service timed out" : "Voice request failed", detail: timedOut ? "" : String((e && e.message) || "").slice(0, 120) });
  } finally {
    clearTimeout(timer);
  }
};
