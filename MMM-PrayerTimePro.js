/**
 * MMM-PrayerTimePro
 * A robust, fully customizable MagicMirror² module for Islamic prayer times.
 *
 * Features:
 *  - AlAdhan API v2 with full calculation method support (20+ methods)
 *  - Countdown timer to next prayer
 *  - Hijri date display with optional adjustment
 *  - Iqama (post-adhan wait) timers per prayer
 *  - Audio adhan support (multiple audio files per prayer)
 *  - Visual & notification alerts
 *  - Horizontal / vertical / compact display modes
 *  - Per-prayer show/hide and custom labels
 *  - 12 / 24-hour formats
 *  - Offline fallback caching
 *  - MMM-ModuleScheduler compatible
 *  - Telegram bot notification support
 *  - RTL language support
 *  - Full i18n translation system
 *
 * @author  MMM-PrayerTimePro contributors
 * @license MIT
 */

Module.register("MMM-PrayerTimePro", {

  /* ─────────────────────────── DEFAULT CONFIG ────────────────────────────── */
  defaults: {
    // Location (required)
    lat: false,
    lon: false,
    timezone: false,          // e.g. "America/New_York" — false = auto from lat/lon

    // Time display
    timeFormat: 24,           // 12 or 24
    showSeconds: false,

    // Calculation
    method: 2,                // 0-23; see https://aladhan.com/calculation-methods
    methodSettings: false,    // "FajrAngle,MaghribType,MaghribValue,IshaType,IshaValue" (method must be 99)
    school: 0,                // 0=Shafi, 1=Hanafi
    midnightMode: 0,          // 0=Standard, 1=Jafari
    latitudeAdjustmentMethod: 3,
    tune: false,              // "Imsak,Fajr,Sunrise,Dhuhr,Asr,Sunset,Maghrib,Isha,Midnight" offset in minutes

    // Hijri date
    showHijriDate: true,
    hijriDateFormat: "iD iMMMM iYYYY",  // moment-hijri format string
    hijriAdjustment: 0,       // ±N days

    // Prayer display
    prayers: [
      { name: "imsak",    label: null, show: true,  adhan: false, iqama: 0  },
      { name: "fajr",     label: null, show: true,  adhan: true,  iqama: 20 },
      { name: "sunrise",  label: null, show: true,  adhan: false, iqama: 0  },
      { name: "dhuhr",    label: null, show: true,  adhan: true,  iqama: 15 },
      { name: "asr",      label: null, show: true,  adhan: true,  iqama: 15 },
      { name: "sunset",   label: null, show: false, adhan: false, iqama: 0  },
      { name: "maghrib",  label: null, show: true,  adhan: true,  iqama: 5  },
      { name: "isha",     label: null, show: true,  adhan: true,  iqama: 15 },
      { name: "midnight", label: null, show: false, adhan: false, iqama: 0  },
      { name: "lastthird",label: null, show: false, adhan: false, iqama: 0  },
    ],

    // Layout
    displayMode: "vertical",  // "vertical" | "horizontal" | "compact"
    showNextPrayer: true,     // highlight next upcoming prayer
    showCountdown: true,      // show time remaining to next prayer
    showIqama: false,         // show iqama time below adhan
    showDate: true,           // show today's Gregorian date
    showTomorrow: true,       // show tomorrow's times in a second column/section
    showIcon: true,           // show prayer icons

    // Compact multi-day grid (only applies when displayMode === "compact")
    compactDays: 3,           // total columns: today + N future days (1–7)
    showTimeDelta: true,      // show ±Xm change vs today in future day columns
    showTimeInDelta: true,    // when showTimeDelta is true, also show the time (false = badge only)

    // Module title
    autoTitle: false,         // true = auto-resolve city name from lat/lon and show as header
    titlePrefix: "",          // optional prefix, e.g. "Prayer Times —"

    // Adhan audio
    playAdhan: true,
    adhanSound: {
      fajr:    "adhan_fajr.mp3",   // relative to module/sounds/ or absolute path
      default: "adhan.mp3",
    },
    adhanVolume: 80,          // 0-100

    // Alerts
    showAlert: true,
    alertTimer: 15000,        // ms alert stays visible
    alertMessage: null,       // null = auto from translations

    // Notifications sent to other modules
    sendNotifications: true,

    // Telegram (optional)
    telegram: {
      enabled: false,
      botToken: "",
      chatIds: [],
    },

    // Progress bar — shows elapsed time since the last prayer as a filled bar
    // displayed inside the countdown banner below the label/timer row
    showProgressBar: false,   // true = show the bar

    // Countdown alert — animate the Next banner when time is running out
    // animation: "pulse" | "glow" | "shake" | "bounce" | null
    countdownAlert: {
      enabled:      true,
      threshold:    30,       // minutes remaining to trigger
      animation:    "pulse",  // "pulse" | "glow" | "shake" | "bounce" | null
      color:        null,     // null = keep accent color, or any CSS color e.g. "#ff4d4d"
      invertColors: false,    // true = solid color background, white text
    },

    // Update schedule
    useUpdateInterval: true,
    updateInterval: 86400 * 1000,
    animationSpeed: 2500,

    // i18n
    language: "en",

    // Appearance
    colored: true,            // use accent colour for next prayer row
    accentColor: "#40bfff",
    dimPast: true,            // slightly grey-out past prayers
    tableClass: "small",      // MagicMirror table class: xsmall | small | medium | large
  },

  /* ─────────────────────────── LIFECYCLE ─────────────────────────────────── */
  start () {
    Log.info(`[MMM-PrayerTimePro] Starting…`);
    this.prayerData     = null;
    this.tomorrowData   = null;
    this.multiDayData   = [];   // [{date, timings, hijri}, …] indexed 0=today
    this.hijriDate      = null;
    this.nextPrayerName = null;
    this.nextPrayerTime = null;
    this.countdown      = "";
    this.countdownMins  = null;
    this.prevPrayerMins = null;   // start of the current prayer window (for progress bar)
    this.loaded         = false;
    this.error          = null;
    this.cachedDate     = null;
    this.locationTitle  = null; // resolved city name for autoTitle
    this.resolvedTz     = null; // IANA timezone string for this instance
    this.allPrayersPast = false; // true after last prayer of the day has passed

    // Tick every second for countdown
    this._tick = setInterval(() => this._updateCountdown(), 1000);

    // Resolve city name if autoTitle is enabled
    if (this.config.autoTitle && this.config.lat && this.config.lon) {
      this.sendSocketNotification("PRAYER_TIME_GEOCODE", {
        instanceId: this.identifier,
        lat: this.config.lat,
        lon: this.config.lon,
      });
    }

    if (this.config.useUpdateInterval) {
      this.fetchPrayerTimes();
      setInterval(() => this.fetchPrayerTimes(), this.config.updateInterval);
    } else {
      this.fetchPrayerTimes();
    }
  },

  stop () {
    clearInterval(this._tick);
    if (this._staleCacheRetry) clearTimeout(this._staleCacheRetry);
  },

  getStyles ()  { return ["MMM-PrayerTimePro.css"]; },
  getScripts () { return []; },

  // Standard MagicMirror header — shown in the module's title bar.
  // Returns the resolved city name when autoTitle is on, a manual title
  // when titlePrefix is set alone, or undefined (no header) otherwise.
  getHeader () {
    if (this.config.autoTitle) {
      if (!this.locationTitle) return undefined;  // hide until resolved
      const prefix = this.config.titlePrefix ? `${this.config.titlePrefix} ` : "";
      return `${prefix}${this.locationTitle}`;
    }
    if (this.config.titlePrefix) return this.config.titlePrefix;
    return undefined;
  },
  getTranslations () {
    return {
      en:  "translations/en.json",
      ar:  "translations/ar.json",
      id:  "translations/id.json",
      tr:  "translations/tr.json",
      fr:  "translations/fr.json",
      de:  "translations/de.json",
      ms:  "translations/ms.json",
    };
  },

  /* ─────────────────────────── NODE HELPER COMMS ─────────────────────────── */
  fetchPrayerTimes () {
    this.sendSocketNotification("PRAYER_TIME_FETCH", {
      instanceId:             this.identifier,
      lat:                    this.config.lat,
      lon:                    this.config.lon,
      timezone:               this.config.timezone,
      method:                 this.config.method,
      methodSettings:         this.config.methodSettings,
      school:                 this.config.school,
      midnightMode:           this.config.midnightMode,
      latitudeAdjustmentMethod: this.config.latitudeAdjustmentMethod,
      tune:                   this.config.tune,
      hijriAdjustment:        this.config.hijriAdjustment,
      // Fetch compactDays + 1 so that after rollover we still have enough columns.
      // Min 3 to always have today + tomorrow for countdown fallback.
      totalDays: Math.max(3, (this.config.compactDays || 3) + 1),
    });
  },

  socketNotificationReceived (notification, payload) {
    // Ignore responses intended for a different instance
    if (payload && payload.instanceId && payload.instanceId !== this.identifier) return;

    switch (notification) {
      case "PRAYER_TIME_DATA":
        this.loaded        = true;
        this.error         = null;
        this.prayerData    = payload.today;
        this.tomorrowData  = payload.tomorrow;
        this.multiDayData  = payload.days || [];
        this.hijriDate     = payload.hijri;
        this.cachedDate    = payload.date;
        this.resolvedTz     = payload.timezone || this.config.timezone || null;
        if (this.resolvedTz === false) this.resolvedTz = null;
        this.allPrayersPast = false;
        this._buildTimeline();
        this.updateDom(this.config.animationSpeed);
        // Force show in case MM hid the module while waiting for data
        this.show(this.config.animationSpeed, () => {}, { force: true });
        // Stale cache was served (network not ready on boot) — retry in 2 minutes
        if (this._staleCacheRetry) clearTimeout(this._staleCacheRetry);
        if (payload.staleCache) {
          Log.warn(`[MMM-PrayerTimePro] Stale cache from ${payload.date} — retrying in 2 min`);
          this._staleCacheRetry = setTimeout(() => this.fetchPrayerTimes(), 2 * 60 * 1000);
        }
        break;

      case "PRAYER_TIME_GEOCODE_RESULT":
        this.locationTitle = payload.city;
        // Only rebuild DOM if already loaded — otherwise the header will
        // update naturally when prayer data arrives and getDom() runs
        if (this.loaded) this.updateDom(0);
        break;

      case "PRAYER_TIME_ERROR":
        this.error = payload.message;
        this.updateDom(this.config.animationSpeed);
        break;
    }
  },

  /* Handle MMM-ModuleScheduler trigger */
  notificationReceived (notification, payload) {
    if (notification === "PRAYER_TIME" && payload && payload.type === "UPDATE_PRAYINGTIME") {
      this.fetchPrayerTimes();
    }
  },

  /* ─────────────────────────── COUNTDOWN / TIMELINE ──────────────────────── */
  _buildTimeline () {
    if (!this.prayerData) return;
    const nowMins = this._nowMinsComparable();

    this._timeline = this.config.prayers
      .filter(p => p.show !== false)
      .map(p => {
        const raw = this.prayerData[this._apiKey(p.name)];
        if (!raw) return null;
        const mins = this._prayerMins(raw, p.name);
        return { name: p.name, mins, raw, adhan: p.adhan, iqama: p.iqama || 0 };
      })
      .filter(Boolean)
      .sort((a, b) => a.mins - b.mins);
  },

  _updateCountdown () {
    if (!this._timeline) return;
    const nowMins = this._nowMinsComparable();
    let next = null;

    for (const entry of this._timeline) {
      if (entry.mins > nowMins) { next = entry; break; }
    }

    // Detect when all of today's prayers have passed
    const allPast = !next;
    if (allPast && !this.allPrayersPast && this.loaded) {
      this.allPrayersPast = true;
      // Rebuild the compact table in place without calling updateDom
      // (calling updateDom triggers MM's hide/show cycle which can hide the module)
      this._rebuildCompactTable();
    }

    // Once midnight passes in the target tz, clear the rollover flag
    if (this.allPrayersPast) {
      const nowTuple  = this._nowTupleInTz();
      const todayData = this.multiDayData[1];
      if (todayData) {
        const col = this._parseTupleFromDateString(todayData.date);
        if (col && col.year === nowTuple.year && col.month === nowTuple.month && col.day === nowTuple.day) {
          this.allPrayersPast = false;
          this._rebuildCompactTable();
        }
      }
    }

    // If all today's prayers are past, find first of tomorrow
    if (!next && this.tomorrowData) {
      for (const p of this.config.prayers.filter(p => p.show !== false)) {
        const raw = this.tomorrowData[this._apiKey(p.name)];
        if (!raw) continue;
        const mins = this._prayerMins(raw, p.name) + 1440; // tomorrow = +1 day in mins
        next = { name: p.name, mins, raw };
        break;
      }
    }

    if (!next) { this.countdown = ""; return; }

    const changed = next.name !== this.nextPrayerName;
    this.nextPrayerName = next.name;

    // Remember where the current window started (for progress bar)
    // prevEntry is the prayer that just passed, i.e. the one right before next.
    if (this.config.showProgressBar) {
      let prev = null;
      for (let i = this._timeline.length - 1; i >= 0; i--) {
        if (this._timeline[i].mins <= nowMins) { prev = this._timeline[i]; break; }
      }
      this.prevPrayerMins = prev ? prev.mins : null;
    }

    // Countdown in seconds — use mins difference
    const diffMins = next.mins - nowMins;
    const diffSecs = diffMins * 60 - (new Date().getSeconds());
    const diff     = Math.max(0, diffSecs);
    const h = String(Math.floor(diff / 3600)).padStart(2, "0");
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
    const s = String(diff % 60).padStart(2, "0");
    this.countdown    = diff >= 3600 ? `${h}:${m}:${s}` : `${m}:${s}`;
    this.countdownMins = diffMins;

    // Trigger adhan when countdown reaches zero
    if (diff === 0 && changed) this._onPrayerTime(next);

    this._refreshCountdownEl();
  },

  _onPrayerTime (entry) {
    Log.info(`[MMM-PrayerTimePro] Prayer time: ${entry.name}`);

    if (this.config.playAdhan && entry.adhan) {
      this.sendSocketNotification("PRAYER_TIME_ADHAN", {
        prayer: entry.name,
        sound:  this.config.adhanSound[entry.name] || this.config.adhanSound.default,
        volume: this.config.adhanVolume,
      });
    }

    if (this.config.showAlert) {
      this.sendNotification("SHOW_ALERT", {
        type:    "notification",
        title:   this.translate("PRAYER_TIME_TITLE"),
        message: this.config.alertMessage || this.translate(entry.name.toUpperCase()),
        timer:   this.config.alertTimer,
        imageFA: "mosque",
      });
    }

    if (this.config.sendNotifications) {
      this.sendNotification("PRAYER_STARTED", { prayer: entry.name, time: entry.time });
    }

    if (this.config.telegram && this.config.telegram.enabled) {
      this.sendSocketNotification("PRAYER_TIME_TELEGRAM", {
        prayer:   entry.name,
        telegram: this.config.telegram,
        label:    this.translate(entry.name.toUpperCase()),
      });
    }
  },

  /* Rebuild just the compact table in-place without calling updateDom.
   * Called when allPrayersPast changes to avoid triggering MM's hide/show cycle. */
  _rebuildCompactTable () {
    const tableEl = document.getElementById(`ptp-table-${this.identifier}`);
    if (!tableEl || !tableEl.parentElement) return;
    const newTable = this._buildCompactMultiDayTable();
    tableEl.parentElement.replaceChild(newTable, tableEl);
  },

  /* Fast refresh of only the countdown element (no full DOM rebuild) */
  _refreshCountdownEl () {
    const timerEl = document.getElementById(`ptp-countdown-${this.identifier}`);
    const labelEl = document.getElementById(`ptp-countdown-label-${this.identifier}`);
    const banner  = document.getElementById(`ptp-banner-${this.identifier}`);

    // Update timer
    if (timerEl) timerEl.textContent = this.countdown;

    // Update label (next prayer name)
    if (labelEl && this.nextPrayerName) {
      labelEl.textContent = `${this.translate("NEXT")}: ${this._prayerLabel(this.nextPrayerName)}`;
    }

    // Countdown alert: animate the banner box with inverted colors
    const alert       = this.config.countdownAlert;
    const shouldAlert = alert && alert.enabled &&
                        this.countdownMins !== null &&
                        this.countdownMins <= alert.threshold &&
                        this.countdownMins > 0;

    if (banner) {
      banner.classList.forEach(cls => {
        if (cls.startsWith("ptp-anim-")) banner.classList.remove(cls);
      });
      banner.style.removeProperty("background");
      if (labelEl) labelEl.style.removeProperty("color");
      if (timerEl) timerEl.style.removeProperty("color");

      if (shouldAlert) {
        if (alert.animation) banner.classList.add(`ptp-anim-${alert.animation}`);
        banner.style.background = alert.color || "var(--ptp-accent)";
        if (labelEl) labelEl.style.color = "#fff";
        if (timerEl) timerEl.style.color = "#fff";
      }
    }

    if (this.config.showProgressBar) {
      const fillEl = document.getElementById(`ptp-progress-${this.identifier}`);
      if (fillEl) {
        fillEl.style.width = `${this._calcProgressPct()}%`;
        if (shouldAlert) fillEl.style.background = "#fff";
        else             fillEl.style.removeProperty("background");
      }
    }

    // Update next-prayer row highlight
    const rows = document.querySelectorAll(`#ptp-table-${this.identifier} .ptp-row`);
    rows.forEach(row => {
      const isNext = row.dataset.prayer === this.nextPrayerName;
      row.classList.toggle("ptp-next", isNext);
    });
  },

  /* Returns 0–100: how far we are through the current prayer window */
  _calcProgressPct () {
    if (this.prevPrayerMins === null || this.countdownMins === null) return 0;
    const nowMins      = this._nowMinsComparable();
    const windowStart  = this.prevPrayerMins;
    const windowEnd    = nowMins + this.countdownMins; // == next prayer mins
    const windowLen    = windowEnd - windowStart;
    if (windowLen <= 0) return 0;
    const elapsed = nowMins - windowStart;
    return Math.min(100, Math.max(0, (elapsed / windowLen) * 100));
  },

  /* ─────────────────────────── DOM BUILDER ───────────────────────────────── */
  getDom () {
    const wrapper = document.createElement("div");
    wrapper.className = `MMM-PrayerTimePro ptp-mode-${this.config.displayMode}`;
    if (this.config.language === "ar") wrapper.classList.add("ptp-rtl");
    if (this.config.displayMode === "compact" && this.config.showTimeDelta && !this.config.showTimeInDelta) {
      wrapper.classList.add("ptp-delta-only-mode");
    }

    if (!this.loaded && !this.error) {
      wrapper.innerHTML = `<div class="ptp-loading">${this.translate("LOADING")}</div>`;
      return wrapper;
    }

    if (this.error) {
      wrapper.innerHTML = `<div class="ptp-error">${this.error}</div>`;
      return wrapper;
    }

    if (!this.prayerData) return wrapper;

    // Header: Gregorian + Hijri date
    if (this.config.showDate || this.config.showHijriDate) {
      wrapper.appendChild(this._buildHeader());
    }

    // Next prayer + countdown
    if (this.config.showNextPrayer && this.config.showCountdown) {
      wrapper.appendChild(this._buildCountdownBanner());
    }

    // Compact mode: multi-day tabular grid
    if (this.config.displayMode === "compact" && this.multiDayData.length > 1) {
      wrapper.appendChild(this._buildCompactMultiDayTable());
      return wrapper;
    }

    // Other modes: single-day table
    wrapper.appendChild(this._buildPrayerTable("today"));

    // Tomorrow section (vertical / horizontal only)
    if (this.config.displayMode !== "compact" && this.config.showTomorrow && this.tomorrowData) {
      const tmrTitle = document.createElement("div");
      tmrTitle.className = "ptp-section-title";
      tmrTitle.textContent = this.translate("TOMORROW");
      wrapper.appendChild(tmrTitle);
      wrapper.appendChild(this._buildPrayerTable("tomorrow"));
    }

    return wrapper;
  },

  _buildHeader () {
    const el = document.createElement("div");
    el.className = "ptp-header";

    if (this.config.showDate) {
      const gDate = document.createElement("div");
      gDate.className = "ptp-gregorian-date";
      gDate.textContent = new Date().toLocaleDateString(this.config.language, {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
      el.appendChild(gDate);
    }

    if (this.config.showHijriDate && this.hijriDate) {
      const hDate = document.createElement("div");
      hDate.className = "ptp-hijri-date";
      hDate.textContent = this.hijriDate;
      el.appendChild(hDate);
    }

    return el;
  },

  _buildCountdownBanner () {
    const banner = document.createElement("div");
    banner.className = "ptp-countdown-banner";
    banner.id = `ptp-banner-${this.identifier}`;

    const label = document.createElement("span");
    label.className = "ptp-countdown-label";
    label.id = `ptp-countdown-label-${this.identifier}`;
    const nextLabel = this.nextPrayerName
      ? this._prayerLabel(this.nextPrayerName)
      : "…";
    label.textContent = `${this.translate("NEXT")}: ${nextLabel}`;

    const timer = document.createElement("span");
    timer.className = "ptp-countdown-timer";
    timer.id = `ptp-countdown-${this.identifier}`;
    timer.textContent = this.countdown;

    banner.appendChild(label);
    banner.appendChild(timer);

    if (this.config.showProgressBar) {
      const track = document.createElement("div");
      track.className = "ptp-progress-track";

      const fill = document.createElement("div");
      fill.className = "ptp-progress-fill";
      fill.id = `ptp-progress-${this.identifier}`;
      // Set initial width immediately so first render isn't 0%
      fill.style.width = `${this._calcProgressPct()}%`;

      track.appendChild(fill);
      banner.appendChild(track);
    }

    return banner;
  },

  _buildPrayerTable (day) {
    const data   = day === "tomorrow" ? this.tomorrowData : this.prayerData;
    const isToday = day === "today";

    const table = document.createElement("table");
    table.className = `ptp-table ${this.config.tableClass}`;
    table.id = isToday ? `ptp-table-${this.identifier}` : `ptp-table-tmr-${this.identifier}`;

    const nowMins  = this._nowMinsComparable();
    const todayStr = this._todayStrInTz(); // kept for iqama Date arithmetic

    for (const p of this.config.prayers) {
      if (!p.show) continue;
      const raw = data[this._apiKey(p.name)];
      if (!raw) continue;

      const pMins  = this._prayerMins(raw, p.name);
      const isPast = isToday && pMins < nowMins;
      const isNext = isToday && p.name === this.nextPrayerName;

      const row = document.createElement("tr");
      row.className = [
        "ptp-row",
        isNext ? "ptp-next" : "",
        isPast && this.config.dimPast ? "ptp-past" : "",
      ].filter(Boolean).join(" ");
      row.dataset.prayer = p.name;

      // Icon
      if (this.config.showIcon) {
        const iconCell = document.createElement("td");
        iconCell.className = "ptp-icon-cell";
        iconCell.innerHTML = this._prayerIcon(p.name);
        row.appendChild(iconCell);
      }

      // Name
      const nameCell = document.createElement("td");
      nameCell.className = "ptp-name-cell";
      nameCell.textContent = this._prayerLabel(p.name);
      row.appendChild(nameCell);

      // Time
      const timeCell = document.createElement("td");
      timeCell.className = "ptp-time-cell";
      timeCell.textContent = this._formatTime(raw);
      row.appendChild(timeCell);

      // Iqama — still uses _parseTime for display arithmetic
      if (this.config.showIqama && p.iqama > 0) {
        const iqamaCell = document.createElement("td");
        iqamaCell.className = "ptp-iqama-cell";
        const pTime     = this._parseTime(raw, todayStr, p.name);
        const iqamaTime = new Date(pTime.getTime() + p.iqama * 60000);
        iqamaCell.textContent = `+${p.iqama}m (${this._formatTime(this._timeString(iqamaTime))})`;
        row.appendChild(iqamaCell);
      }

      table.appendChild(row);
    }

    return table;
  },

  /* ── Compact multi-day tabular grid ─────────────────────────────────────
   *
   *  Layout (example: compactDays: 4, today = Wed):
   *
   *  |       | Wed      | Thu      | Fri      | Sat      |
   *  |-------|----------|----------|----------|----------|
   *  | 🌅 Fajr   | 04:32 | 04:31 | 04:30 | 04:29 |
   *  | 🌤️ Dhuhr  | 12:18 | 12:18 | 12:18 | 12:17 |
   *  | ⛅ Asr    | 16:05 | 16:06 | 16:07 | 16:08 |
   *  | 🌆 Maghrib| 20:14 | 20:15 | 20:16 | 20:17 |
   *  | 🌙 Isha   | 21:45 | 21:46 | 21:47 | 21:49 |
   */
  _buildCompactMultiDayTable () {
    const days      = this.multiDayData;
    const totalCols = Math.min(days.length, this.config.compactDays || 3);

    // After the last prayer of the day has passed, roll the window forward:
    // tomorrow becomes "Today", the day after becomes the first future column, etc.
    const startIdx    = this.allPrayersPast ? 1 : 0;
    const nowTuple    = this._nowTupleInTz();  // current date in target tz

    const visibleDays = days.slice(startIdx, startIdx + totalCols).map((d, i) => {
      if (i !== 0) return d;
      // For the first (highlighted) column, decide the label:
      // - normal mode: "Today"
      // - post-rollover, still same calendar date as device: "Tomorrow"
      // - post-rollover, calendar date has advanced past midnight: "Today"
      let label = "Today";
      if (this.allPrayersPast) {
        const colTuple = this._parseTupleFromDateString(d.date);
        const isActuallyToday = colTuple &&
          colTuple.year  === nowTuple.year &&
          colTuple.month === nowTuple.month &&
          colTuple.day   === nowTuple.day;
        label = isActuallyToday ? "Today" : this.translate("TOMORROW");
      }
      return { ...d, label };
    });
    const now        = this._nowInTz();
    const todayStr   = this._todayStrInTz();

    const table = document.createElement("table");
    table.className = `ptp-table ptp-multiday-table ${this.config.tableClass}`;
    table.id = `ptp-table-${this.identifier}`;

    // ── Header row: day labels ──────────────────────────────────────────────
    const headRow = document.createElement("tr");
    headRow.className = "ptp-multiday-head";

    // Empty cell for the prayer-name column (+ icon if enabled)
    const cornerCell = document.createElement("th");
    cornerCell.className = "ptp-multiday-corner";
    if (this.config.showIcon) cornerCell.colSpan = 2;
    headRow.appendChild(cornerCell);

    for (let i = 0; i < visibleDays.length; i++) {
      const th = document.createElement("th");
      th.className = "ptp-multiday-day-header" + (i === 0 ? " ptp-multiday-today-header" : "");
      th.textContent = visibleDays[i].label;   // "Today", "Mon", "Tue"…
      headRow.appendChild(th);
    }
    table.appendChild(headRow);

    // ── Prayer rows ─────────────────────────────────────────────────────────
    for (const p of this.config.prayers) {
      if (!p.show) continue;

      // Make sure the current "today" column has this key
      const todayRaw = visibleDays[0] && visibleDays[0].timings[this._apiKey(p.name)];
      if (!todayRaw) continue;

      const nowMins = this._nowMinsComparable();
      const isPast  = !this.allPrayersPast && this._prayerMins(todayRaw, p.name) < nowMins;
      const isNext  = p.name === this.nextPrayerName;

      const row = document.createElement("tr");
      row.className = [
        "ptp-row",
        "ptp-multiday-row",
        isNext ? "ptp-next" : "",
        isPast && this.config.dimPast ? "ptp-past" : "",
      ].filter(Boolean).join(" ");
      row.dataset.prayer = p.name;

      // Icon cell
      if (this.config.showIcon) {
        const iconCell = document.createElement("td");
        iconCell.className = "ptp-icon-cell";
        iconCell.innerHTML = this._prayerIcon(p.name);
        row.appendChild(iconCell);
      }

      // Prayer name cell
      const nameCell = document.createElement("td");
      nameCell.className = "ptp-name-cell";
      nameCell.textContent = this._prayerLabel(p.name);
      row.appendChild(nameCell);

      // One time cell per day column
      for (let i = 0; i < visibleDays.length; i++) {
        const raw = visibleDays[i].timings[this._apiKey(p.name)];
        const td  = document.createElement("td");
        const futureClass = (this.config.showTimeDelta && !this.config.showTimeInDelta)
          ? " ptp-multiday-future-col ptp-multiday-delta-only"
          : " ptp-multiday-future-col";
        td.className = "ptp-time-cell" + (i === 0 ? " ptp-multiday-today-col" : futureClass);

        if (!raw) {
          td.textContent = "—";
        } else if (i === 0) {
          // Today column: always show the full time
          td.textContent = this._formatTime(raw);
        } else if (this.config.showTimeDelta) {
          // Future columns: delta vs the *previous* day (not today)
          const prevRaw  = visibleDays[i - 1].timings[this._apiKey(p.name)];
          const deltaMin = prevRaw ? this._timeDeltaMinutes(prevRaw, raw) : 0;
          const sign     = deltaMin > 0 ? "+" : deltaMin < 0 ? "−" : "";
          const abs      = Math.abs(deltaMin);

          if (this.config.showTimeInDelta) {
            const timeSpan = document.createElement("span");
            timeSpan.className = "ptp-delta-time";
            timeSpan.textContent = this._formatTime(raw);
            td.appendChild(timeSpan);
          }

          const deltaSpan = document.createElement("span");
          deltaSpan.className = "ptp-delta-badge" +
            (deltaMin > 0 ? " ptp-delta-pos" : deltaMin < 0 ? " ptp-delta-neg" : " ptp-delta-zero");
          deltaSpan.textContent = deltaMin === 0 ? "=" : `${sign}${abs}m`;
          td.appendChild(deltaSpan);
        } else {
          td.textContent = this._formatTime(raw);
        }

        row.appendChild(td);
      }

      table.appendChild(row);
    }

    return table;
  },

  /* ─────────────────────────── HELPERS ───────────────────────────────────── */
  _apiKey (name) {
    const map = {
      imsak:     "Imsak",
      fajr:      "Fajr",
      sunrise:   "Sunrise",
      dhuhr:     "Dhuhr",
      asr:       "Asr",
      sunset:    "Sunset",
      maghrib:   "Maghrib",
      isha:      "Isha",
      midnight:  "Midnight",
      lastthird: "Lastthird",
    };
    return map[name] || name;
  },

  _prayerLabel (name) {
    const custom = this.config.prayers.find(p => p.name === name);
    if (custom && custom.label) return custom.label;
    return this.translate(name.toUpperCase());
  },

  _formatTime (raw) {
    // raw is "HH:MM" or "HH:MM (timezone)"
    const clean = raw.split(" ")[0];
    const [hh, mm] = clean.split(":").map(Number);
    if (this.config.timeFormat === 12) {
      const period = hh >= 12 ? "PM" : "AM";
      const h12   = hh % 12 || 12;
      return `${h12}:${String(mm).padStart(2, "0")} ${period}`;
    }
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  },

  /* Parse a raw API time string ("HH:MM" or "HH:MM (TZ)") anchored to a
   * given date string.
   *
   * The AlAdhan API applies tune offsets server-side and can return times
   * like "00:05" for Isha/Midnight when a positive tune shifts them past
   * midnight.  We use the prayer's natural order position to detect this:
   * prayers after Asr (index ≥ 5 in the canonical order) that come back
   * with hour < 4 have almost certainly crossed midnight.             */
  _parseTime (raw, dateStr, prayerName) {
    const clean  = raw.split(" ")[0];
    const t      = new Date(dateStr + " " + clean);
    const [h]    = clean.split(":").map(Number);
    // Only night prayers can cross midnight due to tune
    const nightPrayers = ["sunset", "maghrib", "isha", "midnight", "lastthird"];
    if (nightPrayers.includes(prayerName) && h < 4) {
      // Advance to next anchor day so ordering stays correct
      t.setDate(t.getDate() + 1);
    }
    return t;
  },

  /* Returns {year, month, day} for right now in the module's target timezone */
  _nowTupleInTz () {
    try {
      const opts = { year: "numeric", month: "numeric", day: "numeric" };
      if (this.resolvedTz && this.resolvedTz !== false) opts.timeZone = this.resolvedTz;
      const str = new Date().toLocaleString("en-US", opts);
      const [month, day, year] = str.split("/").map(Number);
      return { year, month, day };
    } catch (_) {
      const d = new Date();
      return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    }
  },

  /* Parses the date string stored in multiDayData entries back into a tuple.
   * Handles both the old toDateString() format and the new toUTCString() slice. */
  _parseTupleFromDateString (str) {
    try {
      const d = new Date(str);
      if (isNaN(d)) return null;
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
    } catch (_) {
      return null;
    }
  },

  _timeString (date) {
    return `${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
  },

  /* Returns the current wall-clock time as minutes since midnight in the
   * target timezone. Used to compare against prayer times (also HH:MM).   */
  _nowMinutesInTz () {
    try {
      const opts = { hour: "2-digit", minute: "2-digit", hour12: false };
      if (this.resolvedTz && this.resolvedTz !== false) opts.timeZone = this.resolvedTz;
      const str  = new Date().toLocaleString("en-US", opts);
      const [h, m] = str.split(":").map(Number);
      return h * 60 + (m || 0);
    } catch (_) {
      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    }
  },

  /* Converts a raw API time string "HH:MM" or "HH:MM (TZ)" to minutes since midnight */
  _rawToMins (raw) {
    const clean  = raw.split(" ")[0];
    const [h, m] = clean.split(":").map(Number);
    return h * 60 + (m || 0);
  },

  /* Returns a synthetic comparable value for a prayer time.
   * Night prayers that cross midnight (tune-shifted) get +1440 so they
   * sort after all same-day prayers. */
  _prayerMins (raw, prayerName) {
    let mins = this._rawToMins(raw);
    const nightPrayers = ["sunset", "maghrib", "isha", "midnight", "lastthird"];
    if (nightPrayers.includes(prayerName) && mins < 240) {
      mins += 1440; // past midnight — add one full day in minutes
    }
    return mins;
  },

  /* "Now" as a comparable minutes value. After midnight (0–239) we add 1440
   * so it stays greater than same-day night prayers.                         */
  _nowMinsComparable () {
    const mins = this._nowMinutesInTz();
    // If it's past midnight (small hours), shift so night prayer comparisons work
    return mins < 240 ? mins + 1440 : mins;
  },

  /* Synthetic Date used only for countdown arithmetic (diff in ms).
   * Both prayer and now use the same fixed anchor so subtraction gives
   * correct seconds remaining.                                              */
  _minsToSyntheticDate (mins) {
    // Use Jan 1 2000 + minutes. May overflow into Jan 2 for post-midnight — that's fine.
    return new Date(2000, 0, 1, Math.floor(mins / 60) % 24, mins % 60, 0);
  },

  /* Thin wrapper so existing call sites (_buildPrayerTable, _buildCompactMultiDayTable)
   * that compare pTime < now still work — they just get synthetic Dates. */
  _nowInTz () {
    return this._minsToSyntheticDate(this._nowMinsComparable());
  },

  _todayStrInTz () {
    return "Sat Jan 01 2000"; // kept for _parseTime call sites that still build Date strings
  },

  /* Returns difference in whole minutes: futureRaw − todayRaw */
  _timeDeltaMinutes (todayRaw, futureRaw) {
    const toMins = raw => {
      const clean = raw.split(" ")[0];
      const [h, m] = clean.split(":").map(Number);
      return h * 60 + m;
    };
    return toMins(futureRaw) - toMins(todayRaw);
  },

  _prayerIcon (name) {
    const icons = {
      imsak:     "fa-moon-o",
      fajr:      "fa-sun-o",
      sunrise:   "fa-arrow-up",
      dhuhr:     "fa-sun-o",
      asr:       "fa-cloud",
      sunset:    "fa-arrow-down",
      maghrib:   "fa-moon-o",
      isha:      "fa-star-o",
      midnight:  "fa-circle-o",
      lastthird: "fa-star-half-o",
    };
    const fa = icons[name] || "fa-circle";
    return `<i class="fa ${fa} ptp-icon"></i>`;
  },
});
