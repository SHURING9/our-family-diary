
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Supabase 공개 설정
const SUPABASE_URL = "https://asloixxmwxrivupfarip.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ph7nw4VMizEhnd-mu8l1JQ_JptWDuA7";

const configured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_") &&
  Boolean(SUPABASE_PUBLISHABLE_KEY) &&
  !SUPABASE_PUBLISHABLE_KEY.includes("YOUR_");

const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const $ = id => document.getElementById(id);

window.callGoogleCalendarFunction = async function (functionName, body) {
  if (!supabase) throw new Error("Supabase 연결을 확인해 주세요.");

  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (!session?.access_token) {
    throw new Error("먼저 가족 일기 사이트에 로그인해 주세요.");
  }

  const { data, error: functionError } =
    await supabase.functions.invoke(functionName, { body });

  if (functionError) throw functionError;
  return data;
};

const views = ["auth-view", "family-setup-view", "app-view"];

const kinds = {
  all: { title: "오늘의 가족 보드", add: "기록 추가하기" },
  event: { title: "가족 일정", add: "일정 추가하기" },
  task: { title: "할 일과 집안일", add: "할 일 추가하기" },
  shopping: { title: "장보기 목록", add: "물건 추가하기" },
  childcare: { title: "소중한 육아 기록", add: "기록 남기기" },
  meal: { title: "이번 주 식단 계획", add: "식단 추가하기" }
};

const categoryOptions = {
  event: [
    ["family", "가족 약속"],
    ["school", "학교·어린이집"],
    ["appointment", "병원·예약"],
    ["birthday", "기념일"],
    ["other", "기타"]
  ],
  task: [
    ["home", "집안일"],
    ["family", "가족 공통"],
    ["shopping", "장보기"],
    ["other", "기타"]
  ],
  shopping: [
    ["food", "식료품"],
    ["household", "생활용품"],
    ["child", "아이 용품"],
    ["other", "기타"]
  ],
  childcare: [
    ["daily", "일상"],
    ["health", "건강"],
    ["growth", "성장·발달"],
    ["memory", "추억"],
    ["other", "기타"]
  ],
  meal: [
    ["breakfast", "아침"],
    ["lunch", "점심"],
    ["dinner", "저녁"],
    ["snack", "간식"],
    ["prep", "식단 준비"]
  ]
};

const targetOptions = [
  ["family", "🏠 가족"],
  ["woong", "👨🏻 웅"],
  ["ddu", "👩🏻 뚜"],
  ["soyul", "🌷 소율"],
  ["siyul", "🌱 시율"]
];

let authMode = "login";
let currentUser = null;
let currentFamily = null;
let currentKind = "all";
let currentTargetFilter = "all";
let items = [];
let busy = false;

const weatherDescriptions = {
  0: ["☀️", "맑음"],
  1: ["🌤️", "대체로 맑음"],
  2: ["⛅", "구름 조금"],
  3: ["☁️", "흐림"],
  45: ["🌫️", "안개"],
  48: ["🌫️", "안개"],
  51: ["🌦️", "이슬비"],
  53: ["🌦️", "이슬비"],
  55: ["🌧️", "이슬비"],
  56: ["🌧️", "어는 이슬비"],
  57: ["🌧️", "어는 이슬비"],
  61: ["🌦️", "약한 비"],
  63: ["🌧️", "비"],
  65: ["🌧️", "강한 비"],
  66: ["🌧️", "어는 비"],
  67: ["🌧️", "강한 어는 비"],
  71: ["🌨️", "약한 눈"],
  73: ["❄️", "눈"],
  75: ["❄️", "많은 눈"],
  77: ["🌨️", "싸락눈"],
  80: ["🌦️", "소나기"],
  81: ["🌧️", "소나기"],
  82: ["⛈️", "강한 소나기"],
  85: ["🌨️", "눈 소나기"],
  86: ["❄️", "강한 눈 소나기"],
  95: ["⛈️", "뇌우"],
  96: ["⛈️", "우박 동반 뇌우"],
  99: ["⛈️", "강한 뇌우"]
};

async function loadBucheonWeather() {
  const widget = $("weather-widget");
  if (!widget) return;

  try {
    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=37.5034&longitude=126.7660&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul&forecast_days=1";

    const response = await fetch(url);
    if (!response.ok) throw new Error("날씨 정보를 불러오지 못했어요.");

    const data = await response.json();
    const current = data.current;
    const daily = data.daily;
    const [icon, description] =
      weatherDescriptions[current.weather_code] || ["🌤️", "날씨 정보"];

    widget.innerHTML = `
      <span class="weather-icon">${icon}</span>
      <span class="weather-copy">
        <strong>부천시 ${Math.round(current.temperature_2m)}° · ${description}</strong>
        <small>
          체감 ${Math.round(current.apparent_temperature)}° ·
          최고 ${Math.round(daily.temperature_2m_max[0])}° /
          최저 ${Math.round(daily.temperature_2m_min[0])}°
        </small>
      </span>`;
  } catch (error) {
    widget.innerHTML = `
      <span class="weather-icon">🌦️</span>
      <span class="weather-copy">
        <strong>부천시 날씨</strong>
        <small>날씨 정보를 잠시 불러올 수 없어요</small>
      </span>`;
  }
}

function showView(id) {
  views.forEach(view => {
    $(view)?.classList.toggle("hidden", view !== id);
  });
}

function message(id, text = "", error = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.style.color = error ? "#b15f50" : "";
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll("button").forEach(button => {
    if (!button.dataset.keepEnabled) button.disabled = value;
  });
}

function localDate(date = new Date()) {
  const adjusted = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );
  return adjusted.toISOString().slice(0, 10);
}

function prettyDate(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}

function categoryLabel(kind, category) {
  const found = (categoryOptions[kind] || [])
    .find(([value]) => value === category);

  return found ? found[1] : "";
}

function kindLabel(kind) {
  return ({
    event: "가족 일정",
    task: "할 일",
    shopping: "장보기",
    childcare: "육아 기록",
    meal: "식단"
  })[kind] || "기록";
}

function targetLabel(target) {
  return targetOptions.find(([value]) => value === target)?.[1] || "🏠 가족";
}

function setupTargetOptions() {
  const select = $("item-target");
  if (!select) return;

  select.replaceChildren();

  targetOptions.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });

  select.value = "family";
}

function updateTargetFilter() {
  document.querySelectorAll("[data-target-filter]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.targetFilter === currentTargetFilter
    );
  });

  renderItems();
}

function updateAuthMode(mode) {
  authMode = mode;

  document.querySelectorAll("[data-auth-mode]").forEach(button => {
    button.classList.toggle("active", button.dataset.authMode === mode);
  });

  if ($("auth-submit")) {
    $("auth-submit").textContent =
      mode === "login" ? "로그인하기" : "가입하고 시작하기";
  }

  if ($("auth-password")) {
    $("auth-password").autocomplete =
      mode === "login" ? "current-password" : "new-password";
  }

  message("auth-message", "");
}
