/**
 * MMM-PrayerTimePro — node_helper.js
 * Handles all server-side operations:
 *  - AlAdhan API v2 requests (today + tomorrow + Hijri)
 *  - Disk caching to handle offline gracefully
 *  - Adhan audio playback via mpg123 / omxplayer / afplay
 *  - Telegram bot notifications
 */

const NodeHelper  = require("node_helper");
const https       = require("https");
const http        = require("http");
const fs          = require("fs");
const path        = require("path");
const { exec }    = require("child_process");

const CACHE_DIR  = path.join(__dirname, ".cache");
const API_BASE   = "https://api.aladhan.com/v1";

module.exports = NodeHelper.create({

  start () {
    console.log("[MMM-PrayerTimePro] Node helper started.");
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  },

  socketNotificationReceived (notification, payload) {
    switch (notification) {
      case "PRAYER_TIME_FETCH":
        this._fetchPrayerTimes(payload);
        break;
      case "PRAYER_TIME_ADHAN":
        this._playAdhan(payload);
        break;
      case "PRAYER_TIME_TELEGRAM":
        this._sendTelegram(payload);
        break;
      case "PRAYER_TIME_GEOCODE":
        this._geocode(payload);
        break;
    }
  },

  /* ─────────────────────── API FETCH ──────────────────────────────────── */
  async _fetchPrayerTimes (cfg) {
    const totalDays  = Math.max(2, Math.min(7, cfg.totalDays || 2));
    const instanceId = cfg.instanceId;
    const cacheFile  = path.join(CACHE_DIR, `prayer_cache_${instanceId}.json`);

    // Get today's date as {year, month, day} in the target timezone.
    // We never use Date arithmetic for this — we ask Intl directly so the
    // calendar date is always correct for the remote location.
    const baseTuple = this._todayTupleInTz(cfg.timezone);

    try {
      const results = await Promise.all(
        Array.from({ length: totalDays }, (_, i) => {
          const tuple = this._addDays(baseTuple, i);
          return this._fetchDay(tuple, cfg).then(data => ({ offset: i, tuple, data }));
        })
      );

      // If timezone was not configured, read the auto-detected one from the API response
      const resolvedTimezone = (cfg.timezone && cfg.timezone !== false)
        ? cfg.timezone
        : (results[0].data.meta && results[0].data.meta.timezone) || null;

      const today    = results[0].data.timings;
      const tomorrow = results[1] ? results[1].data.timings : null;
      const hijri    = this._formatHijri(results[0].data.date.hijri, cfg.hijriAdjustment);

      const days = results.map(({ offset, tuple, data }) => ({
        offset,
        date:    this._tupleToDateString(tuple),
        timings: data.timings,
        label:   offset === 0 ? "Today" : this._tupleToWeekday(tuple, resolvedTimezone),
      }));

      const cachePayload = {
        instanceId,
        date:     this._tupleToDateString(baseTuple),
        timezone: resolvedTimezone,
        today,
        tomorrow,
        days,
        hijri,
      };
      fs.writeFileSync(cacheFile, JSON.stringify(cachePayload));
      this.sendSocketNotification("PRAYER_TIME_DATA", cachePayload);

    } catch (err) {
      console.error("[MMM-PrayerTimePro] API error:", err.message);

      if (fs.existsSync(cacheFile)) {
        try {
          const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
          console.log(`[MMM-PrayerTimePro] ${instanceId} serving cached data from`, cached.date);
          this.sendSocketNotification("PRAYER_TIME_DATA", { ...cached, instanceId });
          return;
        } catch (_) {}
      }

      this.sendSocketNotification("PRAYER_TIME_ERROR", {
        instanceId,
        message: `Failed to fetch prayer times: ${err.message}`,
      });
    }
  },

  /* ── Date tuple helpers ───────────────────────────────────────────────── */

  /* Returns {year, month (1-12), day} for today in the given IANA timezone.
   * Uses toLocaleString instead of formatToParts for broader Node compatibility. */
  _todayTupleInTz (timezone) {
    try {
      const now  = new Date();
      const opts = { year: "numeric", month: "numeric", day: "numeric" };
      if (timezone && timezone !== false) opts.timeZone = timezone;
      const str  = now.toLocaleString("en-US", opts);
      const [month, day, year] = str.split("/").map(Number);
      if (!year || !month || !day) throw new Error("parse failed");
      return { year, month, day };
    } catch (err) {
      console.warn("[MMM-PrayerTimePro] _todayTupleInTz fallback:", err.message);
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
    }
  },

  /* Adds n calendar days to a {year, month, day} tuple without any timezone ambiguity */
  _addDays ({ year, month, day }, n) {
    // Use UTC Date arithmetic — no DST or timezone offset interference
    const d = new Date(Date.UTC(year, month - 1, day + n));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  },

  /* "Fri", "Sat", etc. for a tuple in the given timezone */
  _tupleToWeekday ({ year, month, day }, timezone) {
    try {
      const d    = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      const opts = { weekday: "short" };
      if (timezone && timezone !== false) opts.timeZone = timezone;
      return d.toLocaleDateString("en-US", opts);
    } catch (_) {
      const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      return days[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
    }
  },

  /* "Fri Jun 06 2026"-style string for display/cache keying */
  _tupleToDateString ({ year, month, day }) {
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return d.toUTCString().slice(0, 16); // "Fri, 06 Jun 2026" — stable, readable
  },

  /* Remove the old _todayInTz — replaced by _todayTupleInTz above */

  _fetchDay ({ year, month, day }, cfg) {
    const dd   = String(day).padStart(2, "0");
    const mm   = String(month).padStart(2, "0");
    const yyyy = String(year);

    const params = new URLSearchParams({
      latitude:  cfg.lat,
      longitude: cfg.lon,
      method:    cfg.method,
      school:    cfg.school   || 0,
      midnightMode: cfg.midnightMode || 0,
      latitudeAdjustmentMethod: cfg.latitudeAdjustmentMethod || 3,
    });

    if (cfg.timezone && cfg.timezone !== false) params.set("timezonestring", cfg.timezone);
    if (cfg.tune)     params.set("tune", cfg.tune);
    if (cfg.method == 99 && cfg.methodSettings) {
      params.set("methodSettings", cfg.methodSettings);
    }

    const url = `${API_BASE}/timings/${dd}-${mm}-${yyyy}?${params.toString()}`;
    return this._httpGet(url).then(body => {
      const parsed = JSON.parse(body);
      if (parsed.code !== 200) throw new Error(parsed.status || "API error");
      return parsed.data;
    });
  },

  _httpGet (url, headers = {}) {
    return new Promise((resolve, reject) => {
      const lib     = url.startsWith("https") ? https : http;
      const options = { timeout: 15000, headers };
      const req = lib.get(url, options, res => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => resolve(data));
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
    });
  },

  /* ─────────────────────── HIJRI DATE ─────────────────────────────────── */
  _formatHijri (hijri, adjustment = 0) {
    if (!hijri) return null;
    try {
      // Adjust day
      let day   = parseInt(hijri.day, 10) + (adjustment || 0);
      const month = hijri.month.en;
      const year  = hijri.year;
      return `${day} ${month} ${year} AH`;
    } catch (_) {
      return null;
    }
  },

  /* ─────────────────────── ADHAN PLAYBACK ─────────────────────────────── */
  _playAdhan ({ prayer, sound, volume }) {
    const soundPath = path.isAbsolute(sound)
      ? sound
      : path.join(__dirname, "sounds", sound);

    if (!fs.existsSync(soundPath)) {
      console.warn(`[MMM-PrayerTimePro] Sound file not found: ${soundPath}`);
      return;
    }

    const vol = Math.max(0, Math.min(100, volume || 80));
    // Try players in order of preference
    const players = [
      `mpg123 -f ${Math.round(vol * 327)} "${soundPath}"`,
      `omxplayer --vol ${this._omxVolume(vol)} "${soundPath}"`,
      `afplay -v ${vol / 100} "${soundPath}"`,
      `aplay "${soundPath}"`,
    ];

    this._tryPlayers(players, 0);
  },

  _tryPlayers (players, idx) {
    if (idx >= players.length) {
      console.warn("[MMM-PrayerTimePro] No audio player found.");
      return;
    }
    exec(players[idx], err => {
      if (err && err.code === 127) {
        // command not found — try next
        this._tryPlayers(players, idx + 1);
      } else if (err) {
        console.error(`[MMM-PrayerTimePro] Playback error: ${err.message}`);
      }
    });
  },

  _omxVolume (pct) {
    // omxplayer uses millibels; 0%=-6000mb, 100%=0mb
    return Math.round(-6000 + (pct / 100) * 6000);
  },

  /* ─────────────────────── REVERSE GEOCODE ────────────────────────────── */
  async _geocode ({ instanceId, lat, lon }) {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`;
    try {
      const body = await this._httpGet(url, { "User-Agent": "MMM-PrayerTimePro/1.0" });
      const data = JSON.parse(body);
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.county || addr.state || addr.country || "Unknown";
      this.sendSocketNotification("PRAYER_TIME_GEOCODE_RESULT", { instanceId, city });
    } catch (err) {
      console.warn(`[MMM-PrayerTimePro] Geocode failed: ${err.message}`);
      this.sendSocketNotification("PRAYER_TIME_GEOCODE_RESULT", { instanceId, city: null });
    }
  },

  /* ─────────────────────── TELEGRAM ───────────────────────────────────── */
  _sendTelegram ({ prayer, telegram, label }) {
    if (!telegram.enabled || !telegram.botToken || !telegram.chatIds.length) return;

    const text = encodeURIComponent(`🕌 It's time for ${label} prayer.`);
    for (const chatId of telegram.chatIds) {
      const url = `https://api.telegram.org/bot${telegram.botToken}/sendMessage?chat_id=${chatId}&text=${text}`;
      this._httpGet(url).catch(err =>
        console.error(`[MMM-PrayerTimePro] Telegram error: ${err.message}`)
      );
    }
  },
});
