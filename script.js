const apiBase = "https://api.open-meteo.com/v1/forecast";
const nominatimSearchUrl = "https://nominatim.openstreetmap.org/search";
const nominatimReverseUrl = "https://nominatim.openstreetmap.org/reverse";

const searchBtn = document.getElementById("search-btn");
const cityInput = document.getElementById("city-input");
const toggleBtn = document.getElementById("toggle-unit");

const locationEl = document.querySelector(".location");
const tempEl = document.querySelector(".temp");
const descEl = document.querySelector(".desc");
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const forecastContainer = document.getElementById("forecast-cards");

let isCelsius = true;
let currentData = null;

const weatherDescriptions = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};


// ------------------ helpers ------------------

function getWeatherEmoji(code) {
  if ([0].includes(code)) return "☀️";        // Clear
  if ([1].includes(code)) return "🌤️";   // Mainly clear
  if ([2].includes(code)) return "⛅";   // Partly cloudy
  if ([3].includes(code)) return "☁️";      // Cloudy
  if ([45, 48].includes(code)) return "░▒▓"; // Fog style
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦️"; // Drizzle
  if ([61, 63, 65].includes(code)) return "🌧️"; // Rain
  if ([66, 67, 71, 73, 75, 77, 85, 86].includes(code)) return "❄️"; // Snow
  if ([80,81, 82, 83].includes(code)) return "☔"; // Rain
  if ([95, 96, 99].includes(code)) return "⚡"; // Storm
  return "⬜";
}



function convertTemp(tempC) {
  return isCelsius ? tempC : (tempC * 9) / 5 + 32;
}

// prefer these address keys (in order) for place name
const PLACE_KEYS = ["city", "town", "village", "hamlet", "municipality", "county", "state"];

/** Given a Nominatim result object (search item or reverse result), return "Place, Country" */
function formatPlaceFromNominatim(obj) {
  if (!obj) return null;

  // Nominatim search returns address inside obj.address (object)
  const address = obj.address || {};
  // pick the best place name
  let place = null;
  for (const k of PLACE_KEYS) {
    if (address[k]) {
      place = address[k];
      break;
    }
  }

  // fallback: Nominatim sometimes provides a 'name' field or we can parse display_name
  if (!place && obj.name) place = obj.name;
  if (!place && obj.display_name) {
    // display_name often like "Mysuru, Mysuru taluk, Mysuru District, Karnataka, 570001, India"
    // split and take first segment (usually core place)
    place = obj.display_name.split(",")[0].trim();
  }

  // country full name if available
  const country = address.country || (() => {
    if (obj.display_name) {
      const parts = obj.display_name.split(",");
      return parts[parts.length - 1].trim();
    }
    return null;
  })();

  if (!place && !country) return null;
  return country ? `${place}, ${country}` : place;
}

// ------------------ Nominatim calls ------------------

async function nominatimSearch(city) {
  // addressdetails=1 so we get the address object (city, country, etc.)
  const url = `${nominatimSearchUrl}?q=${encodeURIComponent(city)}&format=json&addressdetails=1&limit=5`;
  const resp = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!resp.ok) throw new Error("Nominatim search failed");
  return resp.json(); // array
}

async function nominatimReverse(lat, lon) {
  const url = `${nominatimReverseUrl}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&addressdetails=1`;
  const resp = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!resp.ok) throw new Error("Nominatim reverse failed");
  return resp.json(); // object
}

// ------------------ Weather calls & rendering ------------------

async function getWeather(lat, lon, place = "Your Location") {
  try {
    const url = `${apiBase}?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather fetch failed");
    const data = await res.json();
    displayWeather(data, place);
  } catch (err) {
    console.error("Error fetching weather:", err);
    locationEl.textContent = "Failed to load.";
    tempEl.textContent = "--";
    descEl.textContent = "---";
  }
}

function displayWeather(data, place) {
  currentData = data;
  const weather = data.current_weather;
  const humidity = data.hourly?.relativehumidity_2m?.length ? data.hourly.relativehumidity_2m[0] : "--";

  tempEl.textContent = `${Math.round(convertTemp(weather.temperature))} °${isCelsius ? "C" : "F"}`;
  descEl.textContent = getWeatherEmoji(weather.weathercode) + " " +
                     (weatherDescriptions[weather.weathercode] || "Unknown");
  /*descEl.textContent = getWeatherEmoji(weather.weathercode);*/
  humidityEl.textContent = humidity;
  windEl.textContent = Math.round(weather.windspeed ?? 0);
  locationEl.textContent = place;

  // forecast: next 3 days (skip today)
  forecastContainer.innerHTML = "";
  const daysToShow = 3;
  for (let i = 1; i <= daysToShow; i++) {
    const dateStr = data.daily.time[i];
    const dayName = new Date(dateStr).toLocaleDateString("en-US", { weekday: "short" });
    const maxC = data.daily.temperature_2m_max[i];
    const minC = data.daily.temperature_2m_min[i];
    const code = data.daily.weathercode[i];
    const min = Math.round(convertTemp(minC));
    const max = Math.round(convertTemp(maxC));
    const emoji = getWeatherEmoji(code);

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${dayName}</h3>
      <div class="emoji">${emoji}</div>
      <p>${min}° / ${max}°</p>
    `;
    forecastContainer.appendChild(card);
  }
}

// ------------------ Location detection / search ------------------

async function getCityNameForCoords(lat, lon) {
  try {
    const j = await nominatimReverse(lat, lon);
    const place = formatPlaceFromNominatim(j);
    return place || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  } catch (err) {
    console.error("Reverse geocode error:", err);
    return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  }
}

function detectLocation() {
  locationEl.textContent = "Detecting location...";
  if (!navigator.geolocation) {
    locationEl.textContent = "Geolocation not supported.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const place = await getCityNameForCoords(latitude, longitude);
        getWeather(latitude, longitude, place);
      } catch (err) {
        console.error(err);
        getWeather(latitude, longitude, `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
      }
    },
    (err) => {
      console.error("Geolocation error:", err);
      locationEl.textContent = "Location not allowed.";
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function searchCityWeather(city) {
  try {
    locationEl.textContent = "Searching...";
    const results = await nominatimSearch(city);

    if (!results || results.length === 0) {
      locationEl.textContent = "City not found!";
      return;
    }

    // Prefer results that have explicit city/town/village types
    let chosen = results.find(r => {
      const t = (r.type || "").toLowerCase();
      return t === "city" || t === "town" || t === "village" || t === "municipality";
    });

    // or pick a result that has an address with city/town/village keys
    if (!chosen) {
      chosen = results.find(r => r.address && (r.address.city || r.address.town || r.address.village || r.address.hamlet));
    }

    // fallback to first result
    if (!chosen) chosen = results[0];

    const lat = chosen.lat;
    const lon = chosen.lon;
    const place = formatPlaceFromNominatim(chosen) || chosen.display_name || `${lat}, ${lon}`;

    getWeather(lat, lon, place);
  } catch (err) {
    console.error("Search error:", err);
    locationEl.textContent = "Search failed.";
  }
}

// ------------------ events ------------------

toggleBtn.addEventListener("click", () => {
  isCelsius = !isCelsius;
  toggleBtn.textContent = isCelsius ? "Switch to °F" : "Switch to °C";
  if (currentData) {
    displayWeather(currentData, locationEl.textContent);
  }
});

searchBtn.addEventListener("click", () => {
  const city = cityInput.value.trim();
  if (!city) return;
  searchCityWeather(city);
});

// support Enter key
cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchBtn.click();
});

// start
detectLocation();
