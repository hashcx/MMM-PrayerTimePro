# MMM-PrayerTimePro

A robust, fully customizable **MagicMirror²** module for Islamic prayer times — a major upgrade from the original MMM-PrayerTime.

---

## Features vs. Original

| Feature | MMM-PrayerTime | **MMM-PrayerTimePro** |
|---|---|---|
| AlAdhan API | v1 | ✅ v2 |
| Calculation methods | 7 | ✅ 23+ |
| Countdown to next prayer | ❌ | ✅ Live ticker |
| Progress bar for current prayer window | ❌ | ✅ |
| Iqama timers per prayer | ❌ | ✅ |
| Per-prayer custom label | ❌ | ✅ |
| Per-prayer show/hide | Partial | ✅ |
| Hijri date | ❌ | ✅ With adjustment |
| Display modes | vertical/horizontal | ✅ vertical / horizontal / compact |
| Multi-day compact grid | ❌ | ✅ Today + up to 6 future days side-by-side |
| Time delta vs today | ❌ | ✅ ±Xm change shown in future columns |
| Auto location title | ❌ | ✅ Reverse-geocoded city name from lat/lon |
| Audio players | omxplayer only | ✅ mpg123 / omxplayer / afplay / aplay |
| Offline cache | ❌ | ✅ JSON disk cache |
| Past prayer dimming | ❌ | ✅ |
| RTL language support | ❌ | ✅ |
| Languages | 3 | ✅ 7 (en, ar, id, tr, fr, de, ms) |
| Last Third of Night | ❌ | ✅ |
| Notifications to other modules | ❌ | ✅ PRAYER_STARTED |

---

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/YOUR_USERNAME/MMM-PrayerTimePro.git
cd MMM-PrayerTimePro
# No npm install needed — zero runtime dependencies!
```

### Audio files (optional)

Place your `.mp3` adhan files in `modules/MMM-PrayerTimePro/sounds/`:

```
sounds/
  adhan.mp3        ← default for all prayers
  adhan_fajr.mp3   ← override for Fajr only
```

Requires one of: `mpg123`, `omxplayer`, `afplay` (macOS), or `aplay`.

---

## Quick Start

Add to `config/config.js`:

```js
{
  module: "MMM-PrayerTimePro",
  position: "top_left",
  config: {
    lat: 51.5074,
    lon: -0.1278,
    timezone: "Europe/London",
    method: 15,       // Muslim World League
    timeFormat: 24,
  }
}
```

---

## Full Configuration Reference

```js
{
  module: "MMM-PrayerTimePro",
  position: "top_left",
  config: {

    // ── Location (REQUIRED) ───────────────────────────────────────────────
    lat: 51.5074,
    lon: -0.1278,
    timezone: "Europe/London",  // false = auto-detect from lat/lon

    // ── Time display ──────────────────────────────────────────────────────
    timeFormat: 24,             // 12 or 24
    showSeconds: false,

    // ── Calculation method ────────────────────────────────────────────────
    // See https://aladhan.com/calculation-methods for full list
    method: 2,                  // 2 = ISNA (North America)
    school: 0,                  // 0 = Shafi, 1 = Hanafi
    midnightMode: 0,            // 0 = Standard, 1 = Jafari
    latitudeAdjustmentMethod: 3,// 1=MiddleOfNight, 2=OneSeventh, 3=AngleBased

    // Custom method (method must be 99):
    // methodSettings: "18,null,17",  // FajrAngle,MaghribType,IshaAngle

    // Fine-tune all times (minutes offset):
    // tune: "0,2,0,0,0,0,0,0,0",    // Imsak,Fajr,Sunrise,Dhuhr,Asr,Sunset,Maghrib,Isha,Midnight

    // ── Hijri date ────────────────────────────────────────────────────────
    showHijriDate: true,        // false = hide Hijri date entirely
    hijriAdjustment: 0,         // ±N days to adjust

    // ── Prayer display ────────────────────────────────────────────────────
    // Full per-prayer control: show, custom label, adhan, iqama (minutes)
    prayers: [
      { name: "imsak",     label: null,    show: true,  adhan: false, iqama: 0  },
      { name: "fajr",      label: null,    show: true,  adhan: true,  iqama: 20 },
      { name: "sunrise",   label: null,    show: true,  adhan: false, iqama: 0  },
      { name: "dhuhr",     label: null,    show: true,  adhan: true,  iqama: 15 },
      { name: "asr",       label: null,    show: true,  adhan: true,  iqama: 15 },
      { name: "sunset",    label: null,    show: false, adhan: false, iqama: 0  },
      { name: "maghrib",   label: null,    show: true,  adhan: true,  iqama: 5  },
      { name: "isha",      label: null,    show: true,  adhan: true,  iqama: 15 },
      { name: "midnight",  label: null,    show: false, adhan: false, iqama: 0  },
      { name: "lastthird", label: null,    show: false, adhan: false, iqama: 0  },
    ],

    // ── Layout ────────────────────────────────────────────────────────────
    displayMode: "vertical",    // "vertical" | "horizontal" | "compact"
    showNextPrayer: true,
    showCountdown: true,        // live countdown to next prayer
    showIqama: true,            // show iqama time below adhan
    showDate: true,
    showTomorrow: true,         // (vertical/horizontal only) show tomorrow section
    showIcon: true,
    tableClass: "small",        // "xsmall" | "small" | "medium" | "large"

    // ── Compact multi-day grid ────────────────────────────────────────────
    // Only applies when displayMode === "compact"
    compactDays: 3,             // total day columns shown: today + N future days (1–7)
    showTimeDelta: true,        // show ±Xm change vs today in future columns
    showTimeInDelta: true,      // also show the time alongside the badge (false = badge only)

    // ── Module title (standard MM title bar) ─────────────────────────────
    autoTitle: false,           // true = reverse-geocode lat/lon → city name as title
    titlePrefix: "",            // static prefix, or full title when autoTitle is false

    // ── Adhan audio ───────────────────────────────────────────────────────
    playAdhan: true,
    adhanSound: {
      fajr:    "adhan_fajr.mp3",   // sounds/ dir or absolute path
      default: "adhan.mp3",
    },
    adhanVolume: 80,

    // ── Alerts ────────────────────────────────────────────────────────────
    showAlert: true,
    alertTimer: 15000,          // ms
    alertMessage: null,         // null = auto from language

    // ── Cross-module notifications ────────────────────────────────────────
    // Other modules can listen for "PRAYER_STARTED" with payload {prayer, time}
    sendNotifications: true,

    // ── Telegram (optional) ───────────────────────────────────────────────
    telegram: {
      enabled: false,
      botToken: "YOUR_BOT_TOKEN",
      chatIds: ["123456789"],
    },

    // ── Countdown alert ───────────────────────────────────────────────────
    // Animate the Next prayer banner when time is running out.
    countdownAlert: {
      enabled:      true,
      threshold:    30,         // minutes remaining to trigger
      animation:    "pulse",    // "pulse" | "glow" | "shake" | "bounce" | null
      color:        null,       // null = keep accent color, or e.g. "#ff4d4d"
      invertColors: false,      // true = solid color background, white text
    },

    // ── Progress bar ──────────────────────────────────────────────────────
    // A thin bar inside the countdown banner showing elapsed time through
    // the current prayer window (from the last prayer up to the next).
    showProgressBar: false,     // true = show the bar

    // ── Updates ───────────────────────────────────────────────────────────
    useUpdateInterval: true,
    updateInterval: 86400 * 1000,  // daily
    animationSpeed: 2500,

    // ── Language ──────────────────────────────────────────────────────────
    language: config.language,  // en, ar, id, tr, fr, de, ms

    // ── Appearance ────────────────────────────────────────────────────────
    colored: true,
    accentColor: "#40bfff",
    dimPast: true,
  }
}
```

---

## Display Modes

### `vertical` (default)
Prayers listed top-to-bottom in a single column. A separate "Tomorrow" section appears below when `showTomorrow: true`.

### `horizontal`
Prayers displayed as a row of cards side by side — good for wide mirror regions like `bottom_bar`.

### `compact` — Multi-Day Grid
Prayers are rows; days are columns. Today is always the first day column, followed by future days up to `compactDays` total. This is the most space-efficient way to show a week-at-a-glance.

With `showTimeDelta: true` (default), future columns show the time plus a colour-coded badge indicating how much that prayer shifts relative to today — green for earlier, orange for later:

```
        Today   Mon      Tue      Wed      Thu
🌅 Fajr   04:32  04:31   04:30   04:29   04:28
                 −1m     −2m     −3m     −4m
⛅ Asr    16:05  16:06   16:07   16:08   16:09
                 +1m     +2m     +3m     +4m
```

Config to enable it:

```js
{
  module: "MMM-PrayerTimePro",
  position: "top_left",
  config: {
    lat: 51.5074,
    lon: -0.1278,
    timezone: "Europe/London",
    displayMode: "compact",
    compactDays: 5,          // today + 4 future days
    showTimeDelta: true,     // ±Xm badges (default: true)
    autoTitle: true,         // show "London" above the table
    titlePrefix: "🕌",       // optional: "🕌 London"
  }
}
```

**Notes:**
- `compactDays` accepts values from `1` to `7`. All days are fetched in parallel at startup.
- `showTimeDelta: false` hides the badges and shows only the time in future columns.
- `showTimeInDelta: false` shows only the badge with no time, useful for very narrow layouts.
- `showTomorrow` has no effect in compact mode — future days are already shown as columns.
- The next prayer row is highlighted with the accent colour in the today column.
- Past prayers in today's column are dimmed when `dimPast: true`.
- All days are cached to disk so the grid survives a temporary internet outage.

---

## Auto Location Title

The module uses MagicMirror's standard `getHeader()` mechanism, so the title appears in the module's native title bar — consistent with every other MM module.

Three ways to control it:

| Config | Result |
|---|---|
| `autoTitle: false` (default), no `titlePrefix` | No title bar shown |
| `autoTitle: false`, `titlePrefix: "Prayer Times"` | Static title: `Prayer Times` |
| `autoTitle: true` | Reverse-geocoded city name: e.g. `London` |
| `autoTitle: true`, `titlePrefix: "🕌"` | Prefix + city: `🕌 London` |

The geocode uses the free [Nominatim](https://nominatim.openstreetmap.org) API (no key required). The lookup runs once at startup; the title bar appears as soon as the city name resolves. If the request fails the title bar is simply omitted.

```js
autoTitle: true,       // reverse-geocode lat/lon → city name
titlePrefix: "🕌",    // optional static prefix before the city name
```

---

## Calculation Methods

| ID | Name |
|---|---|
| 0 | Shia Ithna-Ashari |
| 1 | University of Islamic Sciences, Karachi |
| 2 | Islamic Society of North America (ISNA) |
| 3 | Muslim World League (MWL) |
| 4 | Umm al-Qura, Makkah |
| 5 | Egyptian General Authority of Survey |
| 7 | Institute of Geophysics, University of Tehran |
| 8 | Gulf Region |
| 9 | Kuwait |
| 10 | Qatar |
| 11 | Majlis Ugama Islam Singapura (MUIS) |
| 12 | Union Organization Islamic de France |
| 13 | Diyanet İşleri Başkanlığı, Turkey |
| 14 | Spiritual Administration of Muslims of Russia |
| 15 | Moonsighting Committee Worldwide |
| 16 | Dubai (unofficial) |
| 17 | Jabatan Kemajuan Islam Malaysia (JAKIM) |
| 18 | Tunisia |
| 19 | Algeria |
| 20 | KEMENAG, Indonesia |
| 21 | Morocco |
| 22 | Comunidade Islamica de Lisboa |
| 23 | Ministry of Awqaf, Islamic Affairs and Holy Places, Jordan |
| 99 | Custom (use `methodSettings`) |

---

## MMM-ModuleScheduler Integration

If `useUpdateInterval: false`, add to MMM-ModuleScheduler config:

```js
{ notification: "PRAYER_TIME", schedule: "1 0 * * *", payload: { type: "UPDATE_PRAYINGTIME" } }
```

---

## Cross-Module Notifications

**Sent by this module:**
- `PRAYER_STARTED` → `{ prayer: "fajr", time: Date }`

**Received:**
- `PRAYER_TIME` with payload `{ type: "UPDATE_PRAYINGTIME" }` — triggers a refresh

---

## Progress Bar

When `showProgressBar: true`, a slim 3 px bar appears at the bottom of the countdown banner. It fills left-to-right from 0 % (when the previous prayer just began) to 100 % (when the next prayer is due), giving an at-a-glance sense of where you are in the current prayer window.

```js
showProgressBar: true,
```

The bar inherits `accentColor` by default. When `countdownAlert` is active and a custom `color` is set, the bar automatically switches to that alert color to stay visually consistent with the banner.

```css
/* Override the bar color independently in custom.css */
.ptp-progress-fill {
  background: #c8a96e;   /* e.g. gold for Ramadan theme */
}
```

---

## Countdown Alert

When `countdownAlert` is enabled, the **Next prayer banner** animates as the prayer approaches. The animation activates when `countdownMins ≤ threshold` and stops automatically once the prayer time passes.

```js
countdownAlert: {
  enabled:      true,
  threshold:    30,          // trigger when ≤ 30 minutes remain
  animation:    "pulse",
  color:        "#ff4d4d",
  invertColors: true,
},
```

### Animation options

| Value | Effect |
|---|---|
| `"pulse"` | Banner fades in and out gently |
| `"glow"` | Border and shadow breathe in the alert color |
| `"shake"` | Horizontal jitter |
| `"bounce"` | Gentle vertical hop |
| `null` | No animation (color/invert still apply) |

### Color & invert combinations

| `color` | `invertColors` | Result |
|---|---|---|
| `null` | `false` | Animation only, no color change |
| `null` | `true` | Inverted using accent color |
| `"#ff4d4d"` | `false` | Red border + red text on banner |
| `"#ff4d4d"` | `true` | Solid red background + white text |

---

## CSS Customization

Override any variable in your `custom.css`:

```css
.MMM-PrayerTimePro {
  --ptp-accent:        #c8a96e;   /* gold for Ramadan theme */
  --ptp-past-opacity:  0.3;
  --ptp-next-bg:       rgba(200, 169, 110, 0.15);
  --ptp-next-border:   #c8a96e;
}
```

---

## License

MIT © MMM-PrayerTimePro contributors
