import fetch from "node-fetch";

export function mountVcProxy(app){
  app.post("/vc/detect", async (req, res) => {
    try {
      const { imageBase64 } = req.body || {};
      if (!imageBase64) return res.status(400).json({ error: "missing imageBase64" });

      const apiKey = process.env.ROBOFLOW_API_KEY;
      const model = process.env.ROBOFLOW_MODEL;
      const version = process.env.ROBOFLOW_VERSION;
      if (!apiKey || !model || !version) return res.status(500).json({ error: "missing ROBOFLOW_* envs" });

      const b64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const url = `https://detect.roboflow.com/${model}/${version}?api_key=${apiKey}&confidence=0.4&overlap=0.3&format=json`;

      const rf = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: b64
      });

      if (!rf.ok) return res.status(500).json({ error: "roboflow_error", detail: await rf.text() });
      res.json(await rf.json());
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
}
