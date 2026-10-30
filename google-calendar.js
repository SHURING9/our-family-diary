
const GOOGLE_CLIENT_ID = "309562030182-jit2t0v0ae7kiugr9mganp5v5glh2eek.apps.googleusercontent.com";
const GOOGLE_API_KEY = "AIzaSyA3EF3XnFFEBiNmp5DU5WLwribC-7Guytw";


// 가족 공유 캘린더 하나만 고정하려면 해당 캘린더 ID를 입력하세요.
// 비워 두면 기본(primary) 캘린더를 제외한 캘린더 목록을 보여 줍니다.
const FAMILY_CALENDAR_ID = "846d074f08c35cbdd8732923d73d60399e9b316803cc78f74fbd87d793e4c0b6@group.calendar.google.com";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events"
].join(" ");

const DISCOVERY_DOC =
  "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

const $ = (id) => document.getElementById(id);

let tokenClient;
let googleReady = false;
let selectedCalendar = "";
let displayedMonth = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1
);
let events = [];

function showMessage(message, error = false) {
  const el = $("google-calendar-message");
  if (el) {
    el.textContent = message;
    el.style.color = error ? "#b15f50" : "";
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateTimeValue(date) {
  const adjusted = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );
  return adjusted.toISOString().slice(0, 16);
}

function parseLocalDateTime(value) {
  return new Date(value);
}

function eventStartKey(event) {
  if (event.start?.date) return event.start.date;
  if (event.start?.dateTime) {
    return dateKey(new Date(event.start.dateTime));
  }
  return "";
}

function eventTimeLabel(event) {
  if (event.start?.date && !event.start?.dateTime) {
    return "종일";
  }
  if (!event.start?.dateTime) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(event.start.dateTime));
}

async function initializeCalendar() {
  try {
    if (
      !GOOGLE_CLIENT_ID.trim() ||
      !GOOGLE_API_KEY.trim() ||
      GOOGLE_CLIENT_ID.startsWith("여기에_") ||
      GOOGLE_API_KEY.startsWith("여기에_") ||
      GOOGLE_CLIENT_ID.includes("기존 OAuth") ||
      GOOGLE_API_KEY.includes("기존 Google")
    ) {
      showMessage(
        "파일 맨 위에 기존 OAuth 클라이언트 ID와 API 키를 입력해 주세요.",
        true
      );
      return;
    }

    await Promise.all([
      loadScript("https://apis.google.com/js/api.js"),
      loadScript("https://accounts.google.com/gsi/client")
    ]);

    await new Promise(resolve => gapi.load("client", resolve));

    await gapi.client.init({
      apiKey: GOOGLE_API_KEY,
      discoveryDocs: [DISCOVERY_DOC]
    });

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: async (response) => {
        if (response.error) {
          showMessage(
            "구글 인증에 실패했어요. 테스트 사용자 설정을 확인해 주세요.",
            true
          );
          return;
        }

        gapi.client.setToken({
          access_token: response.access_token
        });

        $("google-connect-btn").textContent = "구글 계정 연결됨";
        $("google-calendar-controls").classList.remove("hidden");

        await loadCalendars();
        await syncAllFamilyDiaryEventsToGoogleCalendar();
      }
    });

    googleReady = true;
    renderCalendarShell();
  } catch (error) {
    console.error(error);
    showMessage(
      "구글 캘린더 초기화에 실패했어요. API 설정을 확인해 주세요.",
      true
    );
  }
}

async function connectCalendar() {
  if (!googleReady) {
    showMessage("캘린더를 준비 중이에요. 잠시 후 다시 눌러 주세요.");
    return;
  }


async function connectCalendar() {
  if (!googleReady) {
    showMessage("캘린더를 준비 중이에요. 잠시 후 다시 눌러 주세요.");
    return;
  }

  // 매번 동의 화면을 강제로 띄우지 않도록 수정
  tokenClient.requestAccessToken();
}

}

async function loadCalendars() {
  try {
    showMessage("캘린더를 불러오는 중이에요.");

    const response = await gapi.client.calendar.calendarList.list({
      maxResults: 250
    });

    const calendars = response.result.items || [];
    const select = $("google-calendar-select");
    select.replaceChildren();

    // 캘린더 ID를 지정하면 해당 캘린더 하나만 표시합니다.
    // 비어 있으면 기본 개인 캘린더(primary)를 제외합니다.
    const visibleCalendars = FAMILY_CALENDAR_ID
      ? calendars.filter(
          calendar => calendar.id === FAMILY_CALENDAR_ID
        )
      : calendars.filter(calendar => !calendar.primary);

    visibleCalendars.forEach(calendar => {
      const option = document.createElement("option");
      option.value = calendar.id;
      option.textContent =
        calendar.summary || "이름 없는 캘린더";
      select.appendChild(option);
    });

    if (!visibleCalendars.length) {
      showMessage(
        FAMILY_CALENDAR_ID
          ? "설정한 가족 캘린더를 찾지 못했어요. 캘린더 ID와 공유 권한을 확인해 주세요."
          : "기본 캘린더 외에 표시할 캘린더가 없어요. 가족 공유 캘린더를 추가했는지 확인해 주세요.",
        true
      );
      return;
    }

    if (!FAMILY_CALENDAR_ID) {
      showMessage(
        "기본 캘린더는 숨겼어요. 가족 공유 캘린더 하나만 표시하려면 FAMILY_CALENDAR_ID에 해당 캘린더 ID를 입력해 주세요."
      );
    }

    selectedCalendar = select.value;
    await loadMonthEvents();
  } catch (error) {
    console.error(error);
    showMessage(
      "캘린더 목록을 불러오지 못했어요. 계정과 공유 권한을 확인해 주세요.",
      true
    );
  }
}

async function loadMonthEvents() {
  selectedCalendar = $("google-calendar-select").value;
  if (!selectedCalendar) return;

  const start = new Date(
    displayedMonth.getFullYear(),
    displayedMonth.getMonth(),
    1
  );

  const end = new Date(
    displayedMonth.getFullYear(),
    displayedMonth.getMonth() + 1,
    1
  );

  try {
    showMessage("일정을 불러오는 중이에요.");

    const response = await gapi.client.calendar.events.list({
      calendarId: selectedCalendar,
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      maxResults: 2500,
      singleEvents: true,
      orderBy: "startTime",
      showDeleted: false
    });

    events = response.result.items || [];
    renderCalendar();

    showMessage(
      `${displayedMonth.getFullYear()}년 ${displayedMonth.getMonth() + 1}월 일정을 불러왔어요.`
    );
  } catch (error) {
    console.error(error);
    showMessage(
      "일정을 불러오지 못했어요. 캘린더 권한을 확인해 주세요.",
      true
    );
  }
}

// Google Calendar에 연결되어 있고, 일정 추가 권한이 있는지 확인합니다.
function isGoogleCalendarConnected() {
  return Boolean(
    googleReady &&
    selectedCalendar &&
    window.gapi?.client?.getToken?.()?.access_token
  );
}

// Google Calendar의 종일 일정 종료일은 시작일의 다음 날로 설정합니다.
function nextDateISO(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

/*
 * 웹페이지의 '가족 일정' 항목만 동기화합니다.
 * 대상(가족/웅/뚜/소율/시율)은 웹페이지에서만 구분하고,
 * Google Calendar에는 제목과 메모만 기록합니다.
 * Google 이벤트의 private extended property에 Supabase 항목 ID를 저장해 중복 생성을 막습니다.
 */
async function syncFamilyDiaryItemToGoogleCalendar(item) {
  if (!item || item.kind !== "event") {
    return { status: "skipped" };
  }

  if (!item.date) {
    return { status: "missing_date" };
  }

  if (!isGoogleCalendarConnected()) {
    return { status: "not_connected" };
  }

  try {
    const existingResponse = await gapi.client.calendar.events.list({
      calendarId: selectedCalendar,
      privateExtendedProperty: [
        `familyDiaryItemId=${item.id}`,
        `familyDiaryFamilyId=${item.family_id}`
      ],
      maxResults: 1,
      showDeleted: false
    });

    const existing = existingResponse.result.items || [];

    if (existing.length) {
      return {
        status: "already_exists",
        eventId: existing[0].id
      };
    }

    const resource = {
      summary: item.title || "제목 없는 일정",
      description: item.details || "",
      start: { date: item.date },
      end: { date: nextDateISO(item.date) },
      extendedProperties: {
        private: {
          familyDiaryItemId: String(item.id),
          familyDiaryFamilyId: String(item.family_id)
        }
      }
    };

    const response = await gapi.client.calendar.events.insert({
      calendarId: selectedCalendar,
      resource
    });

    return {
      status: "synced",
      eventId: response.result?.id
    };
  } catch (error) {
    console.error("Google Calendar 자동 업로드 실패:", error);
    return { status: "failed", error };
  }
}

// 구글 계정 연결 시 웹페이지에 이미 저장된 일정도 한 번에 동기화합니다.
async function syncAllFamilyDiaryEventsToGoogleCalendar() {
  if (!isGoogleCalendarConnected()) return;

  const getItems = window.getFamilyDiaryItemsForGoogleSync;
  if (typeof getItems !== "function") return;

  const websiteEvents = (getItems() || []).filter(
    item => item.kind === "event"
  );

  let synced = 0;
  let existing = 0;
  let missingDate = 0;
  let failed = 0;

  for (const item of websiteEvents) {
    if (!item.date) {
      missingDate++;
      continue;
    }

    const result = await syncFamilyDiaryItemToGoogleCalendar(item);

    if (result.status === "synced") synced++;
    else if (result.status === "already_exists") existing++;
    else if (result.status === "failed") failed++;
  }

  await loadMonthEvents();

  const parts = [
    `웹 일정 동기화 완료: 새로 업로드 ${synced}건`,
    `이미 등록 ${existing}건`
  ];

  if (missingDate) {
    parts.push(`날짜 미입력으로 제외 ${missingDate}건`);
  }

  if (failed) {
    parts.push(`업로드 실패 ${failed}건`);
  }

  showMessage(parts.join(" · "), failed > 0);
}

// app.js에서 새 일정을 저장한 뒤 호출할 수 있도록 함수를 공개합니다.
window.syncFamilyDiaryItemToGoogleCalendar =
  syncFamilyDiaryItemToGoogleCalendar;

function renderCalendarShell() {
  const container = $("google-calendar-events");
  if (!container) return;

  container.innerHTML = `
    <div class="month-toolbar">
      <div class="month-navigation">
        <button type="button" id="month-prev"
          class="button button-light" aria-label="이전 달">‹</button>
        <button type="button" id="month-today"
          class="button button-light">오늘</button>
        <button type="button" id="month-next"
          class="button button-light" aria-label="다음 달">›</button>
      </div>
      <h3 id="month-title"></h3>
    </div>
    <div class="month-weekdays">
      <span>일</span><span>월</span><span>화</span><span>수</span>
      <span>목</span><span>금</span><span>토</span>
    </div>
    <div id="month-grid" class="month-grid"></div>
    <p class="calendar-hint">
      날짜를 누르면 일정을 추가할 수 있어요.
      기존 일정을 누르면 수정하거나 삭제할 수 있어요.
    </p>
  `;

  $("month-prev").addEventListener("click", () => {
    displayedMonth = new Date(
      displayedMonth.getFullYear(),
      displayedMonth.getMonth() - 1,
      1
    );
    loadMonthEvents();
  });

  $("month-next").addEventListener("click", () => {
    displayedMonth = new Date(
      displayedMonth.getFullYear(),
      displayedMonth.getMonth() + 1,
      1
    );
    loadMonthEvents();
  });

  $("month-today").addEventListener("click", () => {
    displayedMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );
    loadMonthEvents();
  });

  renderCalendar();
}

function renderCalendar() {
  const grid = $("month-grid");
  const title = $("month-title");
  if (!grid || !title) return;

  title.textContent =
    `${displayedMonth.getFullYear()}년 ${displayedMonth.getMonth() + 1}월`;

  grid.replaceChildren();

  const firstDay = new Date(
    displayedMonth.getFullYear(),
    displayedMonth.getMonth(),
    1
  );

  const lastDay = new Date(
    displayedMonth.getFullYear(),
    displayedMonth.getMonth() + 1,
    0
  );

  const today = dateKey(new Date());
  const cellCount =
    Math.ceil((firstDay.getDay() + lastDay.getDate()) / 7) * 7;

  for (let i = 0; i < cellCount; i++) {
    const dayNumber = i - firstDay.getDay() + 1;

    const cellDate = new Date(
      displayedMonth.getFullYear(),
      displayedMonth.getMonth(),
      dayNumber
    );

    const inMonth =
      cellDate.getMonth() === displayedMonth.getMonth();

    const key = dateKey(cellDate);
    const cell = document.createElement("div");

    cell.className = "month-cell";

    if (!inMonth) cell.classList.add("outside-month");
    if (key === today) cell.classList.add("today-cell");

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "day-number";
    addButton.textContent = String(cellDate.getDate());
    addButton.disabled = !inMonth;
    addButton.setAttribute("aria-label", `${key} 일정 추가`);
    addButton.addEventListener("click", () => {
      openEventEditor(null, key);
    });

    cell.appendChild(addButton);

    events
      .filter(event => eventStartKey(event) === key)
      .forEach(event => {
        const eventButton = document.createElement("button");
        eventButton.type = "button";
        eventButton.className = "month-event";

        eventButton.textContent =
          `${eventTimeLabel(event)}${eventTimeLabel(event) ? " " : ""}${event.summary || "제목 없는 일정"}`;

        eventButton.title = "눌러서 일정 수정";
        eventButton.addEventListener("click", () => {
          openEventEditor(event);
        });

        cell.appendChild(eventButton);
      });

    if (inMonth) {
      const addLink = document.createElement("button");
      addLink.type = "button";
      addLink.className = "day-add";
      addLink.textContent = "+";
      addLink.title = "일정 추가";
      addLink.addEventListener("click", () => {
        openEventEditor(null, key);
      });

      cell.appendChild(addLink);
    }

    grid.appendChild(cell);
  }
}

function openEventEditor(event = null, date = dateKey(new Date())) {
  const old = $("calendar-editor-overlay");
  if (old) old.remove();

  const isAllDay = event
    ? Boolean(event.start?.date && !event.start?.dateTime)
    : false;

  const startDate = event
    ? event.start?.dateTime
      ? dateTimeValue(new Date(event.start.dateTime))
      : `${event.start?.date || date}T09:00`
    : `${date}T09:00`;

  const endDate = event
    ? event.end?.dateTime
      ? dateTimeValue(new Date(event.end.dateTime))
      : `${event.end?.date || date}T10:00`
    : `${date}T10:00`;

  const overlay = document.createElement("div");
  overlay.id = "calendar-editor-overlay";
  overlay.className = "calendar-editor-overlay";

  const panel = document.createElement("form");
  panel.className = "calendar-editor";

  panel.innerHTML = `
    <div class="editor-heading">
      <h3>${event ? "일정 수정" : "새 일정 추가"}</h3>
      <button type="button" id="editor-close"
        class="button button-light">닫기</button>
    </div>
    <label>일정 제목
      <input id="editor-title" required maxlength="200"
        placeholder="예: 가족 외식">
    </label>
    <label class="all-day-label">
      <input id="editor-all-day" type="checkbox"
        ${isAllDay ? "checked" : ""}>
      종일 일정
    </label>
    <label>시작
      <input id="editor-start" type="datetime-local"
        required value="${startDate}">
    </label>
    <label>종료
      <input id="editor-end" type="datetime-local"
        required value="${endDate}">
    </label>
    <label>메모
      <textarea id="editor-description" rows="3"
        maxlength="2000"></textarea>
    </label>
    <p id="editor-error" class="form-message" role="status"></p>
    <div class="editor-actions">
      ${event
        ? '<button type="button" id="editor-delete" class="button button-light">일정 삭제</button>'
        : ""}
      <button type="submit" class="button button-primary">
        ${event ? "변경 사항 저장" : "일정 등록"}
      </button>
    </div>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  $("editor-title").value = event?.summary || "";
  $("editor-description").value = event?.description || "";

  const close = () => overlay.remove();

  $("editor-close").addEventListener("click", close);

  overlay.addEventListener("click", e => {
    if (e.target === overlay) close();
  });

  $("editor-all-day").addEventListener("change", e => {
    const allDay = e.target.checked;

    $("editor-start").type = allDay ? "date" : "datetime-local";
    $("editor-end").type = allDay ? "date" : "datetime-local";

    if (allDay) {
      $("editor-start").value =
        $("editor-start").value.slice(0, 10);
      $("editor-end").value =
        $("editor-end").value.slice(0, 10);
    } else {
      $("editor-start").value =
        `${$("editor-start").value.slice(0, 10)}T09:00`;
      $("editor-end").value =
        `${$("editor-end").value.slice(0, 10)}T10:00`;
    }
  });

  if (isAllDay) {
    $("editor-start").type = "date";
    $("editor-end").type = "date";
    $("editor-start").value = event.start.date;
    $("editor-end").value = event.end.date;
  }

  panel.addEventListener("submit", async e => {
    e.preventDefault();

    const summary = $("editor-title").value.trim();
    const allDay = $("editor-all-day").checked;
    const startValue = $("editor-start").value;
    const endValue = $("editor-end").value;

    if (!summary || !startValue || !endValue) return;

    if (endValue <= startValue) {
      $("editor-error").textContent =
        "종료 시각은 시작 시각보다 뒤여야 해요.";
      return;
    }

    const resource = {
      summary,
      description: $("editor-description").value.trim()
    };

    if (allDay) {
      resource.start = { date: startValue };
      resource.end = { date: endValue };
    } else {
      resource.start = {
        dateTime: parseLocalDateTime(startValue).toISOString()
      };
      resource.end = {
        dateTime: parseLocalDateTime(endValue).toISOString()
      };
    }

    try {
      if (event) {
        await gapi.client.calendar.events.update({
          calendarId: selectedCalendar,
          eventId: event.id,
          resource
        });
      } else {
        await gapi.client.calendar.events.insert({
          calendarId: selectedCalendar,
          resource
        });
      }

      close();
      showMessage(event ? "일정을 수정했어요." : "새 일정을 등록했어요.");
      await loadMonthEvents();
    } catch (error) {
      console.error(error);
      $("editor-error").textContent =
        "저장하지 못했어요. 캘린더 편집 권한을 확인해 주세요.";
    }
  });

  if (event) {
    $("editor-delete").addEventListener("click", async () => {
      if (
        !confirm(
          `'${event.summary || "제목 없는 일정"}'을(를) 삭제할까요?`
        )
      ) {
        return;
      }

      try {
        await gapi.client.calendar.events.delete({
          calendarId: selectedCalendar,
          eventId: event.id
        });

        close();
        showMessage("일정을 삭제했어요.");
        await loadMonthEvents();
      } catch (error) {
        console.error(error);
        $("editor-error").textContent =
          "삭제하지 못했어요. 캘린더 편집 권한을 확인해 주세요.";
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("google-connect-btn")?.addEventListener(
    "click",
    connectCalendar
  );

  $("google-refresh-btn")?.addEventListener(
    "click",
    loadMonthEvents
  );

  $("google-calendar-select")?.addEventListener(
    "change",
    loadMonthEvents
  );

  $("google-add-event-btn")?.addEventListener(
    "click",
    () => openEventEditor()
  );

  initializeCalendar();
});
