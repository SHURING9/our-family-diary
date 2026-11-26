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

  if (functionError) {
    // 함수가 보낸 오류 안내 문구를 꺼내서 보여줌
    const detail = await functionError.context?.json?.().catch(() => null);
    throw detail?.error ? new Error(detail.error) : functionError;
  }
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

function shiftDate(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86400000
  );
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


function setupCategoryOptions(kind) {
  const select = $("item-category");
  if (!select) return;

  select.innerHTML = '<option value="">선택해 주세요</option>';

  (categoryOptions[kind] || []).forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
}

function prepareItemForm(kind) {
  const form = $("item-form");
  form.dataset.kind = kind;

  setupCategoryOptions(kind);
  setupTargetOptions();

  $("date-field")?.classList.toggle("hidden", kind === "childcare");
  $("category-field")?.classList.toggle("hidden", kind === "childcare");
  $("quantity-field")?.classList.toggle("hidden", kind !== "shopping");
  $("time-fields")?.classList.toggle("hidden", kind !== "event");
  $("add-form-wrap")?.classList.remove("hidden");
  message("item-message", "");
}

function openAddForm() {
  if (!currentFamily) return;

  const kind = currentKind === "all" ? "event" : currentKind;
  const form = $("item-form");

  form.dataset.itemId = "";
  form.dataset.kind = kind;

  $("form-title").textContent = kinds[kind].add;
  $("item-title").value = "";
  $("item-details").value = "";
  $("item-start-time").value = "";
  $("item-end-time").value = "";
  $("item-date").value = localDate();
  $("item-quantity").value = "";
  $("item-category").value = "";
  $("item-target").value = "family";

  prepareItemForm(kind);
  $("item-title").focus();
}

function openEditForm(item) {
  if (!currentFamily || !item) return;

  const form = $("item-form");

  form.dataset.itemId = String(item.id);
  form.dataset.kind = item.kind;

  $("form-title").textContent = `${kindLabel(item.kind)} 수정하기`;
  $("item-title").value = item.title || "";
  $("item-details").value = item.details || "";
  $("item-start-time").value = item.start_time
    ? item.start_time.slice(0, 5)
    : "";
  $("item-end-time").value = item.end_time
    ? item.end_time.slice(0, 5)
    : "";
  $("item-date").value = item.date || localDate();
  $("item-quantity").value = item.quantity || "";

  prepareItemForm(item.kind);

  $("item-category").value = item.category || "";
  $("item-target").value = item.target || "family";
  $("item-title").focus();
}

function closeAddForm() {
  $("add-form-wrap")?.classList.add("hidden");
  $("item-form")?.reset();

  if ($("item-form")) {
    $("item-form").dataset.itemId = "";
    $("item-form").dataset.kind = "";
  }

  message("item-message", "");
}

function setCurrentKind(kind) {
  if (!kinds[kind]) return;

  currentKind = kind;

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.kind === kind);
  });

  $("list-title").textContent = kinds[kind].title;
  $("add-button-label").textContent = kinds[kind].add;

  renderItems();
}

// 구글 캘린더 영역(google-calendar.js)에 로그인 상태를 알림
function notifyCalendarAuth() {
  window.dispatchEvent(new CustomEvent("family-auth-changed", {
    detail: {
      signedIn: Boolean(currentFamily),
      familyId: currentFamily?.id || null
    }
  }));
}

function refreshCalendarPanel() {
  window.dispatchEvent(new CustomEvent("family-calendar-refresh"));
}

async function reloadItems() {
  if (!supabase || !currentFamily) return;

  const familyId = currentFamily.id;

  const { data, error } = await supabase
    .from("family_items")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (currentFamily?.id !== familyId) return;

  items = data || [];
  renderItems();
}

function updateSummary() {
  $("count-events").textContent =
    items.filter(item => item.kind === "event" && !item.completed).length;

  $("count-tasks").textContent =
    items.filter(item => item.kind === "task" && !item.completed).length;

  $("count-shopping").textContent =
    items.filter(item => item.kind === "shopping" && !item.completed).length;

  $("count-childcare").textContent =
    items.filter(item => item.kind === "childcare").length;
}

function renderItems() {
  const list = $("items-list");
  if (!list) return;

  const filtered = items
    .filter(item =>
      (currentKind === "all" || item.kind === currentKind) &&
      (currentTargetFilter === "all" ||
        (item.target || "family") === currentTargetFilter)
    )
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;

      if (a.date && b.date && a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }

      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;

      return (b.created_at || "").localeCompare(a.created_at || "");
    });

  $("loading-state")?.classList.add("hidden");
  $("empty-state")?.classList.toggle("hidden", filtered.length !== 0);
  list.replaceChildren();

  filtered.forEach(item => {
    const card = document.createElement("article");
    card.className = "item-card";

    const canCheck = ["task", "shopping"].includes(item.kind);

    card.innerHTML = `
      ${canCheck
        ? `<button type="button" class="item-check ${item.completed ? "checked" : ""}"
             aria-label="${item.completed ? "완료 취소" : "완료 처리"}"
             data-toggle="${escapeHTML(item.id)}">${item.completed ? "✓" : ""}</button>`
        : `<span class="summary-icon">${({event:"📅", childcare:"🌱", meal:"🍲"})[item.kind] || "♡"}</span>`}
      <div class="item-main">
        <div class="item-topline">
          <div class="item-title ${item.completed ? "completed" : ""}">${escapeHTML(item.title)}</div>
          <div class="item-actions">
            <button type="button" class="item-edit-btn"
              data-edit-item="${escapeHTML(item.id)}" aria-label="기록 수정">수정</button>
            <button type="button" class="delete-btn"
              data-delete="${escapeHTML(item.id)}" aria-label="기록 삭제">×</button>
          </div>
        </div>
        ${item.date
          ? `<div class="item-date">${escapeHTML(prettyDate(item.date))}${item.end_date && item.end_date > item.date
              ? ` ~ ${escapeHTML(prettyDate(item.end_date))}`
              : ""}${item.start_time && item.end_time
              ? ` · ${escapeHTML(item.start_time.slice(0,5))}–${escapeHTML(item.end_time.slice(0,5))}`
              : ""}</div>`
          : ""}
        ${item.details ? `<p class="item-details">${escapeHTML(item.details)}</p>` : ""}
        <div class="item-meta">
          <span class="pill">${escapeHTML(kindLabel(item.kind))}</span>
          <span class="pill target-pill">${escapeHTML(targetLabel(item.target || "family"))}</span>
          ${item.category
            ? `<span class="pill">${escapeHTML(categoryLabel(item.kind, item.category) || item.category)}</span>`
            : ""}
          ${item.quantity ? `<span class="pill">${escapeHTML(item.quantity)}</span>` : ""}
          ${item.completed ? `<span class="pill">완료</span>` : ""}
        </div>
      </div>`;

    list.appendChild(card);
  });

  updateSummary();
}



async function loadFamily() {
  if (!supabase || !currentUser) return;

  message("global-message", "");

  const { data: membership, error: memberError } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", currentUser.id)
    .limit(1)
    .maybeSingle();

  if (memberError) throw memberError;

  if (!membership) {
    currentFamily = null;
    showView("family-setup-view");
    notifyCalendarAuth();
    return;
  }

  const { data: family, error: familyError } = await supabase
    .from("families")
    .select("id,name,invite_code")
    .eq("id", membership.family_id)
    .single();

  if (familyError) throw familyError;

  currentFamily = family;

  $("family-name-display").textContent = family.name;
  $("family-invite-code").textContent = family.invite_code;

  $("today-label").textContent =
    new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long"
    }).format(new Date()) + " · 오늘의 일상을 차곡차곡 모아봐요.";

  showView("app-view");
  $("loading-state").classList.remove("hidden");

  await reloadItems();

  // 목록을 먼저 보여준 뒤 Google 캘린더 동기화를 시작
  notifyCalendarAuth();
}

async function refreshAuthState(session) {
  currentUser = session?.user || null;

  $("user-area")?.classList.toggle("hidden", !currentUser);

  if ($("user-email")) {
    $("user-email").textContent = currentUser?.email || "";
  }

  if (!currentUser) {
    currentFamily = null;
    items = [];
    showView("auth-view");
    notifyCalendarAuth();
    return;
  }

  try {
    await loadFamily();
  } catch (error) {
    console.error("가족 정보 불러오기 오류:", error);
    message(
      "global-message",
      "정보를 불러오지 못했어요. 데이터베이스 설정을 확인해 주세요. (" +
        error.message + ")",
      true
    );
  }
}

function googleDatePayload(item) {
  if (!item.date) return null;

  const lastDate = item.end_date && item.end_date > item.date
    ? item.end_date
    : item.date;

  if (item.start_time && item.end_time) {
    return {
      start: {
        dateTime: `${item.date}T${item.start_time.slice(0, 5)}:00+09:00`,
        timeZone: "Asia/Seoul"
      },
      end: {
        dateTime: `${lastDate}T${item.end_time.slice(0, 5)}:00+09:00`,
        timeZone: "Asia/Seoul"
      }
    };
  }

  return {
    start: { date: item.date },
    end: { date: shiftDate(lastDate, 1) }
  };
}

async function syncItemToGoogleCalendar(item) {
  if (!item || item.kind !== "event" || !item.date) return item;

  const datePayload = googleDatePayload(item);

  const googleResult = await window.callGoogleCalendarFunction(
    "google-calendar-api",
    {
      action: "save",
      eventId: item.google_event_id || undefined,
      itemId: item.id,
      summary: item.title,
      description: item.details || "",
      start: datePayload.start,
      end: datePayload.end
    }
  );

  const googleEventId = googleResult?.event?.id;

  if (!googleEventId) {
    throw new Error("Google 일정 ID를 받지 못했습니다.");
  }

  if (String(item.google_event_id || "") !== String(googleEventId)) {
    const { error } = await supabase
      .from("family_items")
      .update({ google_event_id: googleEventId })
      .eq("id", item.id)
      .eq("family_id", currentFamily.id);

    if (error) throw error;
  }

  return { ...item, google_event_id: googleEventId };
}

async function addItem(event) {
  event.preventDefault();

  if (!currentFamily || !currentUser || busy) return;

  const form = $("item-form");
  const kind = form.dataset.kind;
  const editingId = form.dataset.itemId || "";

  const existingItem = editingId
    ? items.find(item => String(item.id) === String(editingId))
    : null;

  const title = $("item-title").value.trim();

  if (!title) {
    message("item-message", "제목을 입력해 주세요.", true);
    return;
  }

  if (editingId && !existingItem) {
    message(
      "item-message",
      "수정할 기록을 찾지 못했어요. 목록을 새로고침해 주세요.",
      true
    );
    return;
  }

  setBusy(true);
  message("item-message", "");

  try {
    const startTime = $("item-start-time").value || null;
    const endTime = $("item-end-time").value || null;
    const date = kind === "childcare" ? null : ($("item-date").value || null);

    // 며칠짜리 일정은 시작일을 바꿔도 기간을 유지
    const endDate =
      kind === "event" && date && existingItem?.date && existingItem.end_date
        ? shiftDate(date, daysBetween(existingItem.date, existingItem.end_date))
        : null;

    if (
      kind === "event" &&
      ((startTime && !endTime) || (!startTime && endTime))
    ) {
      throw new Error(
        "시작 시간과 종료 시간을 모두 입력하거나, 둘 다 비워 주세요."
      );
    }

    if (
      kind === "event" &&
      startTime &&
      endTime &&
      !endDate &&
      endTime <= startTime
    ) {
      throw new Error("종료 시간은 시작 시간보다 뒤여야 해요.");
    }

    const payload = {
      kind,
      title,
      details: $("item-details").value.trim() || null,
      date,
      start_time: kind === "event" ? startTime : null,
      end_time: kind === "event" ? endTime : null,
      category: $("item-category").value || null,
      target: $("item-target").value || "family",
      quantity: kind === "shopping"
        ? ($("item-quantity").value.trim() || null)
        : null
    };

    // 며칠짜리 일정일 때만 end_date를 보냄 (기존 값을 지워야 할 때 포함)
    if (endDate || existingItem?.end_date) payload.end_date = endDate;

    let savedItem;

    if (editingId) {
      const { data, error } = await supabase
        .from("family_items")
        .update(payload)
        .eq("id", editingId)
        .eq("family_id", currentFamily.id)
        .select("*")
        .single();

      if (error) throw error;
      savedItem = data;
    } else {
      const { data, error } = await supabase
        .from("family_items")
        .insert({
          ...payload,
          family_id: currentFamily.id,
          created_by: currentUser.id,
          completed: false
        })
        .select("*")
        .single();

      if (error) throw error;
      savedItem = data;
    }

    if (existingItem) {
      savedItem.completed = existingItem.completed;
      savedItem.google_event_id = existingItem.google_event_id;
    }

    closeAddForm();
    await loadFamily();

    if (kind === "event") {
      if (!savedItem.date) {
        message(
          "global-message",
          editingId
            ? "웹 가족 일기 기록은 수정했어요. Google 캘린더 동기화를 위해 날짜를 입력해 주세요."
            : "가족 일기에는 저장했어요. Google 캘린더 연동을 위해 날짜를 입력해 주세요."
        );
        return;
      }

      try {
        await syncItemToGoogleCalendar(savedItem);
        await loadFamily();
        refreshCalendarPanel();

        message(
          "global-message",
          editingId
            ? "가족 일기와 Google 캘린더의 일정을 수정했어요."
            : "가족 일기와 Google 캘린더에 일정을 저장했어요."
        );
      } catch (calendarError) {
        console.error("Google 캘린더 동기화 오류:", calendarError);

        message(
          "global-message",
          editingId
            ? "웹 가족 일기는 수정했지만 Google 캘린더 동기화에 실패했어요."
            : "가족 일기에는 저장했지만 Google 캘린더 저장에 실패했어요.",
          true
        );
      }
    } else {
      message(
        "global-message",
        editingId ? "기록을 수정했어요." : "기록을 저장했어요."
      );
    }
  } catch (error) {
    console.error("기록 저장/수정 오류:", error);
    message("item-message", "저장하지 못했어요: " + error.message, true);
  } finally {
    setBusy(false);
  }
}

async function toggleItem(id) {
  const item = items.find(x => String(x.id) === String(id));
  if (!item || !currentFamily) return;

  const { error } = await supabase
    .from("family_items")
    .update({ completed: !item.completed })
    .eq("id", id)
    .eq("family_id", currentFamily.id);

  if (error) {
    message(
      "global-message",
      "상태를 변경하지 못했어요: " + error.message,
      true
    );
    return;
  }

  await loadFamily();
}

async function deleteItem(id) {
  const item = items.find(x => String(x.id) === String(id));

  if (!item || !confirm(`“${item.title}” 기록을 삭제할까요?`)) return;

  setBusy(true);

  try {
    if (item.kind === "event" && item.google_event_id) {
      try {
        await window.callGoogleCalendarFunction("google-calendar-api", {
          action: "delete",
          eventId: item.google_event_id
        });
      } catch (calendarError) {
        console.error("Google 캘린더 일정 삭제 오류:", calendarError);

        // 웹에서만 지우면 다음 동기화 때 다시 나타나므로 삭제를 중단
        message(
          "global-message",
          "Google 캘린더에서 삭제하지 못해 기록을 그대로 두었어요. 잠시 후 다시 시도해 주세요.",
          true
        );
        return;
      }
    }

    const { error } = await supabase
      .from("family_items")
      .delete()
      .eq("id", id)
      .eq("family_id", currentFamily.id);

    if (error) throw error;

    message("global-message", "기록을 삭제했어요.");
    await loadFamily();
    if (item.kind === "event") refreshCalendarPanel();
  } catch (error) {
    console.error("기록 삭제 오류:", error);
    message("global-message", "삭제하지 못했어요: " + error.message, true);
  } finally {
    setBusy(false);
  }
}


async function createFamily(event) {
  event.preventDefault();

  if (!supabase || !currentUser || busy) return;

  const name = $("family-name").value.trim();
  if (!name) return;

  setBusy(true);
  message("setup-message", "");

  try {
    const { error } = await supabase.rpc("create_family", {
      p_name: name
    });

    if (error) throw error;

    await loadFamily();
    message("setup-message", "가족 공간을 만들었어요!");
  } catch (error) {
    console.error("가족 공간 생성 오류:", error);
    message(
      "setup-message",
      "가족 공간을 만들지 못했어요: " + error.message,
      true
    );
  } finally {
    setBusy(false);
  }
}

async function joinFamily(event) {
  event.preventDefault();

  if (!supabase || !currentUser || busy) return;

  const inviteCode = $("invite-code").value.trim().toUpperCase();
  if (!inviteCode) return;

  setBusy(true);
  message("setup-message", "");

  try {
    const { error } = await supabase.rpc("join_family", {
      p_invite_code: inviteCode
    });

    if (error) throw error;

    await loadFamily();
    message("setup-message", "가족 공간에 참여했어요!");
  } catch (error) {
    console.error("가족 공간 참여 오류:", error);
    message(
      "setup-message",
      "참여하지 못했어요: " + error.message,
      true
    );
  } finally {
    setBusy(false);
  }
}

async function copyInviteCode() {
  const code = $("family-invite-code")?.textContent?.trim();
  if (!code || code === "--------") return;

  try {
    await navigator.clipboard.writeText(code);
    message("global-message", "초대 코드를 복사했어요.");
  } catch {
    window.prompt("초대 코드를 복사해 주세요.", code);
  }
}

// 모든 버튼과 폼의 이벤트 연결
function bindEvents() {
  $("auth-form")?.addEventListener("submit", async event => {
    event.preventDefault();

    if (!supabase) {
      message("auth-message", "Supabase 설정을 확인해 주세요.", true);
      return;
    }

    if (busy) return;

    message("auth-message", "");
    setBusy(true);

    try {
      const email = $("auth-email").value.trim();
      const password = $("auth-password").value;

      const result = authMode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

      if (result.error) throw result.error;

      if (authMode === "signup" && !result.data.session) {
        message(
          "auth-message",
          "가입 확인 이메일을 보냈어요. 이메일 인증을 마친 뒤 로그인해 주세요."
        );
        return;
      }

      if (result.data.session) {
        await refreshAuthState(result.data.session);
      }
    } catch (error) {
      console.error("로그인/회원가입 오류:", error);
      message(
        "auth-message",
        error.message || "로그인하지 못했어요. 이메일과 비밀번호를 확인해 주세요.",
        true
      );
    } finally {
      setBusy(false);
    }
  });

  document.querySelectorAll("[data-auth-mode]").forEach(button => {
    button.addEventListener("click", () => {
      updateAuthMode(button.dataset.authMode);
    });
  });

  $("logout-btn")?.addEventListener("click", async () => {
    if (!supabase) return;

    setBusy(true);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await refreshAuthState(null);
    } catch (error) {
      message(
        "global-message",
        "로그아웃하지 못했어요: " + error.message,
        true
      );
    } finally {
      setBusy(false);
    }
  });

  $("create-family-form")?.addEventListener("submit", createFamily);
  $("join-family-form")?.addEventListener("submit", joinFamily);

  document.querySelectorAll(".nav-item[data-kind]").forEach(button => {
    button.addEventListener("click", () => {
      setCurrentKind(button.dataset.kind);
    });
  });

  document.querySelectorAll("[data-target-filter]").forEach(button => {
    button.addEventListener("click", () => {
      currentTargetFilter = button.dataset.targetFilter;
      updateTargetFilter();
    });
  });

  $("add-item-btn")?.addEventListener("click", openAddForm);
  $("empty-add-btn")?.addEventListener("click", openAddForm);
  $("cancel-add-btn")?.addEventListener("click", closeAddForm);
  $("cancel-add-btn-bottom")?.addEventListener("click", closeAddForm);
  $("item-form")?.addEventListener("submit", addItem);

  $("items-list")?.addEventListener("click", async event => {
    const toggleButton = event.target.closest("[data-toggle]");
    const editButton = event.target.closest("[data-edit-item]");
    const deleteButton = event.target.closest("[data-delete]");

    if (toggleButton) {
      await toggleItem(toggleButton.dataset.toggle);
      return;
    }

    if (editButton) {
      const item = items.find(
        x => String(x.id) === String(editButton.dataset.editItem)
      );

      if (item) openEditForm(item);
      return;
    }

    if (deleteButton) {
      await deleteItem(deleteButton.dataset.delete);
    }
  });

  $("copy-invite-btn")?.addEventListener("click", copyInviteCode);
}

bindEvents();

// Google 일정을 가져온 뒤 가족 일정 목록을 다시 읽음
window.addEventListener("family-calendar-synced", () => {
  reloadItems().catch(error => console.error("목록 갱신 오류:", error));
});

loadBucheonWeather();
setInterval(loadBucheonWeather, 30 * 60 * 1000);

// 최초 로그인 상태 확인 및 로그인 상태 변경 감지
if (!configured || !supabase) {
  showView("auth-view");
  message("auth-message", "Supabase 설정을 확인해 주세요.", true);
} else {
  supabase.auth.getSession()
    .then(({ data, error }) => {
      if (error) throw error;
      return refreshAuthState(data.session);
    })
    .catch(error => {
      console.error("초기 로그인 상태 확인 오류:", error);
      message(
        "auth-message",
        "로그인 상태를 확인하지 못했어요. 페이지를 새로고침해 주세요.",
        true
      );
    });

  supabase.auth.onAuthStateChange((_event, session) => {
    queueMicrotask(() => refreshAuthState(session));
  });
}
