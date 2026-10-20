// THE NIGHT SKY (v1.07). Looking up, KURA sees the real sky over the player: the real stars where they are right now,
// and the moon where she really is, at her real phase. Where the player is comes from the run's timezone (no prompt,
// no permission): a table of common zones, or a guess from the zone's own UTC offset. It is worked out fresh on every
// redraw (about a quarter of a millisecond) and the page redraws it once a minute while she looks up, so the sky
// really turns. The top of the box is the way KURA faces. Star data: the d3-celestial catalog (BSD license, Olaf
// Frohn), the stars down to magnitude 3.8.
(function (root) {
  // Named bright stars: [name, RA hours, Dec, magnitude, pastel color for the guide]. On the map they're drawn a
  // little stronger (see strong) and glow.
  const NAMED = [["Sirius", 6.752, -16.72, -1.46, "#cfe6ff"], ["Canopus", 6.399, -52.7, -0.74, "#f3ecd2"], ["Arcturus", 14.261, 19.18, -0.05, "#ffd9a8"], ["Rigil Kent", 14.66, -60.83, -0.27, "#fff1c9"], ["Vega", 18.616, 38.78, 0.03, "#d9d4ff"], ["Capella", 5.278, 46.0, 0.08, "#fff0c2"], ["Rigel", 5.242, -8.2, 0.13, "#c8dcff"], ["Procyon", 7.655, 5.22, 0.34, "#fff6d6"], ["Achernar", 1.629, -57.24, 0.46, "#c4ecf2"], ["Betelgeuse", 5.919, 7.41, 0.5, "#ffc4c0"], ["Hadar", 14.064, -60.37, 0.61, "#d5e4ff"], ["Altair", 19.846, 8.87, 0.76, "#cdf2ee"], ["Acrux", 12.443, -63.1, 0.77, "#d2e2ff"], ["Aldebaran", 4.599, 16.51, 0.86, "#ffd0b0"], ["Antares", 16.49, -26.43, 0.96, "#ffb8b8"], ["Spica", 13.42, -11.16, 0.97, "#d4f5dc"], ["Pollux", 7.755, 28.03, 1.14, "#ffe0b8"], ["Fomalhaut", 22.961, -29.62, 1.16, "#c6f0dc"], ["Deneb", 20.69, 45.28, 1.25, "#efe2ff"], ["Mimosa", 12.795, -59.69, 1.25, "#d7e6ff"], ["Regulus", 10.139, 11.97, 1.35, "#fdf3b8"]];
  // The rest, dimmer and further: [RA hours, Dec, magnitude].
  const CAT = [[0.14, 29.09, 2.1], [0.153, 59.15, 2.3], [0.221, 15.18, 2.8], [0.324, -8.82, 3.6], [0.429, -77.25, 2.8], [0.438, -42.31, 2.4], [0.616, 53.9, 3.7], [0.655, 30.86, 3.3], [0.675, 56.54, 2.2], [0.726, -17.99, 2], [0.818, 57.82, 3.5], [0.945, 60.72, 2.1], [1.101, -46.72, 3.3], [1.143, -10.18, 3.5], [1.162, 35.62, 2.1], [1.4, -8.18, 3.6], [1.43, 60.24, 2.7], [1.473, -43.32, 3.4], [1.525, 15.35, 3.6], [1.633, 48.63, 3.6], [1.734, -15.94, 3.5], [1.858, -10.34, 3.7], [1.885, 29.58, 3.4], [1.907, 63.67, 3.4], [1.911, 20.81, 2.6], [1.933, -51.61, 3.7], [1.979, -61.57, 2.9], [2.065, 42.33, 2.1], [2.12, 23.46, 2], [2.159, 34.99, 3], [2.275, -51.51, 3.6], [2.53, 89.26, 2], [2.722, 3.24, 3.5], [2.833, 27.26, 3.6], [2.845, 55.9, 3.8], [2.971, -40.3, 2.9], [3.038, 4.09, 2.5], [3.08, 53.51, 2.9], [3.086, 38.84, 3.3], [3.136, 40.96, 2.1], [3.158, 44.86, 3.8], [3.325, -21.76, 3.7], [3.405, 49.86, 1.8], [3.414, 9.03, 3.6], [3.453, 9.73, 3.7], [3.549, -9.46, 3.7], [3.715, 47.79, 3], [3.721, -9.76, 3.5], [3.748, 24.11, 3.7], [3.753, 42.58, 3.8], [3.787, -74.24, 3.3], [3.791, 24.11, 2.9], [3.819, 24.05, 3.6], [3.902, 31.88, 2.8], [3.964, 40.01, 2.9], [3.967, -13.51, 3], [4.011, 12.49, 3.4], [4.24, -62.47, 3.3], [4.298, -33.8, 3.5], [4.33, 15.63, 3.6], [4.382, 17.54, 3.8], [4.477, 19.18, 3.5], [4.478, 15.87, 3.4], [4.567, -55.05, 3.3], [4.831, 6.96, 3.2], [4.853, 5.61, 3.7], [4.904, 2.44, 3.7], [4.95, 33.17, 2.7], [5.033, 43.82, 3], [5.041, 41.08, 3.7], [5.091, -22.37, 3.2], [5.109, 41.23, 3.2], [5.131, -5.09, 2.8], [5.216, -16.21, 3.3], [5.293, -6.84, 3.6], [5.408, -2.4, 3.4], [5.419, 6.35, 1.6], [5.438, 28.61, 1.6], [5.471, -20.76, 2.8], [5.533, -0.3, 2.3], [5.546, -17.82, 2.6], [5.56, -62.49, 3.8], [5.586, 9.93, 3.4], [5.591, -5.91, 2.8], [5.604, -1.2, 1.7], [5.627, 21.14, 3], [5.646, -2.6, 3.8], [5.661, -34.07, 2.6], [5.679, -1.94, 1.7], [5.741, -22.45, 3.6], [5.783, -14.82, 3.5], [5.796, -9.67, 2.1], [5.849, -35.77, 3.1], [5.855, -20.88, 3.8], [5.94, -14.17, 3.7], [5.992, 54.28, 3.7], [5.992, 44.95, 1.9], [5.995, 37.21, 2.6], [6.248, 22.51, 3.3], [6.339, -30.06, 3], [6.378, -17.96, 2], [6.383, 22.51, 2.9], [6.48, -7.03, 3.8], [6.629, 16.4, 1.9], [6.629, -43.2, 3.2], [6.732, 25.13, 3.1], [6.755, 12.9, 3.4], [6.803, -61.94, 3.2], [6.831, -32.51, 3.5], [6.832, -50.61, 2.9], [6.88, 33.96, 3.6], [7.029, -27.93, 3.5], [7.05, -23.83, 3], [7.14, -26.39, 1.8], [7.146, -70.5, 3.8], [7.286, -37.1, 2.7], [7.302, 16.54, 3.6], [7.335, 21.98, 3.5], [7.402, -29.3, 2.5], [7.429, 27.8, 3.8], [7.453, 8.29, 2.9], [7.487, -43.3, 3.3], [7.577, 31.89, 1.6], [7.741, 24.4, 3.6], [7.754, -37.97, 3.6], [7.822, -24.86, 3.3], [7.87, -40.58, 3.7], [7.946, -52.98, 3.5], [8.06, -40, 2.2], [8.126, -24.3, 2.8], [8.159, -47.34, 1.8], [8.275, 9.19, 3.5], [8.375, -59.51, 1.9], [8.429, -66.14, 3.8], [8.504, 60.72, 3.4], [8.672, -52.92, 3.6], [8.677, -46.65, 3.8], [8.727, -33.19, 3.7], [8.745, -54.71, 1.9], [8.78, 6.42, 3.4], [8.923, 5.95, 3.1], [8.987, 48.04, 3.1], [9.06, 47.16, 3.6], [9.069, -47.1, 3.8], [9.133, -43.43, 2.2], [9.183, -58.97, 3.4], [9.22, -69.72, 1.7], [9.285, -59.28, 2.2], [9.351, 34.39, 3.1], [9.369, -55.01, 2.5], [9.46, -8.66, 2], [9.512, -40.47, 3.6], [9.52, -57.03, 3.2], [9.525, 63.06, 3.6], [9.548, 51.68, 3.2], [9.686, 9.89, 3.5], [9.754, -62.51, 3.7], [9.764, 23.77, 3], [9.785, -65.07, 2.9], [9.85, 59.04, 3.8], [9.948, -54.57, 3.5], [10.122, 16.76, 3.5], [10.176, -12.35, 3.6], [10.229, -70.04, 3.3], [10.278, 23.42, 3.4], [10.285, -61.33, 3.4], [10.285, 42.91, 3.5], [10.333, 19.84, 2], [10.372, 41.5, 3.1], [10.534, -61.69, 3.3], [10.716, -64.39, 2.7], [10.779, -49.42, 2.7], [10.827, -16.19, 3.1], [10.889, 34.21, 3.8], [10.892, -58.85, 3.8], [11.031, 56.38, 2.3], [11.062, 61.75, 1.8], [11.161, 44.5, 3], [11.235, 20.52, 2.6], [11.237, 15.43, 3.3], [11.303, 31.53, 3.8], [11.308, 33.09, 3.5], [11.322, -14.78, 3.6], [11.55, -31.86, 3.5], [11.596, -63.02, 3.1], [11.76, -66.73, 3.6], [11.768, 47.78, 3.7], [11.818, 14.57, 2.1], [11.845, 1.76, 3.6], [11.897, 53.69, 2.4], [12.139, -50.72, 2.6], [12.169, -22.62, 3], [12.252, -58.75, 2.8], [12.257, 57.03, 3.3], [12.263, -17.54, 2.6], [12.356, -60.4, 3.6], [12.498, -16.52, 2.9], [12.519, -57.11, 1.6], [12.573, -23.4, 2.6], [12.62, -69.14, 2.7], [12.692, -48.96, 2.2], [12.694, -1.45, 2.7], [12.771, -68.11, 3], [12.9, 55.96, 1.8], [12.927, 3.4, 3.4], [12.934, 38.32, 2.9], [13.036, 10.96, 2.9], [13.038, -71.55, 3.6], [13.315, -23.17, 3], [13.343, -36.71, 2.8], [13.399, 54.93, 2.2], [13.578, -0.6, 3.4], [13.665, -53.47, 2.3], [13.792, 49.31, 1.9], [13.825, -41.69, 3.4], [13.827, -42.47, 3.5], [13.911, 18.4, 2.7], [13.926, -47.29, 2.5], [14.073, 64.38, 3.7], [14.106, -26.68, 3.3], [14.111, -36.37, 2.1], [14.323, -46.06, 3.5], [14.53, 30.37, 3.6], [14.535, 38.31, 3], [14.592, -42.16, 2.3], [14.686, 13.73, 3.8], [14.699, -47.39, 2.3], [14.708, -64.98, 3.2], [14.75, 27.07, 2.4], [14.771, 1.89, 3.7], [14.845, 74.16, 2.1], [14.848, -16.04, 2.8], [14.976, -43.13, 2.7], [14.986, -42.1, 3.1], [15.032, 40.39, 3.5], [15.068, -25.28, 3.3], [15.205, -52.1, 3.4], [15.258, 33.31, 3.5], [15.283, -9.38, 2.6], [15.315, -68.68, 2.9], [15.345, 71.83, 3], [15.356, -40.65, 3.2], [15.363, -36.26, 3.6], [15.378, -44.69, 3.4], [15.415, 58.97, 3.3], [15.464, 29.11, 3.7], [15.578, 26.71, 2.2], [15.586, -41.17, 2.8], [15.617, -28.14, 3.6], [15.644, -29.78, 3.7], [15.738, 6.43, 2.6], [15.77, 15.42, 3.6], [15.827, -3.43, 3.5], [15.847, 4.48, 3.7], [15.919, -63.43, 2.8], [15.981, -26.11, 2.9], [16.002, -38.4, 3.4], [16.006, -22.62, 2.3], [16.091, -19.81, 2.6], [16.239, -3.69, 2.7], [16.305, -4.69, 3.2], [16.353, -25.59, 2.9], [16.365, 19.15, 3.7], [16.4, 61.51, 2.7], [16.504, 21.49, 2.8], [16.598, -28.22, 2.8], [16.619, -10.57, 2.5], [16.688, 31.6, 2.8], [16.715, 38.92, 3.5], [16.811, -69.03, 1.9], [16.83, -59.04, 3.8], [16.836, -34.29, 2.3], [16.865, -38.05, 3], [16.872, -38.02, 3.6], [16.91, -42.36, 3.6], [16.961, 9.38, 3.2], [16.977, -55.99, 3.1], [17.146, 65.71, 3.2], [17.173, -15.72, 2.4], [17.203, -43.24, 3.3], [17.244, 14.39, 2.8], [17.251, 24.84, 3.1], [17.251, 36.81, 3.2], [17.367, -25, 3.3], [17.422, -55.53, 2.8], [17.423, -56.38, 3.3], [17.507, 52.3, 2.8], [17.513, -37.3, 2.7], [17.518, -60.68, 3.6], [17.531, -49.88, 2.8], [17.56, -37.1, 1.6], [17.582, 12.56, 2.1], [17.622, -43, 1.9], [17.626, -15.4, 3.5], [17.708, -39.03, 2.4], [17.725, 4.57, 2.8], [17.762, -64.72, 3.6], [17.774, 27.72, 3.4], [17.793, -40.13, 3], [17.798, 2.71, 3.8], [17.831, -37.04, 3.2], [17.892, 56.87, 3.7], [17.943, 51.49, 2.2], [17.963, 29.25, 3.7], [17.984, -9.77, 3.3], [18.097, -30.42, 3], [18.111, -50.09, 3.6], [18.122, 9.56, 3.7], [18.294, -36.76, 3.1], [18.35, -29.83, 2.7], [18.351, 72.73, 3.5], [18.355, -2.9, 3.2], [18.403, -34.38, 1.8], [18.45, -45.97, 3.5], [18.466, -25.42, 2.8], [18.761, -26.99, 3.2], [18.835, 33.36, 3.5], [18.921, -26.3, 2], [18.962, -21.11, 3.5], [18.982, 32.69, 3.3], [19.044, -29.88, 2.6], [19.078, -21.74, 3.8], [19.09, 13.86, 3], [19.104, -4.88, 3.4], [19.116, -27.67, 3.3], [19.163, -21.02, 2.9], [19.209, 67.66, 3.1], [19.425, 3.11, 3.4], [19.495, 51.73, 3.8], [19.512, 27.96, 3], [19.75, 45.13, 2.9], [19.771, 10.61, 2.7], [19.79, 18.53, 3.7], [19.922, 6.41, 3.7], [19.979, 19.49, 3.5], [20.145, -66.18, 3.5], [20.188, -0.82, 3.2], [20.301, -12.54, 3.6], [20.35, -14.78, 3], [20.37, 40.26, 2.2], [20.427, -56.74, 1.9], [20.626, 14.6, 3.6], [20.626, -47.29, 3.1], [20.661, 15.91, 3.8], [20.749, -66.2, 3.4], [20.755, 61.84, 3.4], [20.77, 33.97, 2.5], [20.795, -9.5, 3.8], [20.913, -58.45, 3.7], [21.082, 43.93, 3.7], [21.216, 30.23, 3.2], [21.247, 38.05, 3.7], [21.31, 62.59, 2.5], [21.444, -22.41, 3.8], [21.478, 70.56, 3.2], [21.526, -5.57, 2.9], [21.668, -16.66, 3.7], [21.691, -77.39, 3.7], [21.736, 9.88, 2.4], [21.784, -16.13, 2.9], [21.899, -37.36, 3], [22.096, -0.32, 3], [22.117, 25.35, 3.8], [22.137, -46.96, 1.7], [22.17, 6.2, 3.5], [22.181, 58.2, 3.4], [22.308, -60.26, 2.9], [22.481, -0.02, 3.6], [22.522, 50.28, 3.8], [22.691, 10.83, 3.4], [22.711, -46.88, 2.1], [22.717, 30.22, 2.9], [22.809, -51.32, 3.5], [22.828, 66.2, 3.5], [22.833, 24.6, 3.5], [22.877, -7.58, 3.7], [22.911, -15.82, 3.3], [23.032, 42.33, 3.6], [23.063, 28.08, 2.4], [23.079, 15.21, 2.5], [23.157, -21.17, 3.7], [23.286, 3.28, 3.7], [23.656, 77.63, 3.2]];
  // Where in the world (latitude, longitude), by timezone.
  const PLACES = {
    "Pacific/Honolulu": [21.31, -157.86], "America/Anchorage": [61.22, -149.9], "America/Los_Angeles": [34.05, -118.24], "America/Vancouver": [49.28, -123.12],
    "America/Phoenix": [33.45, -112.07], "America/Denver": [39.74, -104.99], "America/Chicago": [41.88, -87.63], "America/Mexico_City": [19.43, -99.13],
    "America/New_York": [40.71, -74.01], "America/Toronto": [43.65, -79.38], "America/Halifax": [44.65, -63.57], "America/Puerto_Rico": [18.47, -66.11],
    "America/Bogota": [4.71, -74.07], "America/Lima": [-12.05, -77.04], "America/Santiago": [-33.45, -70.67], "America/Argentina/Buenos_Aires": [-34.6, -58.38],
    "America/Sao_Paulo": [-23.55, -46.63], "Atlantic/Reykjavik": [64.15, -21.94], "Europe/London": [51.51, -0.13], "Europe/Dublin": [53.35, -6.26],
    "Europe/Lisbon": [38.72, -9.14], "Europe/Madrid": [40.42, -3.7], "Europe/Paris": [48.86, 2.35], "Europe/Brussels": [50.85, 4.35],
    "Europe/Amsterdam": [52.37, 4.9], "Europe/Berlin": [52.52, 13.4], "Europe/Rome": [41.9, 12.5], "Europe/Zurich": [47.38, 8.54],
    "Europe/Stockholm": [59.33, 18.07], "Europe/Oslo": [59.91, 10.75], "Europe/Copenhagen": [55.68, 12.57], "Europe/Warsaw": [52.23, 21.01],
    "Europe/Prague": [50.08, 14.44], "Europe/Vienna": [48.21, 16.37], "Europe/Helsinki": [60.17, 24.94], "Europe/Athens": [37.98, 23.73],
    "Europe/Istanbul": [41.01, 28.98], "Europe/Kiev": [50.45, 30.52], "Europe/Kyiv": [50.45, 30.52], "Europe/Moscow": [55.76, 37.62],
    "Africa/Cairo": [30.04, 31.24], "Africa/Lagos": [6.52, 3.38], "Africa/Nairobi": [-1.29, 36.82], "Africa/Johannesburg": [-26.2, 28.05],
    "Asia/Dubai": [25.2, 55.27], "Asia/Tehran": [35.69, 51.39], "Asia/Karachi": [24.86, 67.0], "Asia/Kolkata": [22.57, 88.36], "Asia/Calcutta": [22.57, 88.36],
    "Asia/Dhaka": [23.81, 90.41], "Asia/Bangkok": [13.76, 100.5], "Asia/Jakarta": [-6.2, 106.85], "Asia/Ho_Chi_Minh": [10.82, 106.63],
    "Asia/Singapore": [1.35, 103.82], "Asia/Kuala_Lumpur": [3.14, 101.69], "Asia/Manila": [14.6, 120.98], "Asia/Hong_Kong": [22.32, 114.17],
    "Asia/Shanghai": [31.23, 121.47], "Asia/Taipei": [25.03, 121.57], "Asia/Seoul": [37.57, 126.98], "Asia/Tokyo": [35.68, 139.69],
    "Australia/Perth": [-31.95, 115.86], "Australia/Adelaide": [-34.93, 138.6], "Australia/Brisbane": [-27.47, 153.03], "Australia/Sydney": [-33.87, 151.21],
    "Australia/Melbourne": [-37.81, 144.96], "Pacific/Auckland": [-36.85, 174.76], "Pacific/Guam": [13.44, 144.79], "Pacific/Fiji": [-18.14, 178.44],
  };
  const SOUTH = /^(Australia|Antarctica)\/|^Pacific\/(Auckland|Fiji|Tongatapu|Apia|Noumea|Efate)|^America\/(Argentina|Sao_Paulo|Santiago|Montevideo|Asuncion|La_Paz|Lima)|^Africa\/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Luanda)/;
  function place(tz, date) {
    if (PLACES[tz]) return { lat: PLACES[tz][0], lon: PLACES[tz][1], city: city(tz) };
    let off = 0;
    try { const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(date).find(x => x.type === "timeZoneName");
      const m = p && /GMT([+-]\d+)(?::(\d+))?/.exec(p.value); if (m) off = Number(m[1]) + Math.sign(Number(m[1])) * Number(m[2] || 0) / 60; } catch (e) {}
    return { lat: SOUTH.test(tz || "") ? -33 : 35, lon: off * 15, city: city(tz) };
  }
  const city = tz => String(tz || "Pacific/Honolulu").split("/").pop().replace(/_/g, " ");
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI, wrap = d => ((d % 360) + 360) % 360;
  const days = date => date.getTime() / 86400000 + 2440587.5 - 2451545;
  function altAz(raDeg, decDeg, date, lat, lon) {
    const lst = wrap(280.46061837 + 360.98564736629 * days(date) + lon), H = rad(wrap(lst - raDeg)), dec = rad(decDeg), la = rad(lat);
    const alt = Math.asin(Math.sin(dec) * Math.sin(la) + Math.cos(dec) * Math.cos(la) * Math.cos(H));
    const az = Math.atan2(-Math.sin(H) * Math.cos(dec), Math.sin(dec) * Math.cos(la) - Math.cos(dec) * Math.sin(la) * Math.cos(H));
    return { alt: deg(alt), az: wrap(deg(az)) };
  }
  function moonRaDec(date) {
    const d = days(date), L = rad(218.316 + 13.176396 * d), M = rad(134.963 + 13.064993 * d), F = rad(93.272 + 13.229350 * d);
    const lon = L + rad(6.289) * Math.sin(M), lat = rad(5.128) * Math.sin(F), e = rad(23.44);
    return { ra: wrap(deg(Math.atan2(Math.sin(lon) * Math.cos(e) - Math.tan(lat) * Math.sin(e), Math.cos(lon)))),
      dec: deg(Math.asin(Math.sin(lat) * Math.cos(e) + Math.cos(lat) * Math.sin(e) * Math.sin(lon))) };
  }
  function sunRaDec(date) {
    const d = days(date), g = rad(357.529 + 0.98560028 * d), L = rad(280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)), e = rad(23.439);
    return { ra: wrap(deg(Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)))), dec: deg(Math.asin(Math.sin(e) * Math.sin(L))) };
  }
  // A little stronger than the guide's pastel, for the star itself on the map.
  const strong = hex => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255], mx = Math.max(...c);
    return "#" + c.map(v => Math.min(255, Math.round(255 - (255 - v) * 1.6 + (255 - mx))).toString(16).padStart(2, "0")).join(""); };
  // Where the moon is for this player right now: up, or below the horizon (and which way she's going).
  function moonPos(date, tz) {
    const p = place(tz, date), m = moonRaDec(date), h = altAz(m.ra, m.dec, date, p.lat, p.lon);
    return { alt: h.alt, az: h.az, up: h.alt > 0, rising: h.az < 180 };
  }
  // THE SKY (v1.08): 47 by 15, edge to edge with no box, above the turn controls. Rows 0-11 are sky, row 12 a faint dotted
  // rule, rows 13-14 the key. The way KURA faces is shown in the turn controls, not on the sky.
  // Returns the rows and, for the page, the colored cells, the guide's colored names, and the time stamp.
  function render(date, tz, facing, moonIdx) {
    const VW = 47, ROWS = 15, c = Array.from({ length: ROWS }, () => Array(VW).fill(" ")), rank = Array.from({ length: ROWS }, () => Array(VW).fill(99));
    const color = {}, p = place(tz, date);
    const put = (x, y, ch, m, col) => { if (m < rank[y][x]) { c[y][x] = ch; rank[y][x] = m; if (col) color[y + "," + x] = col; else delete color[y + "," + x]; } };
    // (The horizon circle is drawn a little bigger than the box, so the corners have sky too; the low edges at the sides are cropped.)
    const cx = 23, cy = 6, rx = 23 * 1.3, ry = 6.5 * 1.3, rot = { N: 0, E: 90, S: 180, W: 270 }[facing] || 0;
    const at = (alt, az) => { if (alt < 5) return null; const r = (90 - alt) / 85, a = rad(az - rot);
      const x = Math.round(cx - r * rx * Math.sin(a)), y = Math.round(cy - r * ry * Math.cos(a)); return x < 0 || x > 46 || y < 0 || y > 11 ? null : [x, y]; };
    const s = sunRaDec(date), day = altAz(s.ra, s.dec, date, p.lat, p.lon).alt > -6;
    const named = [];
    if (!day) {
      for (const [ra, dec, mag] of CAT) { const h = altAz(ra * 15, dec, date, p.lat, p.lon), q = at(h.alt, h.az); if (q) put(q[0], q[1], mag < 2.8 ? "*" : ".", mag, mag < 2.8 ? "sky-mid" : "sky-far"); }
      for (const [name, ra, dec, mag, col] of NAMED) { const h = altAz(ra * 15, dec, date, p.lat, p.lon), q = at(h.alt, h.az);
        if (q) { put(q[0], q[1], mag < 0.5 ? "\u2605" : "\u2726", mag - 10, strong(col)); named.push([mag, name, mag < 0.5 ? "\u2605" : "\u2726", col]); } }
    }
    // The moon where she is, three rows tall, lit on the right while waxing.
    const m = moonRaDec(date), mh = altAz(m.ra, m.dec, date, p.lat, p.lon), mq = at(mh.alt, mh.az);
    if (mq && moonIdx !== 0) {
      const DISC = [[-2, 2], [-3, 3], [-2, 2]], k = (1 - Math.cos(moonIdx / 8 * 2 * Math.PI)) / 2, waxing = moonIdx <= 4;
      DISC.forEach(([a, b], j) => { for (let x = a; x <= b; x++) { const t = x / b, lit = waxing ? t >= 1 - 2 * k : t <= -(1 - 2 * k), y = mq[1] - 1 + j, xx = mq[0] + x;
        if (y >= 0 && y < 13 && xx >= 0 && xx < 47) { c[y][xx] = lit ? "#" : (x === a ? "(" : x === b ? ")" : " "); rank[y][xx] = -99; if (lit) color[y + "," + xx] = "sky-moon"; else delete color[y + "," + xx]; } } });
    }
    // The key (v1.08): a faint rule, then the named stars that are up in tidy columns, three to a row.
    for (let x = 1; x < VW - 1; x += 2) { c[12][x] = "\u00b7"; color["12," + x] = "sky-rule"; }
    const guide = [], tops = named.sort((a, b) => a[0] - b[0]).slice(0, 6), COLW = 15;
    if (!tops.length) { const t = day ? "Daylight. No stars." : "No bright stars up."; [...t].forEach((ch, i) => { c[13][2 + i] = ch; }); }
    tops.forEach(([, name, g, col], i) => { const gx = 2 + (i % 3) * COLW, gy = 13 + Math.floor(i / 3), t = g + " " + name;
      [...t].forEach((ch, k) => { c[gy][gx + k] = ch; }); guide.push({ x: gx, y: gy, len: t.length, color: col }); });
    const parts = {}; try { new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).forEach(q => { parts[q.type] = q.value; }); } catch (e) {}
    const stamp = `${p.city} \u00b7 ${parts.month || ""} ${parts.day || ""} ${parts.year || ""} \u00b7 ${parts.hour || ""}:${parts.minute || ""}`.trim();
    return { rows: c.map(r => r.join("")), color, guide, stamp, day, moonUp: mh.alt > 0 };
  }
  const api = { render, moonPos, place };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SKY = api;
})(typeof window !== "undefined" ? window : globalThis);
